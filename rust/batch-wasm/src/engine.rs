use pc_core::queue_trie::{QueueTrie, QueueTrieScratch};
use pc_core::{
    CELLS, FULL_ROW, FastSet, Physics, Piece, normalize_after_placement, tspin_kind_exact,
};
use std::cell::RefCell;
use std::rc::Rc;

use crate::common::{locked_next_board, physics};

const MAX_OPERATIONS: usize = 15;
const MAX_QUEUE_LEN: usize = 21;

#[derive(Clone, Copy)]
struct BatchOperation {
    piece: Piece,
    mask: u64,
}

#[derive(Clone, Copy)]
struct BatchVariant {
    ids: u64,
    clears: u64,
    tspins: u32,
    pc_mask: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct TerminalKey {
    order: u64,
    ids: u64,
    clears: u64,
    depth: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct StructuralKey {
    prefix: u64,
    board: u64,
    remaining: u16,
    cleared_rows: u8,
    mode_state: u8,
}

#[derive(Clone, Copy)]
struct StructuralEdge {
    id: u8,
    next: usize,
    clear_lines: u8,
    spin: u8,
    pc_after: bool,
}

struct StructuralNode {
    terminal: bool,
    mode_state: u8,
    edges: Vec<StructuralEdge>,
}

#[derive(Clone, Copy)]
struct ClearInfo {
    available: [u8; 6],
    len: u8,
    complete: u8,
}

fn clear_info_table(height: u8) -> [ClearInfo; 64] {
    let empty = ClearInfo {
        available: [0; 6],
        len: 0,
        complete: 0,
    };
    let mut out = [empty; 64];
    for mask in 0..64u8 {
        let mut info = empty;
        info.complete = mask.count_ones() as u8;
        for row in 0..height {
            if mask & (1 << row) == 0 {
                info.available[info.len as usize] = row;
                info.len += 1;
            }
        }
        out[mask as usize] = info;
    }
    out
}

fn mapped_masks(operations: &[BatchOperation], height: u8) -> Vec<[u64; 64]> {
    operations
        .iter()
        .map(|op| {
            let mut maps = [0u64; 64];
            for cleared in 0..64u8 {
                maps[cleared as usize] = map_original_mask(op.mask, cleared, height);
            }
            maps
        })
        .collect()
}

#[inline]
fn advance_cleared_fast(
    board: u64,
    current_mask: u64,
    cleared_rows: u8,
    height: u8,
    infos: &[ClearInfo; 64],
) -> u8 {
    let info = infos[cleared_rows as usize];
    let raw = board | current_mask;
    let mut next = cleared_rows;
    for cy in info.complete..height {
        if ((raw >> (cy as u32 * 10)) & FULL_ROW) == FULL_ROW {
            let ai = (cy - info.complete) as usize;
            if ai < info.len as usize {
                next |= 1 << info.available[ai];
            }
        }
    }
    next
}

#[inline]
fn mode_needs_spin(mode: u8) -> bool {
    matches!(mode, 11..=15)
}

#[inline]
fn mode_step(mode: u8, state: u8, piece: Piece, clear: u8, spin: u8, pc_after: bool) -> Option<u8> {
    match mode {
        0 | 2 => Some(state),
        1 => Some(state | ((piece == Piece::I && clear == 4) as u8)),
        3..=10 => {
            let slot = mode - 3;
            let req = slot / 2 + 1;
            let allows_pc = slot & 1 != 0;
            if clear != 0 && clear < req && !(allows_pc && pc_after) {
                None
            } else {
                Some(state)
            }
        }
        11 => Some(state | ((clear > 0 && piece == Piece::T && spin > 0) as u8)),
        12 => Some(state | ((clear >= 1 && piece == Piece::T && spin == 2) as u8)),
        13 => Some(state | ((clear >= 2 && piece == Piece::T && spin == 2) as u8)),
        14 => Some(state | ((clear >= 3 && piece == Piece::T && spin == 2) as u8)),
        15 => {
            if clear != 0 && !(piece == Piece::I && clear == 4) && !(piece == Piece::T && spin > 0)
            {
                None
            } else {
                Some(state)
            }
        }
        _ => None,
    }
}

#[inline]
fn mode_terminal_accepts(mode: u8, state: u8, last_piece: u8, last_clear: u8) -> bool {
    match mode {
        0 | 3..=10 | 15 => true,
        1 | 11..=14 => state != 0,
        2 => last_piece == Piece::I as u8 && last_clear == 4,
        _ => false,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct VariantSeenKey {
    ids: u64,
    board: u64,
    order: u64,
    clears: u64,
    remaining: u16,
    cleared_rows: u8,
    depth: u8,
}

fn variant_mode_accepts(
    mode: u8,
    operations: &[BatchOperation],
    ids: u64,
    clears: u64,
    tspins: u32,
    pc_mask: u16,
    depth: u8,
) -> bool {
    if mode == 0 {
        return true;
    }
    let mut hit = false;
    for i in 0..depth as usize {
        let id = ((ids >> (i * 4)) & 0xf) as usize;
        let piece = operations[id].piece;
        let clear = ((clears >> (i * 3)) & 7) as u8;
        let spin = ((tspins >> (i * 2)) & 3) as u8;
        let pc_after = pc_mask & (1 << i) != 0;
        match mode {
            1 => hit |= piece == Piece::I && clear == 4,
            2 => {
                if i + 1 == depth as usize {
                    return piece == Piece::I && clear == 4;
                }
            }
            3..=10 => {
                let slot = mode - 3;
                let req = slot / 2 + 1;
                let allows_pc = slot & 1 != 0;
                if clear != 0 && clear < req && !(allows_pc && pc_after) {
                    return false;
                }
            }
            11 => hit |= clear > 0 && piece == Piece::T && spin > 0,
            12 => hit |= clear >= 1 && piece == Piece::T && spin == 2,
            13 => hit |= clear >= 2 && piece == Piece::T && spin == 2,
            14 => hit |= clear >= 3 && piece == Piece::T && spin == 2,
            15 => {
                if clear != 0
                    && !(piece == Piece::I && clear == 4)
                    && !(piece == Piece::T && spin > 0)
                {
                    return false;
                }
            }
            _ => return false,
        }
    }
    match mode {
        1 | 11..=14 => hit,
        2 => false,
        3..=10 | 15 => true,
        _ => false,
    }
}

struct VariantSearch<'a> {
    operations: &'a [BatchOperation],
    height: u8,
    physics: Physics,
    mode: u8,
    seen: FastSet<VariantSeenKey>,
    terminal: FastSet<TerminalKey>,
    variants: Vec<BatchVariant>,
}

#[derive(Clone, Copy)]
struct VariantSearchState {
    board: u64,
    cleared_rows: u8,
    remaining: u16,
    depth: u8,
    order: u64,
    ids: u64,
    clears: u64,
    tspins: u32,
    pc_mask: u16,
}

impl VariantSearch<'_> {
    fn recurse(&mut self, st: VariantSearchState) {
        if st.remaining == 0 {
            let key = TerminalKey {
                order: st.order,
                ids: st.ids,
                clears: st.clears,
                depth: st.depth,
            };
            if self.terminal.insert(key)
                && variant_mode_accepts(
                    self.mode,
                    self.operations,
                    st.ids,
                    st.clears,
                    st.tspins,
                    st.pc_mask,
                    st.depth,
                )
            {
                self.variants.push(BatchVariant {
                    ids: st.ids,
                    clears: st.clears,
                    tspins: st.tspins,
                    pc_mask: st.pc_mask,
                });
            }
            return;
        }

        let seen_key = VariantSeenKey {
            ids: st.ids,
            board: st.board,
            order: st.order,
            clears: st.clears,
            remaining: st.remaining,
            cleared_rows: st.cleared_rows,
            depth: st.depth,
        };
        if !self.seen.insert(seen_key) {
            return;
        }

        let mut remaining = st.remaining;
        while remaining != 0 {
            let id = remaining.trailing_zeros() as usize;
            remaining &= remaining - 1;
            let op = self.operations[id];
            let cells = map_original_mask(op.mask, st.cleared_rows, self.height);
            if cells == 0 {
                continue;
            }
            let Some(next_board) =
                locked_next_board(st.board, op.piece, cells, self.height, self.physics)
            else {
                continue;
            };
            let next_cleared = advance_cleared(st.board, cells, st.cleared_rows, self.height);
            let new_lines = next_cleared.count_ones() - st.cleared_rows.count_ones();
            let cleared_count = next_cleared.count_ones();
            let pc_after = next_board == floor_mask(cleared_count);
            let spin = if mode_needs_spin(self.mode) && op.piece == Piece::T && new_lines > 0 {
                tspin_kind_exact(st.board, cells, self.height, self.physics)
            } else {
                0
            };

            let shift3 = st.depth as u32 * 3;
            let shift4 = st.depth as u32 * 4;
            let shift2 = st.depth as u32 * 2;
            self.recurse(VariantSearchState {
                board: next_board,
                cleared_rows: next_cleared,
                remaining: st.remaining & !(1 << id),
                depth: st.depth + 1,
                order: st.order | ((op.piece as u64) << shift3),
                ids: st.ids | ((id as u64) << shift4),
                clears: st.clears | ((new_lines as u64) << shift3),
                tspins: st.tspins | ((spin as u32) << shift2),
                pc_mask: st.pc_mask | ((pc_after as u16) << st.depth),
            });
        }
    }
}

fn run_variant_engine(
    ws: &mut BatchWorkspace,
    base: u64,
    height: u8,
    physics: Physics,
    mode: u8,
) -> bool {
    let (board, cleared_rows) = normalize_base(base, height);
    let count = ws.operations.len();
    let mut search = VariantSearch {
        operations: &ws.operations,
        height,
        physics,
        mode,
        seen: FastSet::default(),
        terminal: FastSet::default(),
        variants: Vec::new(),
    };
    search.recurse(VariantSearchState {
        board,
        cleared_rows,
        remaining: if count == 0 { 0 } else { (1u16 << count) - 1 },
        depth: 0,
        order: 0,
        ids: 0,
        clears: 0,
        tspins: 0,
        pc_mask: 0,
    });
    ws.variants = search.variants;
    if !mode_needs_spin(mode) {
        for variant in &mut ws.variants {
            annotate_variant_tspins(variant, &ws.operations, base, height, physics);
        }
    }
    ws.covered.clear();
    true
}

struct DagBuilder<'a> {
    queue_filter: Option<QueuePrefixCache>,
    operations: &'a [BatchOperation],
    maps: &'a [[u64; 64]],
    clear_infos: &'a [ClearInfo; 64],
    height: u8,
    physics: Physics,
    mode: u8,
    index: pc_core::FastMap<StructuralKey, usize>,
    nodes: Vec<StructuralNode>,
}

impl DagBuilder<'_> {
    fn build(&mut self, key: StructuralKey) -> usize {
        if let Some(&id) = self.index.get(&key) {
            return id;
        }
        let id = self.nodes.len();
        self.index.insert(key, id);
        self.nodes.push(StructuralNode {
            terminal: key.remaining == 0,
            mode_state: key.mode_state,
            edges: Vec::new(),
        });
        if key.remaining == 0 {
            return id;
        }

        let mut edges = Vec::new();
        let mut remaining = key.remaining;
        while remaining != 0 {
            let op_id = remaining.trailing_zeros() as usize;
            remaining &= remaining - 1;
            let op = self.operations[op_id];
            let depth = self.operations.len() - key.remaining.count_ones() as usize;
            let next_prefix = if let Some(filter) = &mut self.queue_filter {
                let prefix = key.prefix | ((op.piece as u64) << (depth * 3));
                if filter
                    .viable(prefix, depth as u8 + 1)
                    .iter()
                    .all(|&word| word == 0)
                {
                    continue;
                }
                prefix
            } else {
                0
            };
            let cells = self.maps[op_id][key.cleared_rows as usize];
            if cells == 0 {
                continue;
            }
            let Some(next_board) =
                locked_next_board(key.board, op.piece, cells, self.height, self.physics)
            else {
                continue;
            };
            let next_cleared = advance_cleared_fast(
                key.board,
                cells,
                key.cleared_rows,
                self.height,
                self.clear_infos,
            );
            let new_lines = (next_cleared.count_ones() - key.cleared_rows.count_ones()) as u8;
            let cleared_count = next_cleared.count_ones();
            let pc_after = next_board == floor_mask(cleared_count);
            let spin = if mode_needs_spin(self.mode) && op.piece == Piece::T && new_lines > 0 {
                tspin_kind_exact(key.board, cells, self.height, self.physics)
            } else {
                0
            };
            let Some(next_mode_state) = mode_step(
                self.mode,
                key.mode_state,
                op.piece,
                new_lines,
                spin,
                pc_after,
            ) else {
                continue;
            };
            let next = self.build(StructuralKey {
                prefix: next_prefix,
                board: next_board,
                remaining: key.remaining & !(1 << op_id),
                cleared_rows: next_cleared,
                mode_state: next_mode_state,
            });
            if !self.nodes[next].terminal && self.nodes[next].edges.is_empty() {
                continue;
            }
            edges.push(StructuralEdge {
                id: op_id as u8,
                next,
                clear_lines: new_lines,
                spin,
                pc_after,
            });
        }
        self.nodes[id].edges = edges;
        id
    }
}

