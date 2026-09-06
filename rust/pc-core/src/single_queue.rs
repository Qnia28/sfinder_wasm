use super::*;

// Search topology and solution colouring are deliberately separate.  A DAG
// node contains only information that can affect the future; past piece masks
// are carried by edges and reconstructed after the structural search.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct StructuralState {
    board: u64,
    idx: u8,
    hold: u8,
    placed: u8,
}

trait StructuralKey {
    type Key: Copy + Eq + Hash;
    fn make(st: StructuralState) -> Self::Key;
}

struct FastStructuralKey;
impl StructuralKey for FastStructuralKey {
    type Key = u64;
    #[inline]
    fn make(st: StructuralState) -> u64 {
        debug_assert_eq!(st.board >> 40, 0);
        st.board | ((st.idx as u64) << 40) | ((st.hold as u64) << 44) | ((st.placed as u64) << 47)
    }
}

struct CompatStructuralKey;
impl StructuralKey for CompatStructuralKey {
    type Key = u128;
    #[inline]
    fn make(st: StructuralState) -> u128 {
        (st.board as u128)
            | ((st.idx as u128) << 64)
            | ((st.hold as u128) << 72)
            | ((st.placed as u128) << 80)
    }
}

trait CompletionKey {
    type Key: Copy + Eq + Hash;
    fn make(board: u64, qlen: u8, hold: u8) -> Self::Key;
}

struct FastCompletionKey;
impl CompletionKey for FastCompletionKey {
    type Key = u64;
    #[inline]
    fn make(board: u64, qlen: u8, hold: u8) -> u64 {
        board | ((qlen as u64) << 40) | ((hold as u64) << 45)
    }
}

struct CompatCompletionKey;
impl CompletionKey for CompatCompletionKey {
    type Key = u128;
    #[inline]
    fn make(board: u64, qlen: u8, hold: u8) -> u128 {
        (board as u128) | ((qlen as u128) << 60) | ((hold as u128) << 65)
    }
}

impl PcSolver {
    /// Exact existence if the bounded DFS finishes; None never means failure.
    /// Only placement entries are retained. The incomplete dead memo is local.
    pub fn probe_can_pc_packed(
        &mut self,
        board: u64,
        qbits: u64,
        qlen: u8,
        use_hold: bool,
        budget: u64,
    ) -> Option<bool> {
        self.trim_cache_between_requests();
        self.probe_node_limit = self.nodes.saturating_add(budget);
        self.probe_exhausted = false;
        let result = if self.height <= 4 {
            self.can_pc_packed_with_dead::<FastCompletionKey, true>(
                board,
                qbits,
                qlen,
                use_hold,
                &mut FastSet::default(),
            )
        } else {
            self.can_pc_packed_with_dead::<CompatCompletionKey, true>(
                board,
                qbits,
                qlen,
                use_hold,
                &mut FastSet::default(),
            )
        };
        self.probe_node_limit = u64::MAX;
        if result {
            Some(true)
        } else if self.probe_exhausted {
            None
        } else {
            Some(false)
        }
    }
    pub fn can_pc(&mut self, board: u64, queue: &[Piece], use_hold: bool) -> bool {
        let mut qbits = 0u64;
        for (i, &piece) in queue.iter().enumerate() {
            qbits |= (piece as u64) << (i * 3);
        }
        self.can_pc_packed(board, qbits, queue.len() as u8, use_hold)
    }

    pub fn can_pc_packed(&mut self, board: u64, qbits: u64, qlen: u8, use_hold: bool) -> bool {
        self.trim_cache_between_requests();
        if self.height <= 4 {
            let mut dead: FastSet<u64> = FastSet::default();
            self.can_pc_packed_with_dead::<FastCompletionKey, false>(
                board, qbits, qlen, use_hold, &mut dead,
            )
        } else {
            let mut dead: FastSet<u128> = FastSet::default();
            self.can_pc_packed_with_dead::<CompatCompletionKey, false>(
                board, qbits, qlen, use_hold, &mut dead,
            )
        }
    }

