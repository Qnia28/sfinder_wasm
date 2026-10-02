use pc_core::queue_trie::{QueueTrie, QueueTrieScratch};
use pc_core::{CELLS, FULL_ROW, FastSet, Physics, Piece, normalize_after_placement};
use std::cell::RefCell;
use std::rc::Rc;

use crate::common::{cached_tspin_kind as tspin_kind_exact, locked_next_board, physics};

const MAX_OPERATIONS: usize = 15;
const MAX_QUEUE_LEN: usize = 21;

#[cfg(test)]
#[path = "optimization_tests.rs"]
mod optimization_tests;

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

#[derive(Clone, Copy, Default)]
struct StructuralEdge {
    id: u8,
    next: usize,
    clear_lines: u8,
    spin: u8,
    pc_after: bool,
}

struct StructuralNode {
    frontier: u32,
    terminal: bool,
    mode_state: u8,
    edge_start: usize,
    edge_len: usize,
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
    compressed: bool,
    frontier_budget: usize,
    exhausted: bool,
    queue_filter: Option<QueuePrefixCache>,
    operations: &'a [BatchOperation],
    maps: &'a [[u64; 64]],
    clear_infos: &'a [ClearInfo; 64],
    height: u8,
    physics: Physics,
    mode: u8,
    index: pc_core::FastMap<StructuralKey, usize>,
    nodes: Vec<StructuralNode>,
    edges: Vec<StructuralEdge>,
}

impl DagBuilder<'_> {
    fn build(&mut self, key: StructuralKey) -> usize {
        if let Some(&id) = self.index.get(&key) {
            return id;
        }
        let id = self.nodes.len();
        self.index.insert(key, id);
        self.nodes.push(StructuralNode {
            frontier: if self.compressed {
                key.prefix as u32
            } else {
                0
            },
            terminal: key.remaining == 0,
            mode_state: key.mode_state,
            edge_start: 0,
            edge_len: 0,
        });
        if key.remaining == 0 {
            return id;
        }

        let mut edges = [StructuralEdge::default(); MAX_OPERATIONS];
        let mut edge_len = 0;
        let mut remaining = key.remaining;
        while remaining != 0 {
            let op_id = remaining.trailing_zeros() as usize;
            remaining &= remaining - 1;
            let op = self.operations[op_id];
            let depth = self.operations.len() - key.remaining.count_ones() as usize;
            let next_prefix = if let Some(filter) = &mut self.queue_filter {
                if self.compressed {
                    let Some(frontier) =
                        filter.advance(key.prefix as u32, op.piece, self.frontier_budget)
                    else {
                        self.exhausted = true;
                        return id;
                    };
                    if frontier == u32::MAX {
                        crate::diagnostics::add(16, 1);
                        continue;
                    }
                    frontier as u64
                } else {
                    let prefix = key.prefix | ((op.piece as u64) << (depth * 3));
                    if !filter.any(prefix, depth as u8 + 1) {
                        crate::diagnostics::add(16, 1);
                        continue;
                    }
                    prefix
                }
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
            if self.exhausted {
                return id;
            }
            if !self.nodes[next].terminal && self.nodes[next].edge_len == 0 {
                continue;
            }
            edges[edge_len] = StructuralEdge {
                id: op_id as u8,
                next,
                clear_lines: new_lines,
                spin,
                pc_after,
            };
            edge_len += 1;
        }
        self.nodes[id].edge_start = self.edges.len();
        self.nodes[id].edge_len = edge_len;
        self.edges.extend_from_slice(&edges[..edge_len]);
        id
    }
}