struct QueuePrefixCache {
    cache_bytes: usize,
    trie: QueueTrie,
    scratch: QueueTrieScratch,
    use_hold: bool,
    cache: pc_core::FastMap<u64, Rc<[u64]>>,
}
impl QueuePrefixCache {
    fn new(queues: &[(u64, u8)], use_hold: bool) -> Self {
        let bits: Vec<_> = queues.iter().map(|q| q.0).collect();
        let lens: Vec<_> = queues.iter().map(|q| q.1).collect();
        let trie = QueueTrie::new(&bits, &lens).expect("validated batch queues");
        let scratch = QueueTrieScratch::new(trie.node_count());
        Self {
            cache_bytes: 0,
            trie,
            scratch,
            use_hold,
            cache: pc_core::FastMap::default(),
        }
    }
    fn viable(&mut self, order: u64, len: u8) -> Rc<[u64]> {
        let key = order | ((len as u64) << 48);
        if let Some(bits) = self.cache.get(&key) {
            return Rc::clone(bits);
        }
        // Cover stores zero-based piece codes; the common order API uses 1..7.
        let mut encoded = 0u64;
        for i in 0..len {
            encoded |= (((order >> (i as u32 * 3)) & 7) + 1) << (i as u32 * 3);
        }
        let bits: Rc<[u64]> = self
            .trie
            .coverage_for_order(encoded, len, self.use_hold, &mut self.scratch)
            .into();
        let bytes = bits.len() * 8 + 48;
        if self.cache_bytes + bytes <= 16 * 1024 * 1024 {
            self.cache_bytes += bytes;
            self.cache.insert(key, Rc::clone(&bits));
        }
        bits
    }
}