    pub fn can_pc_many_packed(
        &mut self,
        board: u64,
        qbits: &[u64],
        qlens: &[u8],
        use_hold: bool,
        out: &mut [u8],
    ) -> bool {
        if qbits.len() != qlens.len() || qbits.len() != out.len() || qlens.iter().any(|&n| n > 21) {
            return false;
        }
        // Keep the established 2..=4-line batch path unchanged: a compact
        // u64 dead-state memo is reused across queues but cleared per root.
        if self.height <= 4 {
            let mut dead: FastSet<u64> = FastSet::default();
            for i in 0..qbits.len() {
                self.trim_cache_between_requests();
                dead.clear();
                out[i] = self.can_pc_packed_with_dead::<FastCompletionKey, false>(
                    board, qbits[i], qlens[i], use_hold, &mut dead,
                ) as u8;
            }
        } else {
            // Compatibility mode needs 60 board bits, so its memo key uses
            // u128. Allocation is still reused across the batch and bounded
            // by the hardest single concrete queue.
            let mut dead: FastSet<u128> = FastSet::default();
            for i in 0..qbits.len() {
                self.trim_cache_between_requests();
                dead.clear();
                out[i] = self.can_pc_packed_with_dead::<CompatCompletionKey, false>(
                    board, qbits[i], qlens[i], use_hold, &mut dead,
                ) as u8;
            }
        }
        true
    }

    fn can_pc_packed_with_dead<K: CompletionKey, const BOUNDED: bool>(
        &mut self,
        board: u64,
        qbits: u64,
        qlen: u8,
        use_hold: bool,
        dead: &mut FastSet<K::Key>,
    ) -> bool {
        if qlen > 21 {
            return false;
        }
        let total = self.height as u32 * 10;
        let empty = total.saturating_sub(board.count_ones());
        if !empty.is_multiple_of(4) {
            return false;
        }
        let req = (empty / 4) as u8;
        if qlen < req || !self.legal_accept(board) {
            return false;
        }
        self.dfs_packed::<K, BOUNDED>(board, qbits, qlen, 7, req, use_hold, dead)
    }