struct QueuePrefixCache {
    frontiers: Vec<Rc<[u32]>>,
    frontier_index: pc_core::FastMap<Rc<[u32]>, u32>,
    frontier_steps: pc_core::FastMap<(u32, u8), u32>,
    frontier_bytes: usize,
    cache_bytes: usize,
    existence: pc_core::FastMap<u64, bool>,
    trie: QueueTrie,
    scratch: QueueTrieScratch,
    use_hold: bool,
    cache: pc_core::FastMap<u64, Rc<[u64]>>,
    queues: Vec<(u64, u8)>,
    order_engine: u8,
    order_budget: usize,
    order_fallback: bool,
}
impl QueuePrefixCache {
    fn new(queues: &[(u64, u8)], use_hold: bool) -> Self {
        let bits: Vec<_> = queues.iter().map(|q| q.0).collect();
        let lens: Vec<_> = queues.iter().map(|q| q.1).collect();
        let trie = QueueTrie::new(&bits, &lens).expect("validated batch queues");
        let scratch = QueueTrieScratch::new(trie.node_count());
        let initial: Rc<[u32]> = trie.initial_frontier().into();
        let mut frontier_index = pc_core::FastMap::default();
        frontier_index.insert(Rc::clone(&initial), 0);
        Self {
            frontiers: vec![initial],
            frontier_index,
            frontier_steps: pc_core::FastMap::default(),
            frontier_bytes: 80,
            cache_bytes: 0,
            existence: pc_core::FastMap::default(),
            trie,
            scratch,
            use_hold,
            cache: pc_core::FastMap::default(),
            queues: queues.to_vec(),
            order_engine: 0,
            order_budget: 200_000,
            order_fallback: false,
        }
    }
    fn advance(&mut self, frontier: u32, piece: Piece, budget: usize) -> Option<u32> {
        if budget == 0 {
            return None;
        }
        let key = (frontier, piece as u8);
        if let Some(&hit) = self.frontier_steps.get(&key) {
            return Some(hit);
        }
        let next: Rc<[u32]> = self
            .trie
            .advance_frontier(
                &self.frontiers[frontier as usize],
                piece,
                self.use_hold,
                &mut self.scratch,
            )
            .into();
        let id = if next.is_empty() {
            u32::MAX
        } else if let Some(&id) = self.frontier_index.get(&next) {
            id
        } else {
            let bytes = next.len() * 4 + 80;
            if self.frontiers.len() >= budget || self.frontier_bytes + bytes > 16 * 1024 * 1024 {
                return None;
            }
            let id = self.frontiers.len() as u32;
            self.frontier_index.insert(Rc::clone(&next), id);
            self.frontiers.push(next);
            crate::diagnostics::add(10, 1);
            self.frontier_bytes += bytes;
            id
        };
        if self.frontier_steps.len() < 200_000 {
            self.frontier_steps.insert(key, id);
        }
        Some(id)
    }
    fn any(&mut self, order: u64, len: u8) -> bool {
        if self.order_engine == 1 {
            return self
                .queues
                .iter()
                .any(|&(queue, qlen)| queue_buildable(queue, qlen, order, len, self.use_hold));
        }
        let key = order | ((len as u64) << 48);
        if let Some(&result) = self.existence.get(&key) {
            return result;
        }
        let mut encoded = 0u64;
        for i in 0..len {
            encoded |= (((order >> (i as u32 * 3)) & 7) + 1) << (i as u32 * 3);
        }
        let result = self
            .trie
            .accepts_order(encoded, len, self.use_hold, &mut self.scratch);
        // Retention only: exceeding the budget keeps exact uncached evaluation.
        if self.existence.len() < 200_000 {
            self.existence.insert(key, result);
        }
        result
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
    prepared_queues: Vec<(u64, u8)>,
    prepared: Option<QueuePrefixCache>,
    bulk: Vec<u32>,
    frontier_budget: Option<usize>,
    frontier_fallback: bool,
    queue_generation: u64,
    order_engine: u8,
    order_budget: Option<usize>,
    tiling_engine: u8,
    order_fallback: bool,
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
    compressed: bool,
    product_seen: FastSet<(usize, u8, u8)>,
    coverage_only: bool,
    operations: &'a [BatchOperation],
    nodes: &'a [StructuralNode],
    edges: &'a [StructuralEdge],
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
                let bits: Rc<[u64]> = if self.compressed {
                    self.queue_cache
                        .trie
                        .coverage_for_frontier(&self.queue_cache.frontiers[node.frontier as usize])
                        .into()
                } else {
                    self.queue_cache.viable(st.order, st.depth)
                };
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

        for edge in &self.edges[node.edge_start..node.edge_start + node.edge_len] {
            let op = self.operations[edge.id as usize];
            let shift3 = st.depth as u32 * 3;
            let shift4 = st.depth as u32 * 4;
            let shift2 = st.depth as u32 * 2;
            let next_order = st.order | ((op.piece as u64) << shift3);
            let mut queue_live = st.queue_live;
            if self.prefix_prune && queue_live {
                let bits = self.queue_cache.viable(next_order, st.depth + 1);
                queue_live = bits.iter().any(|&x| x != 0);
                if !queue_live {
                    crate::diagnostics::add(16, 1);
                }
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

fn valid_orders_boolean(
    base: u64,
    operations: &[BatchOperation],
    queue_cache: &mut QueuePrefixCache,
    height: u8,
    physics: Physics,
) -> Vec<u64> {
    if operations.len() > MAX_OPERATIONS || queue_cache.trie.perm.is_empty() {
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
        queue_cache: &mut QueuePrefixCache,
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
            if queue_cache.any(order, depth) {
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
            let next_order = order | ((op.piece as u64) << (depth as u32 * 3));
            if !queue_cache.any(next_order, depth + 1) {
                continue;
            }
            let cells = maps[id][cleared_rows as usize];
            if cells == 0 {
                continue;
            }
            let Some(next_board) = locked_next_board(board, op.piece, cells, height, physics)
            else {
                continue;
            };
            let next_cleared = advance_cleared_fast(board, cells, cleared_rows, height, infos);
            walk(
                operations,
                maps,
                infos,
                queue_cache,
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
        queue_cache,
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

// Root bitsets are indexed by (piece, required count). A branch intersects
// only the threshold for its new piece instead of scanning every root.
fn valid_orders_for_tiling(
    base: u64,
    operations: &[BatchOperation],
    queue_cache: &mut QueuePrefixCache,
    height: u8,
    physics: Physics,
) -> Vec<u64> {
    crate::diagnostics::add(12, 1);
    let engine = if queue_cache.order_engine == 0 {
        if operations.len() >= 8 { 4 } else { 2 }
    } else {
        queue_cache.order_engine
    };
    if engine >= 3 {
        if let Some(orders) =
            valid_orders_frontier(base, operations, queue_cache, height, physics, engine == 4)
        {
            return orders;
        }
        queue_cache.order_fallback = true;
        crate::diagnostics::add(11, 1);
    }
    valid_orders_boolean(base, operations, queue_cache, height, physics)
}

fn valid_orders_frontier(
    base: u64,
    operations: &[BatchOperation],
    queues: &mut QueuePrefixCache,
    height: u8,
    physics: Physics,
    suffix: bool,
) -> Option<Vec<u64>> {
    use pc_core::order_language::OrderLanguage;
    type Key = (u64, u16, u8, u32);
    struct Collector<'a> {
        operations: &'a [BatchOperation],
        maps: Vec<[u64; 64]>,
        infos: [ClearInfo; 64],
        queues: &'a mut QueuePrefixCache,
        height: u8,
        physics: Physics,
        language: OrderLanguage,
        memo: pc_core::FastMap<Key, u32>,
        seen: FastSet<(Key, u64)>,
        words: FastSet<u64>,
        suffix: bool,
    }
    impl Collector<'_> {
        fn visit(
            &mut self,
            board: u64,
            remaining: u16,
            cleared: u8,
            frontier: u32,
            depth: u32,
            order: u64,
        ) -> Option<u32> {
            if frontier == u32::MAX || self.queues.frontiers[frontier as usize].is_empty() {
                return Some(0);
            }
            if remaining == 0 {
                if !self.suffix {
                    self.words.insert(order);
                }
                return Some(1);
            }
            let key = (board, remaining, cleared, frontier);
            if self.suffix {
                if let Some(&id) = self.memo.get(&key) {
                    return Some(id);
                }
            } else if !self.seen.insert((key, order)) {
                return Some(0);
            }
            if self.memo.len() + self.seen.len() >= self.queues.order_budget {
                return None;
            }
            let mut children = [0; 7];
            let mut choices = remaining;
            while choices != 0 {
                let id = choices.trailing_zeros() as usize;
                choices &= choices - 1;
                let op = self.operations[id];
                let next_frontier =
                    self.queues
                        .advance(frontier, op.piece, self.queues.order_budget)?;
                if next_frontier == u32::MAX {
                    continue;
                }
                let cells = self.maps[id][cleared as usize];
                if cells == 0 {
                    continue;
                }
                let Some(next_board) =
                    locked_next_board(board, op.piece, cells, self.height, self.physics)
                else {
                    continue;
                };
                let next_cleared =
                    advance_cleared_fast(board, cells, cleared, self.height, &self.infos);
                let child = self.visit(
                    next_board,
                    remaining & !(1 << id),
                    next_cleared,
                    next_frontier,
                    depth + 1,
                    order | ((op.piece as u64) << (depth * 3)),
                )?;
                if self.suffix {
                    children[op.piece as usize] =
                        self.language.union(children[op.piece as usize], child)?;
                }
            }
            if !self.suffix {
                return Some(0);
            }
            let node = self.language.node(children)?;
            self.memo.insert(key, node);
            Some(node)
        }
    }
    if operations.len() > MAX_OPERATIONS || queues.order_budget == 0 {
        return None;
    }
    let budget = queues.order_budget;
    let mut collector = Collector {
        operations,
        maps: mapped_masks(operations, height),
        infos: clear_info_table(height),
        queues,
        height,
        physics,
        language: OrderLanguage::new(budget),
        memo: pc_core::FastMap::default(),
        seen: FastSet::default(),
        words: FastSet::default(),
        suffix,
    };
    let (board, cleared) = normalize_base(base, height);
    let root = collector.visit(
        board,
        if operations.is_empty() {
            0
        } else {
            (1 << operations.len()) - 1
        },
        cleared,
        0,
        0,
        0,
    )?;
    crate::diagnostics::add(15, collector.language.children.len() as u64);
    if suffix {
        Some(collector.language.words(root))
    } else {
        let mut words: Vec<_> = collector.words.into_iter().collect();
        words.sort_unstable();
        Some(words)
    }
}

struct MultisetIndex {
    thresholds: Vec<Vec<u64>>,
    active: Vec<u64>,
    undo: Vec<(usize, u64)>,
}
impl MultisetIndex {
    fn new(roots: &[u32]) -> Self {
        let words = roots.len().div_ceil(64);
        let mut thresholds = vec![vec![0; words]; 7 * 16];
        for (id, &root) in roots.iter().enumerate() {
            for piece in 0..7 {
                for count in 0..=((root >> (piece * 4)) & 15) as usize {
                    thresholds[piece * 16 + count][id >> 6] |= 1 << (id & 63);
                }
            }
        }
        let mut active = vec![u64::MAX; words];
        if let Some(last) = active.last_mut()
            && !roots.len().is_multiple_of(64)
        {
            *last = (1 << (roots.len() & 63)) - 1;
        }
        Self {
            thresholds,
            active,
            undo: Vec::new(),
        }
    }
    fn restrict(&mut self, piece: usize, count: u8) -> bool {
        let threshold = &self.thresholds[piece * 16 + count as usize];
        let mut live = false;
        for (id, word) in self.active.iter_mut().enumerate() {
            let next = *word & threshold[id];
            if next != *word {
                self.undo.push((id, *word));
                *word = next;
            }
            live |= next != 0;
        }
        live
    }
    fn restore(&mut self, checkpoint: usize) {
        while self.undo.len() > checkpoint {
            let (id, old) = self.undo.pop().unwrap();
            self.active[id] = old;
        }
    }
}

fn components_divisible_by_four(mut remaining: u64) -> bool {
    const LEFT: u64 = 0x004010040100401;
    const RIGHT: u64 = LEFT << 9;
    while remaining != 0 {
        let mut component = 1 << remaining.trailing_zeros();
        loop {
            let next = component
                | (remaining
                    & ((component << 10)
                        | (component >> 10)
                        | ((component & !RIGHT) << 1)
                        | ((component & !LEFT) >> 1)));
            if next == component {
                break;
            }
            component = next;
        }
        if !component.count_ones().is_multiple_of(4) {
            return false;
        }
        remaining &= !component;
    }
    true
}

struct CongruentSearch {
    base: u64,
    height: u8,
    physics: Physics,
    queue_cache: QueuePrefixCache,
    roots: MultisetIndex,
    max_counts: [u8; 7],
    placements: Vec<BatchOperation>,
    by_cell: [Vec<usize>; 60],
    by_piece: [Vec<usize>; 7],
    active: Vec<u64>,
    candidate_counts: [u16; 60],
    undo: Vec<usize>,
    negative: FastSet<(u64, u32)>,
    seen: FastSet<[u64; 7]>,
    out: Vec<CongruentSolution>,
    limit: usize,
    limit_hit: bool,
}

impl CongruentSearch {
    fn is_active(&self, id: usize) -> bool {
        self.active[id >> 6] & (1 << (id & 63)) != 0
    }
    fn deactivate(&mut self, id: usize) {
        if !self.is_active(id) {
            return;
        }
        self.active[id >> 6] &= !(1 << (id & 63));
        self.undo.push(id);
        let mut mask = self.placements[id].mask;
        while mask != 0 {
            let cell = mask.trailing_zeros() as usize;
            mask &= mask - 1;
            self.candidate_counts[cell] -= 1;
        }
    }
    fn restore(&mut self, checkpoint: usize) {
        while self.undo.len() > checkpoint {
            let id = self.undo.pop().unwrap();
            self.active[id >> 6] |= 1 << (id & 63);
            let mut mask = self.placements[id].mask;
            while mask != 0 {
                let cell = mask.trailing_zeros() as usize;
                mask &= mask - 1;
                self.candidate_counts[cell] += 1;
            }
        }
    }
    // Return geometric feasibility, independent of reachability and color.
    // Only proven negative geometry may enter the shared negative memo.
    fn recurse(
        &mut self,
        rem: u64,
        operations: &mut Vec<BatchOperation>,
        counts: &mut [u8; 7],
        packed_counts: u32,
    ) -> bool {
        crate::diagnostics::add(0, 1);
        if rem == 0 {
            let mut key = [0u64; 7];
            for op in operations.iter() {
                key[op.piece as usize] |= op.mask;
            }
            if !self.seen.insert(key) {
                return true;
            }
            let orders = valid_orders_for_tiling(
                self.base,
                operations,
                &mut self.queue_cache,
                self.height,
                self.physics,
            );
            if !orders.is_empty() {
                if self.out.len() == self.limit {
                    self.limit_hit = true;
                    return true;
                }
                self.out.push(CongruentSolution {
                    operations: operations.clone(),
                    orders,
                });
            }
            return true;
        }
        let key = (rem, packed_counts);
        if self.negative.contains(&key) {
            crate::diagnostics::add(3, 1);
            return false;
        }
        if !components_divisible_by_four(rem) {
            crate::diagnostics::add(2, 1);
            return false;
        }
        let mut best_cell = 0;
        let mut best_len = u16::MAX;
        let mut cells = rem;
        while cells != 0 {
            let cell = cells.trailing_zeros() as usize;
            cells &= cells - 1;
            let count = self.candidate_counts[cell];
            if count == 0 {
                return false;
            }
            if count < best_len {
                best_cell = cell;
                best_len = count;
                if count == 1 {
                    break;
                }
            }
        }
        // Placement IDs retain the previous per-cell insertion order.
        let candidates: Vec<_> = self.by_cell[best_cell]
            .iter()
            .copied()
            .filter(|&id| self.is_active(id))
            .collect();
        let mut feasible = false;
        for id in candidates {
            let op = self.placements[id];
            let piece = op.piece as usize;
            counts[piece] += 1;
            let root_checkpoint = self.roots.undo.len();
            if self.roots.restrict(piece, counts[piece]) {
                let checkpoint = self.undo.len();
                let mut mask = op.mask;
                while mask != 0 {
                    let cell = mask.trailing_zeros() as usize;
                    mask &= mask - 1;
                    for i in 0..self.by_cell[cell].len() {
                        self.deactivate(self.by_cell[cell][i]);
                    }
                }
                if counts[piece] == self.max_counts[piece] {
                    for i in 0..self.by_piece[piece].len() {
                        self.deactivate(self.by_piece[piece][i]);
                    }
                }
                operations.push(op);
                feasible |= self.recurse(
                    rem ^ op.mask,
                    operations,
                    counts,
                    packed_counts + (1 << (piece * 4)),
                );
                operations.pop();
                self.restore(checkpoint);
            }
            if self.roots.active.iter().all(|&word| word == 0) {
                crate::diagnostics::add(1, 1);
            }
            self.roots.restore(root_checkpoint);
            counts[piece] -= 1;
            if self.limit_hit {
                return true;
            }
        }
        if !feasible && self.negative.len() < 65_536 {
            self.negative.insert(key);
        }
        feasible
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
    if !(2..=6).contains(&height) || max_solutions == 0 || !fill.count_ones().is_multiple_of(4) {
        return false;
    }
    if ws.tiling_engine == 1 || (ws.tiling_engine == 0 && fill.count_ones() <= 16) {
        return run_congruent_scalar(ws, base, fill, height, physics, use_hold, max_solutions);
    }
    let max_counts = max_piece_counts(&ws.queues);
    let roots: Vec<_> = pc_core::PcSolver::pattern_multiset_roots(
        &ws.queues.iter().map(|q| q.0).collect::<Vec<_>>(),
        &ws.queues.iter().map(|q| q.1).collect::<Vec<_>>(),
        (fill.count_ones() / 4) as u8,
        use_hold,
    )
    .into_iter()
    .collect();
    if roots.is_empty() {
        ws.congruent.clear();
        return true;
    }
    let mut placements = Vec::new();
    let mut by_cell: [Vec<usize>; 60] = std::array::from_fn(|_| Vec::new());
    let mut by_piece: [Vec<usize>; 7] = std::array::from_fn(|_| Vec::new());
    for piece in Piece::ALL {
        if max_counts[piece as usize] == 0 {
            continue;
        }
        for op in geometric_placements(piece, height, fill) {
            let id = placements.len();
            placements.push(op);
            by_piece[piece as usize].push(id);
            for (idx, bucket) in by_cell.iter_mut().enumerate().take(height as usize * 10) {
                if op.mask & (1u64 << idx) != 0 {
                    bucket.push(id);
                }
            }
        }
    }
    let mut search = CongruentSearch {
        base,
        height,
        physics,
        queue_cache: QueuePrefixCache::new(&ws.queues, use_hold),
        roots: MultisetIndex::new(&roots),
        max_counts,
        candidate_counts: std::array::from_fn(|i| by_cell[i].len() as u16),
        active: vec![u64::MAX; placements.len().div_ceil(64)],
        placements,
        by_cell,
        by_piece,
        undo: Vec::new(),
        negative: FastSet::default(),
        seen: FastSet::default(),
        out: Vec::new(),
        limit: max_solutions,
        limit_hit: false,
    };
    search.queue_cache.order_engine = ws.order_engine;
    search.queue_cache.order_budget = ws.order_budget.unwrap_or(200_000);
    search.recurse(fill, &mut Vec::new(), &mut [0u8; 7], 0);
    ws.order_fallback = search.queue_cache.order_fallback;
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
    ws.frontier_fallback = false;
    run_engine_projection(
        coverage_only,
        coverage_only,
        ws,
        base,
        height,
        physics,
        mode,
        use_hold,
    )
}

#[allow(clippy::too_many_arguments)]
fn run_engine_projection(
    coverage_only: bool,
    compressed: bool,
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
    let cached = ws
        .prepared
        .take()
        .filter(|cache| cache.use_hold == use_hold && ws.prepared_queues == ws.queues);
    let mut queue_cache =
        Some(cached.unwrap_or_else(|| QueuePrefixCache::new(&ws.queues, use_hold)));
    let mut builder = DagBuilder {
        compressed,
        frontier_budget: ws.frontier_budget.unwrap_or(200_000),
        exhausted: false,
        queue_filter: if coverage_only {
            queue_cache.take()
        } else {
            None
        },
        operations: &ws.operations,
        maps: &maps,
        clear_infos: &infos,
        height,
        physics,
        mode,
        index: pc_core::FastMap::default(),
        nodes: Vec::new(),
        edges: Vec::new(),
    };
    let root = builder.build(StructuralKey {
        prefix: 0,
        board,
        remaining: if count == 0 { 0 } else { (1u16 << count) - 1 },
        cleared_rows,
        mode_state: 0,
    });
    if builder.exhausted {
        drop(builder);
        // Discard the incomplete graph and retry the exact prefix engine.
        ws.frontier_fallback = true;
        crate::diagnostics::add(11, 1);
        return run_engine_projection(
            coverage_only,
            false,
            ws,
            base,
            height,
            physics,
            mode,
            use_hold,
        );
    }
    crate::diagnostics::add(8, builder.nodes.len() as u64);
    crate::diagnostics::add(9, builder.edges.len() as u64);
    let covered_words = ws.queues.len().div_ceil(64);
    let mut collector = PathCollector {
        compressed,
        product_seen: FastSet::default(),
        coverage_only,
        operations: &ws.operations,
        nodes: &builder.nodes,
        edges: &builder.edges,
        mode,
        terminal: FastSet::default(),
        variants: Vec::new(),
        queue_cache: builder
            .queue_filter
            .take()
            .unwrap_or_else(|| queue_cache.take().expect("queue projector")),
        covered_bits: vec![0u64; covered_words],
        prefix_prune: !coverage_only && ws.queues.len() <= 512,
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
    if crate::common::in_session() {
        ws.prepared_queues.clone_from(&ws.queues);
        ws.prepared = Some(collector.queue_cache);
    }
    true
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_reset() {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        ws.operations.clear();
        ws.queues.clear();
        ws.queue_generation = ws.queue_generation.wrapping_add(1).max(1);
        ws.variants.clear();
        ws.covered.clear();
        ws.congruent.clear();
        ws.bulk.clear();
        if !crate::common::in_session() {
            ws.prepared = None;
            ws.prepared_queues.clear();
        }
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
        let mut ws = cell.borrow_mut();
        ws.queue_generation = ws.queue_generation.wrapping_add(1).max(1);
        ws.queues.push((queue, len as u8));
        crate::diagnostics::add(13, 1);
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
        ws.order_fallback = false;
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

#[unsafe(no_mangle)]
pub extern "C" fn batch_session_begin() {
    crate::common::begin_session();
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_session_end() {
    crate::common::end_session();
    if !crate::common::in_session() {
        WORKSPACE.with(|cell| {
            let mut ws = cell.borrow_mut();
            ws.prepared = None;
            ws.prepared_queues.clear();
            ws.queue_generation = ws.queue_generation.wrapping_add(1).max(1);
        });
    }
}
// Owned JS copies are made before any subsequent call can grow WASM memory.
// Each variant occupies six u32 words: IDs lo/hi, clears lo/hi, spins, PC mask.
#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_variants_ptr() -> *const u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        let mut bulk = std::mem::take(&mut ws.bulk);
        bulk.clear();
        for v in &ws.variants {
            bulk.extend_from_slice(&[
                v.ids as u32,
                (v.ids >> 32) as u32,
                v.clears as u32,
                (v.clears >> 32) as u32,
                v.tspins,
                v.pc_mask as u32,
            ]);
        }
        crate::diagnostics::add(14, bulk.len() as u64);
        ws.bulk = bulk;
        ws.bulk.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_covered_ptr() -> *const u8 {
    WORKSPACE.with(|cell| cell.borrow().covered.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_set_frontier_budget(nodes: u32) {
    WORKSPACE.with(|cell| cell.borrow_mut().frontier_budget = Some((nodes as usize).min(200_000)));
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_frontier_fallback() -> u32 {
    WORKSPACE.with(|cell| cell.borrow().frontier_fallback as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_max_height() -> u32 {
    6
}

// Handles are valid only inside the owning synchronous session. Any queue
// mutation/reset or outer session exit advances the generation.
#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_queue_handle() -> u64 {
    if !crate::common::in_session() {
        return 0;
    }
    WORKSPACE.with(|cell| cell.borrow().queue_generation)
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_reset_with_queues(handle: u64) -> u32 {
    if handle == 0 || !crate::common::in_session() {
        return 0;
    }
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        if ws.queue_generation != handle {
            return 0;
        }
        ws.operations.clear();
        ws.variants.clear();
        ws.covered.clear();
        ws.congruent.clear();
        ws.bulk.clear();
        1
    })
}

// Each solution is [operation count, order count], then operations (piece,
// mask lo/hi) and orders (lo/hi). Consumers copy before another engine call.
#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_words_ptr() -> *const u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        let mut bulk = std::mem::take(&mut ws.bulk);
        bulk.clear();
        for solution in &ws.congruent {
            bulk.extend_from_slice(&[
                solution.operations.len() as u32,
                solution.orders.len() as u32,
            ]);
            for op in &solution.operations {
                bulk.extend_from_slice(&[op.piece as u32, op.mask as u32, (op.mask >> 32) as u32]);
            }
            for &order in &solution.orders {
                bulk.extend_from_slice(&[order as u32, (order >> 32) as u32]);
            }
        }
        crate::diagnostics::add(14, bulk.len() as u64);
        ws.bulk = bulk;
        ws.bulk.as_ptr()
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_bulk_word_count() -> u32 {
    WORKSPACE.with(|cell| cell.borrow().bulk.len() as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_covered_count() -> u32 {
    WORKSPACE.with(|cell| cell.borrow().covered.iter().filter(|&&x| x != 0).count() as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_engine_covered_indices_ptr() -> *const u32 {
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        let mut bulk = std::mem::take(&mut ws.bulk);
        bulk.clear();
        for (index, &covered) in ws.covered.iter().enumerate() {
            if covered != 0 {
                bulk.push(index as u32);
            }
        }
        crate::diagnostics::add(14, bulk.len() as u64);
        ws.bulk = bulk;
        ws.bulk.as_ptr()
    })
}

struct ScalarCongruentSearch {
    base: u64,
    height: u8,
    physics: Physics,
    queue_cache: QueuePrefixCache,
    multiset_roots: Vec<u32>,
    max_counts: [u8; 7],
    by_cell: [Vec<BatchOperation>; 60],
    seen: FastSet<[u64; 7]>,
    out: Vec<CongruentSolution>,
    limit: usize,
    limit_hit: bool,
}

impl ScalarCongruentSearch {
    fn recurse(&mut self, rem: u64, operations: &mut Vec<BatchOperation>, counts: &mut [u8; 7]) {
        crate::diagnostics::add(0, 1);
        if !self.multiset_roots.iter().any(|&root| {
            counts
                .iter()
                .enumerate()
                .all(|(piece, &used)| used as u32 <= (root >> (piece * 4)) & 15)
        }) {
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
                &mut self.queue_cache,
                self.height,
                self.physics,
            );
            if !orders.is_empty() {
                if self.out.len() == self.limit {
                    self.limit_hit = true;
                    return;
                }
                self.out.push(CongruentSolution {
                    operations: operations.clone(),
                    orders,
                });
            }
            return;
        }

        let mut best_cell = None;
        let mut best_len = usize::MAX;
        for idx in 0..self.height as usize * 10 {
            if rem & (1u64 << idx) == 0 {
                continue;
            }
            let count = self.by_cell[idx]
                .iter()
                .filter(|op| {
                    counts[op.piece as usize] < self.max_counts[op.piece as usize]
                        && op.mask & rem == op.mask
                })
                .take(best_len)
                .count();
            if count == 0 {
                return;
            }
            if count < best_len {
                best_cell = Some(idx);
                best_len = count;
                if count == 1 {
                    break;
                }
            }
        }
        let Some(idx) = best_cell else {
            return;
        };
        // Allocate only the chosen cell's candidates, retaining legacy order.
        let candidates: Vec<_> = self.by_cell[idx]
            .iter()
            .copied()
            .filter(|op| {
                counts[op.piece as usize] < self.max_counts[op.piece as usize]
                    && op.mask & rem == op.mask
            })
            .collect();
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

fn run_congruent_scalar(
    ws: &mut BatchWorkspace,
    base: u64,
    fill: u64,
    height: u8,
    physics: Physics,
    use_hold: bool,
    max_solutions: usize,
) -> bool {
    if !(2..=6).contains(&height) || max_solutions == 0 || !fill.count_ones().is_multiple_of(4) {
        return false;
    }
    let max_counts = max_piece_counts(&ws.queues);
    let mut by_cell: [Vec<BatchOperation>; 60] = std::array::from_fn(|_| Vec::new());
    for piece in Piece::ALL {
        for op in geometric_placements(piece, height, fill) {
            for (idx, bucket) in by_cell.iter_mut().enumerate().take(height as usize * 10) {
                if op.mask & (1u64 << idx) != 0 {
                    bucket.push(op);
                }
            }
        }
    }
    let mut search = ScalarCongruentSearch {
        base,
        height,
        physics,
        queue_cache: QueuePrefixCache::new(&ws.queues, use_hold),
        multiset_roots: pc_core::PcSolver::pattern_multiset_roots(
            &ws.queues.iter().map(|q| q.0).collect::<Vec<_>>(),
            &ws.queues.iter().map(|q| q.1).collect::<Vec<_>>(),
            (fill.count_ones() / 4) as u8,
            use_hold,
        )
        .into_iter()
        .collect(),
        max_counts,
        by_cell,
        seen: FastSet::default(),
        out: Vec::new(),
        limit: max_solutions,
        limit_hit: false,
    };
    search.queue_cache.order_engine = ws.order_engine;
    search.queue_cache.order_budget = ws.order_budget.unwrap_or(200_000);
    search.recurse(fill, &mut Vec::new(), &mut [0u8; 7]);
    ws.order_fallback = search.queue_cache.order_fallback;
    if search.limit_hit {
        return false;
    }
    ws.congruent = search.out;
    true
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_set_engines(tiling: u32, orders: u32, budget: u32) -> u32 {
    if tiling > 2 || orders > 4 || budget > 200_000 {
        return 0;
    }
    WORKSPACE.with(|cell| {
        let mut ws = cell.borrow_mut();
        ws.tiling_engine = tiling as u8;
        ws.order_engine = orders as u8;
        ws.order_budget = Some(budget as usize);
    });
    1
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_congruent_order_fallback() -> u32 {
    WORKSPACE.with(|cell| cell.borrow().order_fallback as u32)
}