#[derive(Default)]
struct BatchWorkspace {
    operations: Vec<BatchOperation>,
    queues: Vec<(u64, u8)>,
    variants: Vec<BatchVariant>,
    covered: Vec<u8>,
    congruent: Vec<CongruentSolution>,
}

thread_local! {
    static WORKSPACE: RefCell<BatchWorkspace> = RefCell::new(BatchWorkspace::default());
}

#[inline]
fn normalize_base(base: u64, height: u8) -> (u64, u8) {
    let mut cleared_rows = 0u8;
    let mut complete = 0u8;
    let mut incomplete = [0u64; 6];
    let mut incomplete_len = 0usize;
    for y in 0..height {
        let row = (base >> (y as u32 * 10)) & FULL_ROW;
        if row == FULL_ROW {
            cleared_rows |= 1 << y;
            complete += 1;
        } else {
            incomplete[incomplete_len] = row;
            incomplete_len += 1;
        }
    }
    let mut board = 0u64;
    for y in 0..complete {
        board |= FULL_ROW << (y as u32 * 10);
    }
    for (i, row) in incomplete[..incomplete_len].iter().enumerate() {
        board |= *row << ((i as u32 + complete as u32) * 10);
    }
    (board, cleared_rows)
}

#[inline]
fn map_original_mask(mask: u64, cleared_rows: u8, height: u8) -> u64 {
    let mut available = [0u8; 6];
    let mut n = 0usize;
    for r in 0..height {
        if cleared_rows & (1 << r) == 0 {
            available[n] = r;
            n += 1;
        }
    }
    let c = cleared_rows.count_ones() as u8;
    let mut out = 0u64;
    for (ai, &r) in available[..n].iter().enumerate() {
        let cy = c + ai as u8;
        let row = (mask >> (r as u32 * 10)) & FULL_ROW;
        out |= row << (cy as u32 * 10);
    }
    out
}