    #[allow(clippy::too_many_arguments)]
    fn dfs_packed<K: CompletionKey, const BOUNDED: bool>(
        &mut self,
        b: u64,
        qbits: u64,
        qlen: u8,
        hold: u8,
        remaining: u8,
        use_hold: bool,
        dead: &mut FastSet<K::Key>,
    ) -> bool {
        if BOUNDED && self.nodes >= self.probe_node_limit {
            self.probe_exhausted = true;
            return false;
        }
        self.nodes += 1;
        if b == full_board(self.height) {
            return true;
        }
        if remaining == 0 || (self.height as u32 * 10 - b.count_ones()) != remaining as u32 * 4 {
            return false;
        }
        let key = K::make(b, qlen, hold);
        if dead.contains(&key) {
            self.memo_hits += 1;
            return false;
        }
        if qlen > 0 {
            let cur = Self::packed_piece(qbits, 0).unwrap();
            let after_cur_bits = qbits >> 3;
            let after_cur_len = qlen - 1;
            if self.stage8_pair_allows(
                b,
                cur,
                Self::next_piece_mask_packed(after_cur_bits, after_cur_len, hold, use_hold),
                remaining,
            ) {
                let set = self.placement_set_for_remaining(b, cur, remaining);
                for placement in set.placements.iter() {
                    let nb = placement.board;
                    if self.dfs_packed::<K, BOUNDED>(
                        nb,
                        after_cur_bits,
                        after_cur_len,
                        hold,
                        remaining - 1,
                        use_hold,
                        dead,
                    ) {
                        return true;
                    }
                }
            }
            if use_hold {
                if hold == 7 {
                    if qlen > 1 {
                        let nxt = Self::packed_piece(qbits, 1).unwrap();
                        let after_two_bits = qbits >> 6;
                        let after_two_len = qlen - 2;
                        if self.stage8_pair_allows(
                            b,
                            nxt,
                            Self::next_piece_mask_packed(
                                after_two_bits,
                                after_two_len,
                                cur as u8,
                                use_hold,
                            ),
                            remaining,
                        ) {
                            let set = self.placement_set_for_remaining(b, nxt, remaining);
                            for placement in set.placements.iter() {
                                let nb = placement.board;
                                if self.dfs_packed::<K, BOUNDED>(
                                    nb,
                                    after_two_bits,
                                    after_two_len,
                                    cur as u8,
                                    remaining - 1,
                                    use_hold,
                                    dead,
                                ) {
                                    return true;
                                }
                            }
                        }
                    }
                } else {
                    let hp = Piece::from_u8(hold).unwrap();
                    if self.stage8_pair_allows(
                        b,
                        hp,
                        Self::next_piece_mask_packed(
                            after_cur_bits,
                            after_cur_len,
                            cur as u8,
                            use_hold,
                        ),
                        remaining,
                    ) {
                        let set = self.placement_set_for_remaining(b, hp, remaining);
                        for placement in set.placements.iter() {
                            let nb = placement.board;
                            if self.dfs_packed::<K, BOUNDED>(
                                nb,
                                after_cur_bits,
                                after_cur_len,
                                cur as u8,
                                remaining - 1,
                                use_hold,
                                dead,
                            ) {
                                return true;
                            }
                        }
                    }
                }
            }
        } else if use_hold && hold != 7 {
            let hp = Piece::from_u8(hold).unwrap();
            if self.stage8_pair_allows(b, hp, 0, remaining) {
                let set = self.placement_set_for_remaining(b, hp, remaining);
                for placement in set.placements.iter() {
                    let nb = placement.board;
                    if self.dfs_packed::<K, BOUNDED>(nb, 0, 0, 7, remaining - 1, use_hold, dead) {
                        return true;
                    }
                }
            }
        }
        dead.insert(key);
        false
    }
    #[inline]
    fn terminal_saved_piece(queue: &[Piece], next_idx: u8, next_hold: u8) -> u8 {
        let mut saved = 7u8;
        let mut remaining = 0u8;
        if next_hold != 7 {
            saved = next_hold;
            remaining += 1;
        }
        for &piece in &queue[next_idx as usize..] {
            saved = piece as u8;
            remaining += 1;
            if remaining > 1 {
                return 7;
            }
        }
        if remaining == 1 { saved } else { 7 }
    }

    fn ensure_structural_state<K: StructuralKey>(
        st: StructuralState,
        state_ids: &mut FastMap<K::Key, u32>,
        states: &mut Vec<StructuralState>,
        nodes: &mut Vec<FlatDagNode>,
    ) -> u32 {
        let key = K::make(st);
        if let Some(&id) = state_ids.get(&key) {
            return id;
        }
        let id = states.len() as u32;
        state_ids.insert(key, id);
        states.push(st);
        nodes.push(FlatDagNode::default());
        id
    }

    #[allow(clippy::too_many_arguments)]
    fn push_structural_transition<K: StructuralKey>(
        &mut self,
        st: StructuralState,
        piece: Piece,
        next_idx: u8,
        next_hold: u8,
        pl: Placement,
        queue: &[Piece],
        req: u8,
        state_ids: &mut FastMap<K::Key, u32>,
        states: &mut Vec<StructuralState>,
        nodes: &mut Vec<FlatDagNode>,
        edges: &mut Vec<DagEdge>,
    ) {
        let next_placed = st.placed + 1;
        if pl.board == full_board(self.height) {
            if next_placed == req {
                edges.push(DagEdge {
                    raw_board: pl.raw_board,
                    next: TERMINAL_NODE,
                    piece,
                    orientation: pl.orientation,
                    x: pl.x,
                    y: pl.y,
                    saved: Self::terminal_saved_piece(queue, next_idx, next_hold),
                });
            }
            return;
        }
        if next_placed >= req {
            return;
        }
        let remaining_cells = self.height as u32 * 10 - pl.board.count_ones();
        if remaining_cells != (req - next_placed) as u32 * 4 {
            return;
        }
        let child = Self::ensure_structural_state::<K>(
            StructuralState {
                board: pl.board,
                idx: next_idx,
                hold: next_hold,
                placed: next_placed,
            },
            state_ids,
            states,
            nodes,
        );
        edges.push(DagEdge {
            raw_board: pl.raw_board,
            next: child,
            piece,
            orientation: pl.orientation,
            x: pl.x,
            y: pl.y,
            saved: 7,
        });
    }

    // Concrete-queue search and pattern search use the same flat DAG storage.
    // Building iteratively keeps every node's outgoing edges contiguous and
    // avoids recursive child construction plus per-node Vec allocations.
    fn build_structural_dag(
        &mut self,
        initial: u64,
        queue: &[Piece],
        use_hold: bool,
    ) -> Option<(FlatDag, u32, u8, u8)> {
        if self.height <= 4 {
            self.build_structural_dag_keyed::<FastStructuralKey>(initial, queue, use_hold)
        } else {
            self.build_structural_dag_keyed::<CompatStructuralKey>(initial, queue, use_hold)
        }
    }

    fn build_structural_dag_keyed<K: StructuralKey>(
        &mut self,
        initial: u64,
        queue: &[Piece],
        use_hold: bool,
    ) -> Option<(FlatDag, u32, u8, u8)> {
        self.trim_cache_between_requests();
        let total = self.height as u32 * 10;
        let empty = total.saturating_sub(initial.count_ones());
        if !empty.is_multiple_of(4) {
            return None;
        }
        let req = (empty / 4) as u8;
        if queue.len() < req as usize || !self.legal_accept(initial) {
            return None;
        }
        let mut initial_cleared = 0u8;
        for y in 0..self.height {
            if row(initial, y) == FULL_ROW {
                initial_cleared |= 1 << y;
            }
        }
        let start = StructuralState {
            board: normalize_after_placement(initial, self.height),
            idx: 0,
            hold: 7,
            placed: 0,
        };
        let mut state_ids = FastMap::default();
        let mut states = Vec::new();
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let root =
            Self::ensure_structural_state::<K>(start, &mut state_ids, &mut states, &mut nodes);
        let n = queue.len() as u8;
        let mut cursor = 0usize;
        while cursor < states.len() {
            let st = states[cursor];
            self.nodes += 1;
            let remaining = req - st.placed;
            let edge_start = edges.len();
            if st.idx < n {
                let cur = queue[st.idx as usize];
                if self.stage8_pair_allows(
                    st.board,
                    cur,
                    Self::next_piece_mask(queue, st.idx + 1, st.hold, use_hold),
                    remaining,
                ) {
                    let set = self.placement_set_for_remaining(st.board, cur, remaining);
                    for &pl in set.placements.iter() {
                        self.push_structural_transition::<K>(
                            st,
                            cur,
                            st.idx + 1,
                            st.hold,
                            pl,
                            queue,
                            req,
                            &mut state_ids,
                            &mut states,
                            &mut nodes,
                            &mut edges,
                        );
                    }
                }
                if use_hold {
                    if st.hold == 7 {
                        if st.idx + 1 < n {
                            let next_piece = queue[st.idx as usize + 1];
                            if self.stage8_pair_allows(
                                st.board,
                                next_piece,
                                Self::next_piece_mask(queue, st.idx + 2, cur as u8, use_hold),
                                remaining,
                            ) {
                                let set = self
                                    .placement_set_for_remaining(st.board, next_piece, remaining);
                                for &pl in set.placements.iter() {
                                    self.push_structural_transition::<K>(
                                        st,
                                        next_piece,
                                        st.idx + 2,
                                        cur as u8,
                                        pl,
                                        queue,
                                        req,
                                        &mut state_ids,
                                        &mut states,
                                        &mut nodes,
                                        &mut edges,
                                    );
                                }
                            }
                        }
                    } else {
                        let held = Piece::from_u8(st.hold).unwrap();
                        // Swapping equal piece types is structurally identical
                        // to using the active piece directly, so skip the
                        // duplicate transition instead of hashing every edge.
                        if held != cur
                            && self.stage8_pair_allows(
                                st.board,
                                held,
                                Self::next_piece_mask(queue, st.idx + 1, cur as u8, use_hold),
                                remaining,
                            )
                        {
                            let set = self.placement_set_for_remaining(st.board, held, remaining);
                            for &pl in set.placements.iter() {
                                self.push_structural_transition::<K>(
                                    st,
                                    held,
                                    st.idx + 1,
                                    cur as u8,
                                    pl,
                                    queue,
                                    req,
                                    &mut state_ids,
                                    &mut states,
                                    &mut nodes,
                                    &mut edges,
                                );
                            }
                        }
                    }
                }
            } else if use_hold && st.hold != 7 {
                let held = Piece::from_u8(st.hold).unwrap();
                if self.stage8_pair_allows(st.board, held, 0, remaining) {
                    let set = self.placement_set_for_remaining(st.board, held, remaining);
                    for &pl in set.placements.iter() {
                        self.push_structural_transition::<K>(
                            st,
                            held,
                            st.idx,
                            7,
                            pl,
                            queue,
                            req,
                            &mut state_ids,
                            &mut states,
                            &mut nodes,
                            &mut edges,
                        );
                    }
                }
            }
            nodes[cursor] = FlatDagNode {
                edge_start: edge_start as u32,
                edge_len: (edges.len() - edge_start) as u32,
            };
            cursor += 1;
        }
        let mut dag = FlatDag {
            productive: vec![0u8; nodes.len()],
            nodes,
            edges,
        };
        if !flat_dag_productive(&mut dag, root) {
            None
        } else {
            Some((dag, root, req, initial_cleared))
        }
    }