#[inline]
fn advance_cleared(board: u64, current_mask: u64, cleared_rows: u8, height: u8) -> u8 {
    let mut available = [0u8; 6];
    let mut n = 0usize;
    for r in 0..height {
        if cleared_rows & (1 << r) == 0 {
            available[n] = r;
            n += 1;
        }
    }
    let c = cleared_rows.count_ones() as u8;
    let raw = board | current_mask;
    let mut next = cleared_rows;
    for cy in c..height {
        if ((raw >> (cy as u32 * 10)) & FULL_ROW) == FULL_ROW {
            let ai = (cy - c) as usize;
            if ai < n {
                next |= 1 << available[ai];
            }
        }
    }
    next
}

#[inline]
fn floor_mask(lines: u32) -> u64 {
    if lines == 0 {
        0
    } else {
        (1u64 << (lines * 10)) - 1
    }
}

#[inline]
fn piece_at(packed: u64, index: usize) -> u8 {
    ((packed >> (index * 3)) & 7) as u8
}

#[inline]
fn order_piece(order: u64, index: usize) -> u8 {
    ((order >> (index * 3)) & 7) as u8
}

// Mirrors src/batch-orders.mjs canQueueBuildOrder, using a compact bitset for
// (queue-index, hold-piece) states. hold=7 means empty.
fn queue_buildable(queue: u64, queue_len: u8, order: u64, order_len: u8, use_hold: bool) -> bool {
    let n = queue_len as usize;
    if n > MAX_QUEUE_LEN {
        return false;
    }
    let state_count = (n + 1) * 8;
    let words = state_count.div_ceil(64);
    let mut cur = [0u64; 3];
    let mut next = [0u64; 3];
    cur[0] = 1u64 << 7; // idx=0, empty hold

    for oi in 0..order_len as usize {
        let wanted = order_piece(order, oi);
        next[..words].fill(0);
        let mut any = false;
        for (wi, &word) in cur.iter().take(words).enumerate() {
            let mut states = word;
            while states != 0 {
                let bit = states.trailing_zeros() as usize;
                states &= states - 1;
                let state = wi * 64 + bit;
                if state >= state_count {
                    continue;
                }
                let idx = state >> 3;
                let hold = state & 7;
                let mut add = |ni: usize, nh: usize| {
                    let id = (ni << 3) | nh;
                    next[id >> 6] |= 1u64 << (id & 63);
                    any = true;
                };
                if idx < n && piece_at(queue, idx) == wanted {
                    add(idx + 1, hold);
                }
                if use_hold {
                    if hold == 7 {
                        if idx + 1 < n && piece_at(queue, idx + 1) == wanted {
                            add(idx + 2, piece_at(queue, idx) as usize);
                        }
                    } else if hold as u8 == wanted {
                        if idx < n {
                            add(idx + 1, piece_at(queue, idx) as usize);
                        } else if idx == n {
                            add(idx, 7);
                        }
                    }
                }
            }
        }
        if !any {
            return false;
        }
        std::mem::swap(&mut cur, &mut next);
    }
    true
}