    fn enumerate_compact(
        &mut self,
        initial: u64,
        queue: &[Piece],
        use_hold: bool,
    ) -> FastMap<CompactSolution, FastSet<u64>> {
        let Some((dag, root, _req, initial_cleared)) =
            self.build_structural_dag(initial, queue, use_hold)
        else {
            return FastMap::default();
        };
        let mut solutions = FastMap::default();
        let reconstruction = collect_flat_dag_paths(
            self.height,
            &dag,
            root,
            DagPathState {
                depth: 0,
                cleared_rows: initial_cleared,
                compact: CompactSolution::default(),
                order_bits: 0,
            },
            &mut solutions,
        );
        self.reconstruction_visits += reconstruction.visits;
        self.reconstruction_skipped += reconstruction.skipped;
        solutions
    }

    pub fn enumerate_pc(&mut self, initial: u64, queue: &[Piece], use_hold: bool) -> Vec<Solution> {
        let compact = self.enumerate_compact(initial, queue, use_hold);
        let mut out: Vec<_> = compact
            .into_iter()
            .map(|(solution, orders)| {
                debug_assert!(!orders.is_empty());
                Solution {
                    masks: solution.masks(self.height),
                    order_count: orders.len().min(u32::MAX as usize) as u32,
                }
            })
            .collect();
        out.sort_by_key(|solution| solution.masks);
        out
    }

    // Exact single-queue preferred solution. This preserves the existing
    // qniapc ranking (highest playable-order count, then lexicographic Fumen
    // mask key) while keeping all filtering and reduction inside Rust.
    pub fn best_pc(&mut self, initial: u64, queue: &[Piece], use_hold: bool) -> Option<Solution> {
        let compact = self.enumerate_compact(initial, queue, use_hold);
        let mut best: Option<Solution> = None;
        for (solution, orders) in compact {
            debug_assert!(!orders.is_empty());
            let candidate = Solution {
                masks: solution.masks(self.height),
                order_count: orders.len().min(u32::MAX as usize) as u32,
            };
            let replace = match &best {
                None => true,
                Some(current) if candidate.order_count != current.order_count => {
                    candidate.order_count > current.order_count
                }
                Some(current) => Self::solution_key_cmp(&candidate.masks, &current.masks).is_lt(),
            };
            if replace {
                best = Some(candidate);
            }
        }
        best
    }

    fn write_solution_key(masks: &[u64; 7], output: &mut [u8; 118]) -> usize {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut cursor = 0usize;
        for (piece_index, &mask) in masks.iter().enumerate() {
            if piece_index != 0 {
                output[cursor] = b':';
                cursor += 1;
            }
            if mask == 0 {
                output[cursor] = b'0';
                cursor += 1;
                continue;
            }
            let leading_nibbles = mask.leading_zeros() as usize / 4;
            for nibble_index in leading_nibbles..16 {
                let shift = (15 - nibble_index) * 4;
                output[cursor] = HEX[((mask >> shift) & 0x0f) as usize];
                cursor += 1;
            }
        }
        cursor
    }

    pub(super) fn solution_key_cmp(left: &[u64; 7], right: &[u64; 7]) -> std::cmp::Ordering {
        let mut left_key = [0u8; 118];
        let mut right_key = [0u8; 118];
        let left_len = Self::write_solution_key(left, &mut left_key);
        let right_len = Self::write_solution_key(right, &mut right_key);
        left_key[..left_len].cmp(&right_key[..right_len])
    }

    #[cfg(test)]
    pub(super) fn solution_key(masks: &[u64; 7]) -> String {
        format!(
            "{:x}:{:x}:{:x}:{:x}:{:x}:{:x}:{:x}",
            masks[0], masks[1], masks[2], masks[3], masks[4], masks[5], masks[6]
        )
    }

    pub fn saved_piece_for_solution(queue: &[Piece], solution: &Solution) -> u8 {
        let mut remaining = [0i16; 7];
        for &piece in queue {
            remaining[piece as usize] += 1;
        }
        for piece in Piece::ALL {
            let used = (solution.masks[piece as usize].count_ones() / 4) as i16;
            remaining[piece as usize] -= used;
            if remaining[piece as usize] < 0 {
                return 7;
            }
        }
        let mut saved = 7u8;
        let mut total = 0i16;
        for piece in Piece::ALL {
            let count = remaining[piece as usize];
            total += count;
            if count > 0 {
                if count != 1 || saved != 7 {
                    return 7;
                }
                saved = piece as u8;
            }
        }
        if total == 1 { saved } else { 7 }
    }

    // Return the save-piece set reachable from a DAG node.  Because every
    // edge advances `placed`, the graph is acyclic even when multiple paths
    // merge into the same structural state.
    #[allow(dead_code)]
    fn reachable_save_mask(dag: &FlatDag, node: u32, memo: &mut [u8]) -> u8 {
        let cached = memo[node as usize];
        if cached != u8::MAX {
            return cached;
        }
        let mut mask = 0u8;
        for edge in dag.edges(node) {
            if edge.next == TERMINAL_NODE {
                if edge.saved < 7 {
                    mask |= 1 << edge.saved;
                }
            } else {
                mask |= Self::reachable_save_mask(dag, edge.next, memo);
            }
        }
        memo[node as usize] = mask;
        mask
    }

    #[inline]
    #[allow(dead_code)]
    fn candidate_quota_full(mask: u8, limit: usize, out: &[Vec<CompactSolution>; 7]) -> bool {
        Piece::ALL
            .iter()
            .all(|&piece| mask & (1 << piece as u8) == 0 || out[piece as usize].len() >= limit)
    }

    // Traverse the successful DAG only once and retain at most `limit`
    // distinct geometries for every reachable save piece.  This replaces the
    // older per-save repeated traversal while preserving bounded Top-K work.
    #[allow(clippy::too_many_arguments)]
    #[allow(dead_code)]
    fn collect_save_candidates(
        height: u8,
        dag: &FlatDag,
        node: u32,
        cleared_rows: u8,
        compact: CompactSolution,
        reachable_mask: u8,
        limit: usize,
        seen: &mut [FastSet<CompactSolution>; 7],
        out: &mut [Vec<CompactSolution>; 7],
    ) -> bool {
        for edge in dag.edges(node) {
            let Some((next_cleared, original_mask)) = map_placement_to_original(
                height,
                cleared_rows,
                edge.piece,
                edge.orientation,
                edge.x,
                edge.y,
                edge.raw_board,
            ) else {
                continue;
            };
            let next_compact = compact.with_piece_mask(edge.piece, original_mask);
            if edge.next == TERMINAL_NODE {
                if edge.saved < 7 {
                    let index = edge.saved as usize;
                    if out[index].len() < limit && seen[index].insert(next_compact) {
                        out[index].push(next_compact);
                    }
                }
            } else if Self::collect_save_candidates(
                height,
                dag,
                edge.next,
                next_cleared,
                next_compact,
                reachable_mask,
                limit,
                seen,
                out,
            ) {
                return true;
            }
            if Self::candidate_quota_full(reachable_mask, limit, out) {
                return true;
            }
        }
        false
    }