#[derive(Clone)]
struct CongruentSolution {
    operations: Vec<BatchOperation>,
    orders: Vec<u64>,
}

#[derive(Clone, Copy)]
struct PathState {
    depth: u8,
    order: u64,
    ids: u64,
    clears: u64,
    tspins: u32,
    pc_mask: u16,
    queue_live: bool,
}

struct PathCollector<'a> {
    product_seen: FastSet<(usize, u8, u8)>,
    coverage_only: bool,
    operations: &'a [BatchOperation],
    nodes: &'a [StructuralNode],
    mode: u8,
    terminal: FastSet<TerminalKey>,
    variants: Vec<BatchVariant>,
    queue_cache: QueuePrefixCache,
    covered_bits: Vec<u64>,
    prefix_prune: bool,
}

impl PathCollector<'_> {
    fn recurse(&mut self, node_id: usize, st: PathState, last_piece: u8, last_clear: u8) {
        if self.coverage_only && !self.product_seen.insert((node_id, last_piece, last_clear)) {
            return;
        }
        let node = &self.nodes[node_id];
        if node.terminal {
            if !mode_terminal_accepts(self.mode, node.mode_state, last_piece, last_clear) {
                return;
            }
            if st.queue_live && !self.covered_bits.is_empty() {
                let bits = self.queue_cache.viable(st.order, st.depth);
                for (dst, src) in self.covered_bits.iter_mut().zip(bits.iter()) {
                    *dst |= src;
                }
            }
            if self.coverage_only {
                return;
            }
            let key = TerminalKey {
                order: st.order,
                ids: st.ids,
                clears: st.clears,
                depth: st.depth,
            };
            if self.terminal.insert(key) {
                self.variants.push(BatchVariant {
                    ids: st.ids,
                    clears: st.clears,
                    tspins: st.tspins,
                    pc_mask: st.pc_mask,
                });
            }
            return;
        }

        for edge in &node.edges {
            let op = self.operations[edge.id as usize];
            let shift3 = st.depth as u32 * 3;
            let shift4 = st.depth as u32 * 4;
            let shift2 = st.depth as u32 * 2;
            let next_order = st.order | ((op.piece as u64) << shift3);
            let mut queue_live = st.queue_live;
            if self.prefix_prune && queue_live {
                let bits = self.queue_cache.viable(next_order, st.depth + 1);
                queue_live = bits.iter().any(|&x| x != 0);
            }
            self.recurse(
                edge.next,
                PathState {
                    depth: st.depth + 1,
                    order: next_order,
                    ids: st.ids | ((edge.id as u64) << shift4),
                    clears: st.clears | ((edge.clear_lines as u64) << shift3),
                    tspins: st.tspins | ((edge.spin as u32) << shift2),
                    pc_mask: st.pc_mask | ((edge.pc_after as u16) << st.depth),
                    queue_live,
                },
                op.piece as u8,
                edge.clear_lines,
            );
        }
    }
}

fn annotate_variant_tspins(
    variant: &mut BatchVariant,
    operations: &[BatchOperation],
    base: u64,
    height: u8,
    physics: Physics,
) {
    let (mut board, mut cleared_rows) = normalize_base(base, height);
    let mut tspins = 0u32;
    for i in 0..operations.len() {
        let id = ((variant.ids >> (i * 4)) & 0xf) as usize;
        let op = operations[id];
        let cells = map_original_mask(op.mask, cleared_rows, height);
        let next_cleared = advance_cleared(board, cells, cleared_rows, height);
        let new_lines = next_cleared.count_ones() - cleared_rows.count_ones();
        if op.piece == Piece::T && new_lines > 0 {
            let spin = tspin_kind_exact(board, cells, height, physics);
            tspins |= (spin as u32) << (i * 2);
        }
        board = normalize_after_placement(board | cells, height);
        cleared_rows = next_cleared;
    }
    variant.tspins = tspins;
}