    // Count the distinct piece-type placement orders that lead to one selected
    // geometry.  This second pass only follows edges whose cells belong to the
    // candidate, so it avoids materializing unrelated PC solutions.
    #[allow(clippy::too_many_arguments)]
    #[allow(dead_code)]
    fn collect_candidate_orders(
        height: u8,
        dag: &FlatDag,
        node: u32,
        depth: u8,
        cleared_rows: u8,
        compact: CompactSolution,
        target: CompactSolution,
        target_masks: &[u64; 7],
        order_bits: u64,
        orders: &mut FastSet<u64>,
    ) {
        for edge in dag.edges(node) {
            let Some((next_cleared, original_mask)) = map_placement_to_original(
                height,
                cleared_rows,
                edge.piece,
                edge.orientation,
                edge.x,
                edge.y,
                edge.raw_board,
            ) else {
                continue;
            };
            let allowed = target_masks[edge.piece as usize];
            if original_mask & !allowed != 0 {
                continue;
            }
            let next_compact = compact.with_piece_mask(edge.piece, original_mask);
            let next_order = order_bits | ((edge.piece as u64 + 1) << (depth as u32 * 3));
            if edge.next == TERMINAL_NODE {
                if next_compact == target {
                    orders.insert(next_order);
                }
            } else {
                Self::collect_candidate_orders(
                    height,
                    dag,
                    edge.next,
                    depth + 1,
                    next_cleared,
                    next_compact,
                    target,
                    target_masks,
                    next_order,
                    orders,
                );
            }
        }
    }

    pub fn per_save_best(
        &mut self,
        initial: u64,
        queue: &[Piece],
        use_hold: bool,
        _candidate_limit: usize,
    ) -> Vec<(Piece, Solution)> {
        let compact = self.enumerate_compact(initial, queue, use_hold);
        if compact.is_empty() {
            return Vec::new();
        }

        // Exact per-save ranking: maximize playable-order count for each saved
        // piece, then apply the same stable solution-key tie as full enumeration.
        // candidate_limit remains in the ABI for compatibility but no longer
        // bounds or approximates production results.
        let mut best: [Option<(CompactSolution, u32)>; 7] = [None; 7];
        for (solution, orders) in compact {
            debug_assert!(!orders.is_empty());
            let candidate = Solution {
                masks: solution.masks(self.height),
                order_count: orders.len().min(u32::MAX as usize) as u32,
            };
            let saved = Self::saved_piece_for_solution(queue, &candidate);
            if saved >= 7 {
                continue;
            }
            let slot = &mut best[saved as usize];
            let replace = match *slot {
                None => true,
                Some((_current, current_count)) if candidate.order_count != current_count => {
                    candidate.order_count > current_count
                }
                Some((current, _)) => {
                    let current_masks = current.masks(self.height);
                    Self::solution_key_cmp(&candidate.masks, &current_masks).is_lt()
                }
            };
            if replace {
                *slot = Some((solution, candidate.order_count));
            }
        }

        let mut out = Vec::new();
        for saved_piece in Piece::ALL {
            if let Some((solution, order_count)) = best[saved_piece as usize] {
                out.push((
                    saved_piece,
                    Solution {
                        masks: solution.masks(self.height),
                        order_count,
                    },
                ));
            }
        }
        out
    }
}