fn max_piece_counts(queues: &[(u64, u8)]) -> [u8; 7] {
    let mut max_counts = [0u8; 7];
    for &(queue, len) in queues {
        let mut counts = [0u8; 7];
        for i in 0..len as usize {
            let piece = piece_at(queue, i) as usize;
            if piece < 7 {
                counts[piece] += 1;
            }
        }
        for i in 0..7 {
            max_counts[i] = max_counts[i].max(counts[i]);
        }
    }
    max_counts
}

fn geometric_placements(piece: Piece, height: u8, fill: u64) -> Vec<BatchOperation> {
    let mut out = Vec::new();
    let mut seen = FastSet::default();
    for cells in &CELLS[piece as usize] {
        let max_x = cells.iter().map(|&(x, _)| x).max().unwrap_or(0);
        let max_y = cells.iter().map(|&(_, y)| y).max().unwrap_or(0);
        for y in 0..=height as i8 - 1 - max_y {
            for x in 0..=9 - max_x {
                let mut mask = 0u64;
                for &(dx, dy) in cells {
                    mask |= 1u64 << ((y + dy) as u32 * 10 + (x + dx) as u32);
                }
                if mask & fill == mask && seen.insert(mask) {
                    out.push(BatchOperation { piece, mask });
                }
            }
        }
    }
    out
}

fn valid_orders_for_tiling(
    base: u64,
    operations: &[BatchOperation],
    queues: &[(u64, u8)],
    height: u8,
    physics: Physics,
    use_hold: bool,
) -> Vec<u64> {
    if operations.len() > MAX_OPERATIONS || queues.is_empty() {
        return Vec::new();
    }
    let (board, cleared_rows) = normalize_base(base, height);
    let maps = mapped_masks(operations, height);
    let infos = clear_info_table(height);
    let mut seen = FastSet::default();
    let mut valid = FastSet::default();

    #[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
    struct OrderStateKey {
        board: u64,
        order: u64,
        remaining: u16,
        cleared_rows: u8,
        depth: u8,
    }

    #[allow(clippy::too_many_arguments)]
    fn walk(
        operations: &[BatchOperation],
        maps: &[[u64; 64]],
        infos: &[ClearInfo; 64],
        queues: &[(u64, u8)],
        use_hold: bool,
        height: u8,
        physics: Physics,
        board: u64,
        cleared_rows: u8,
        remaining: u16,
        depth: u8,
        order: u64,
        seen: &mut FastSet<OrderStateKey>,
        valid: &mut FastSet<u64>,
    ) {
        if remaining == 0 {
            if queues
                .iter()
                .any(|&(queue, len)| queue_buildable(queue, len, order, depth, use_hold))
            {
                valid.insert(order);
            }
            return;
        }
        let key = OrderStateKey {
            board,
            order,
            remaining,
            cleared_rows,
            depth,
        };
        if !seen.insert(key) {
            return;
        }
        let mut choices = remaining;
        while choices != 0 {
            let id = choices.trailing_zeros() as usize;
            choices &= choices - 1;
            let op = operations[id];
            let cells = maps[id][cleared_rows as usize];
            if cells == 0 {
                continue;
            }
            let Some(next_board) = locked_next_board(board, op.piece, cells, height, physics)
            else {
                continue;
            };
            let next_cleared = advance_cleared_fast(board, cells, cleared_rows, height, infos);
            let next_order = order | ((op.piece as u64) << (depth as u32 * 3));
            walk(
                operations,
                maps,
                infos,
                queues,
                use_hold,
                height,
                physics,
                next_board,
                next_cleared,
                remaining & !(1 << id),
                depth + 1,
                next_order,
                seen,
                valid,
            );
        }
    }

    walk(
        operations,
        &maps,
        &infos,
        queues,
        use_hold,
        height,
        physics,
        board,
        cleared_rows,
        if operations.is_empty() {
            0
        } else {
            (1u16 << operations.len()) - 1
        },
        0,
        0,
        &mut seen,
        &mut valid,
    );
    let mut orders: Vec<u64> = valid.into_iter().collect();
    orders.sort_unstable();
    orders
}

struct CongruentSearch<'a> {
    base: u64,
    height: u8,
    physics: Physics,
    queues: &'a [(u64, u8)],
    use_hold: bool,
    max_counts: [u8; 7],
    by_cell: [Vec<BatchOperation>; 40],
    seen: FastSet<[u64; 7]>,
    out: Vec<CongruentSolution>,
    limit: usize,
    limit_hit: bool,
}

impl CongruentSearch<'_> {
    fn recurse(&mut self, rem: u64, operations: &mut Vec<BatchOperation>, counts: &mut [u8; 7]) {
        if self.out.len() >= self.limit {
            self.limit_hit = true;
            return;
        }
        if rem == 0 {
            let mut key = [0u64; 7];
            for op in operations.iter() {
                key[op.piece as usize] |= op.mask;
            }
            if !self.seen.insert(key) {
                return;
            }
            let orders = valid_orders_for_tiling(
                self.base,
                operations,
                self.queues,
                self.height,
                self.physics,
                self.use_hold,
            );
            if !orders.is_empty() {
                self.out.push(CongruentSolution {
                    operations: operations.clone(),
                    orders,
                });
            }
            return;
        }

        let mut best: Option<Vec<BatchOperation>> = None;
        for idx in 0..self.height as usize * 10 {
            let bit = 1u64 << idx;
            if rem & bit == 0 {
                continue;
            }
            let mut candidates = Vec::new();
            for &op in &self.by_cell[idx] {
                if counts[op.piece as usize] < self.max_counts[op.piece as usize]
                    && op.mask & rem == op.mask
                {
                    candidates.push(op);
                }
            }
            if candidates.is_empty() {
                return;
            }
            if best.as_ref().is_none_or(|x| candidates.len() < x.len()) {
                let one = candidates.len() == 1;
                best = Some(candidates);
                if one {
                    break;
                }
            }
        }
        let Some(candidates) = best else {
            return;
        };
        for op in candidates {
            counts[op.piece as usize] += 1;
            operations.push(op);
            self.recurse(rem ^ op.mask, operations, counts);
            operations.pop();
            counts[op.piece as usize] -= 1;
            if self.limit_hit {
                return;
            }
        }
    }
}

fn run_congruent(
    ws: &mut BatchWorkspace,
    base: u64,
    fill: u64,
    height: u8,
    physics: Physics,
    use_hold: bool,
    max_solutions: usize,
) -> bool {
    if !(2..=4).contains(&height) || max_solutions == 0 {
        return false;
    }
    let max_counts = max_piece_counts(&ws.queues);
    let mut by_cell: [Vec<BatchOperation>; 40] = std::array::from_fn(|_| Vec::new());
    for piece in Piece::ALL {
        for op in geometric_placements(piece, height, fill) {
            for (idx, bucket) in by_cell.iter_mut().enumerate().take(height as usize * 10) {
                if op.mask & (1u64 << idx) != 0 {
                    bucket.push(op);
                }
            }
        }
    }
    let mut search = CongruentSearch {
        base,
        height,
        physics,
        queues: &ws.queues,
        use_hold,
        max_counts,
        by_cell,
        seen: FastSet::default(),
        out: Vec::new(),
        limit: max_solutions,
        limit_hit: false,
    };
    search.recurse(fill, &mut Vec::new(), &mut [0u8; 7]);
    if search.limit_hit {
        return false;
    }
    ws.congruent = search.out;
    true
}

fn run_engine(
    coverage_only: bool,
    ws: &mut BatchWorkspace,
    base: u64,
    height: u8,
    physics: Physics,
    mode: u8,
    use_hold: bool,
) -> bool {
    if !(2..=6).contains(&height) || ws.operations.len() > MAX_OPERATIONS || mode > 15 {
        return false;
    }
    if ws.queues.is_empty() {
        if coverage_only {
            ws.covered.clear();
            ws.variants.clear();
            return true;
        }
        return run_variant_engine(ws, base, height, physics, mode);
    }
    let (board, cleared_rows) = normalize_base(base, height);
    let maps = mapped_masks(&ws.operations, height);
    let infos = clear_info_table(height);
    let count = ws.operations.len();
    let mut builder = DagBuilder {
        queue_filter: coverage_only.then(|| QueuePrefixCache::new(&ws.queues, use_hold)),
        operations: &ws.operations,
        maps: &maps,
        clear_infos: &infos,
        height,
        physics,
        mode,
        index: pc_core::FastMap::default(),
        nodes: Vec::new(),
    };
    let root = builder.build(StructuralKey {
        prefix: 0,
        board,
        remaining: if count == 0 { 0 } else { (1u16 << count) - 1 },
        cleared_rows,
        mode_state: 0,
    });
    let covered_words = ws.queues.len().div_ceil(64);
    let mut collector = PathCollector {
        product_seen: FastSet::default(),
        coverage_only,
        operations: &ws.operations,
        nodes: &builder.nodes,
        mode,
        terminal: FastSet::default(),
        variants: Vec::new(),
        queue_cache: builder
            .queue_filter
            .take()
            .unwrap_or_else(|| QueuePrefixCache::new(&ws.queues, use_hold)),
        covered_bits: vec![0u64; covered_words],
        prefix_prune: ws.queues.len() <= 512,
    };
    collector.recurse(
        root,
        PathState {
            depth: 0,
            order: 0,
            ids: 0,
            clears: 0,
            tspins: 0,
            pc_mask: 0,
            queue_live: !ws.queues.is_empty(),
        },
        7,
        0,
    );
    ws.variants = collector.variants;
    if !mode_needs_spin(mode) {
        for variant in &mut ws.variants {
            annotate_variant_tspins(variant, &ws.operations, base, height, physics);
        }
    }

    ws.covered.clear();
    ws.covered.resize(ws.queues.len(), 0);
    for qi in 0..ws.queues.len() {
        if collector
            .covered_bits
            .get(qi >> 6)
            .is_some_and(|word| word & (1u64 << (qi & 63)) != 0)
        {
            ws.covered[collector.queue_cache.trie.perm[qi] as usize] = 1;
        }
    }
    true
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_reset() {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        ws.operations.clear();
        ws.queues.clear();
        ws.variants.clear();
        ws.covered.clear();
        ws.congruent.clear();
    });
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_add_operation(piece: u32, mask: u64) -> u32 {
    let Some(piece) = Piece::from_u8(piece as u8) else {
        return 0;
    };
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        if ws.operations.len() >= MAX_OPERATIONS {
            return 0;
        }
        ws.operations.push(BatchOperation { piece, mask });
        1
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_add_queue(queue: u64, len: u32) -> u32 {
    if len as usize > MAX_QUEUE_LEN || (0..len).any(|i| ((queue >> (i * 3)) & 7) >= 7) {
        return 0;
    }
    WORKSPACE.with(|cell| {
        cell.borrow_mut().queues.push((queue, len as u8));
        1
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_run(
    base: u64,
    height: u32,
    physics_id: u32,
    mode: u32,
    use_hold: u32,
) -> u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        if !run_engine(
            false,
            &mut ws,
            base,
            height as u8,
            physics(physics_id),
            mode as u8,
            use_hold != 0,
        ) {
            return u32::MAX;
        }
        ws.variants.len() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_run(
    base: u64,
    fill: u64,
    height: u32,
    physics_id: u32,
    use_hold: u32,
    max_solutions: u32,
) -> u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        ws.congruent.clear();
        if !run_congruent(
            &mut ws,
            base,
            fill,
            height as u8,
            physics(physics_id),
            use_hold != 0,
            max_solutions as usize,
        ) {
            return u32::MAX;
        }
        ws.congruent.len() as u32
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_operation_count(solution: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .congruent
            .get(solution as usize)
            .map_or(0, |s| s.operations.len() as u32)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_operation_piece(solution: u32, operation: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .congruent
            .get(solution as usize)
            .and_then(|s| s.operations.get(operation as usize))
            .map_or(7, |op| op.piece as u32)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_operation_mask(solution: u32, operation: u32) -> u64 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .congruent
            .get(solution as usize)
            .and_then(|s| s.operations.get(operation as usize))
            .map_or(0, |op| op.mask)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_order_count(solution: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .congruent
            .get(solution as usize)
            .map_or(0, |s| s.orders.len() as u32)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_order(solution: u32, order: u32) -> u64 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .congruent
            .get(solution as usize)
            .and_then(|s| s.orders.get(order as usize))
            .copied()
            .unwrap_or(0)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variant_ids(index: u32) -> u64 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .variants
            .get(index as usize)
            .map_or(0, |v| v.ids)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variant_clears(index: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .variants
            .get(index as usize)
            .map_or(0, |v| v.clears as u32)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variant_clears64(index: u32) -> u64 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .variants
            .get(index as usize)
            .map_or(0, |v| v.clears)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variant_tspins(index: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .variants
            .get(index as usize)
            .map_or(0, |v| v.tspins)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variant_pc_mask(index: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .variants
            .get(index as usize)
            .map_or(0, |v| v.pc_mask as u32)
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_case_covered(index: u32) -> u32 {
    WORKSPACE.with(|cell| {
        cell.borrow()
            .covered
            .get(index as usize)
            .copied()
            .unwrap_or(0) as u32
    })
}

// This API intentionally returns coverage only; all-variant callers retain the
// unfiltered geometry DAG and its complete trace contract.
#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_run_coverage(
    base: u64,
    height: u32,
    physics_id: u32,
    mode: u32,
    use_hold: u32,
) -> u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        if !run_engine(
            true,
            &mut ws,
            base,
            height as u8,
            physics(physics_id),
            mode as u8,
            use_hold != 0,
        ) {
            return u32::MAX;
        }
        ws.covered.iter().map(|&x| x as u32).sum()
    })
}
