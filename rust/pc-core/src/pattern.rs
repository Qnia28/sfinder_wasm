use super::*;

// Compatibility-mode pattern enumeration separates geometry from queue order.
// `remaining_counts` packs seven 4-bit piece counters (I,J,L,O,S,T,Z).
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct MultisetState {
    board: u64,
    remaining_counts: u32,
}

impl PcSolver {
    #[inline]
    fn multiset_count(packed: u32, piece: Piece) -> u8 {
        ((packed >> (piece as u32 * 4)) & 0x0f) as u8
    }

    #[inline]
    fn multiset_dec(packed: u32, piece: Piece) -> u32 {
        packed - (1u32 << (piece as u32 * 4))
    }

    #[inline]
    fn multiset_total(mut packed: u32) -> u8 {
        let mut total = 0u8;
        for _ in 0..7 {
            total += (packed & 0x0f) as u8;
            packed >>= 4;
        }
        total
    }

    fn packed_prefix_counts(qbits: u64, take: u8) -> Option<u32> {
        let mut counts = 0u32;
        for index in 0..take {
            let piece = Self::packed_piece(qbits, index)?;
            let shift = piece as u32 * 4;
            let count = ((counts >> shift) & 0x0f) + 1;
            if count > 15 {
                return None;
            }
            counts = (counts & !(0x0f << shift)) | (count << shift);
        }
        Some(counts)
    }

    // After `req` placements, a normal one-slot Hold queue has consumed either
    // req queue items (empty Hold) or req+1 queue items (one item left in Hold).
    // These count roots are therefore a small exact superset of all piece
    // multisets that can participate in a PC. Queue-order validation below
    // removes roots/orders that cannot actually be produced by a concrete case.
    fn pattern_multiset_roots(
        qbits: &[u64],
        qlens: &[u8],
        req: u8,
        use_hold: bool,
    ) -> FastSet<u32> {
        let mut roots = FastSet::default();
        for (&bits, &len) in qbits.iter().zip(qlens) {
            if len < req {
                continue;
            }
            if let Some(counts) = Self::packed_prefix_counts(bits, req) {
                roots.insert(counts);
            }
            if use_hold
                && len > req
                && let Some(counts) = Self::packed_prefix_counts(bits, req + 1)
            {
                for piece in Piece::ALL {
                    if Self::multiset_count(counts, piece) > 0 {
                        roots.insert(Self::multiset_dec(counts, piece));
                    }
                }
            }
        }
        roots
    }

    fn ensure_multiset_state(
        st: MultisetState,
        state_ids: &mut FastMap<MultisetState, u32>,
        states: &mut Vec<MultisetState>,
        nodes: &mut Vec<FlatDagNode>,
    ) -> u32 {
        if let Some(&id) = state_ids.get(&st) {
            return id;
        }
        let id = states.len() as u32;
        state_ids.insert(st, id);
        states.push(st);
        nodes.push(FlatDagNode::default());
        id
    }

    fn build_multiset_dag(
        &mut self,
        start_board: u64,
        roots: &FastSet<u32>,
    ) -> (FlatDag, Vec<u32>) {
        let mut state_ids = FastMap::default();
        let mut states = Vec::new();
        let mut nodes = Vec::new();
        let mut edges = Vec::new();
        let mut root_ids = Vec::with_capacity(roots.len());
        for &remaining_counts in roots {
            root_ids.push(Self::ensure_multiset_state(
                MultisetState {
                    board: start_board,
                    remaining_counts,
                },
                &mut state_ids,
                &mut states,
                &mut nodes,
            ));
        }

        // Iterative construction keeps every node's outgoing edges contiguous
        // in one arena. Child states are queued instead of being recursively
        // built between parent edges.
        let mut cursor = 0usize;
        while cursor < states.len() {
            let st = states[cursor];
            self.nodes += 1;
            let remaining = Self::multiset_total(st.remaining_counts);
            let edge_start = edges.len();
            for piece in Piece::ALL {
                if Self::multiset_count(st.remaining_counts, piece) == 0 {
                    continue;
                }
                let next_counts = Self::multiset_dec(st.remaining_counts, piece);
                if self.height > 4 && remaining == 2 {
                    let mut next_mask = 0u8;
                    for next in Piece::ALL {
                        if Self::multiset_count(next_counts, next) != 0 {
                            next_mask |= 1 << next as u8;
                        }
                    }
                    if !self.stage8_pair_allows(st.board, piece, next_mask, remaining) {
                        continue;
                    }
                }
                let set = self.placement_set_for_remaining(st.board, piece, remaining);
                // reachable_placements already deduplicates lock operations
                // for a piece on this board, so a second per-node hash set is
                // redundant here.
                for &pl in set.placements.iter() {
                    if pl.board == full_board(self.height) {
                        if remaining == 1 {
                            edges.push(DagEdge {
                                raw_board: pl.raw_board,
                                next: TERMINAL_NODE,
                                piece,
                                orientation: pl.orientation,
                                x: pl.x,
                                y: pl.y,
                                saved: 7,
                            });
                        }
                        continue;
                    }
                    if remaining <= 1 {
                        continue;
                    }
                    let remaining_cells = self.height as u32 * 10 - pl.board.count_ones();
                    if remaining_cells != (remaining - 1) as u32 * 4 {
                        continue;
                    }
                    if self.height > 4 && column_run_reject(pl.board, self.height) {
                        continue;
                    }
                    let child = Self::ensure_multiset_state(
                        MultisetState {
                            board: pl.board,
                            remaining_counts: next_counts,
                        },
                        &mut state_ids,
                        &mut states,
                        &mut nodes,
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
        for &root in &root_ids {
            flat_dag_productive(&mut dag, root);
        }
        root_ids.retain(|&root| dag.productive[root as usize] == 2);
        (dag, root_ids)
    }

    pub fn can_pc_pattern_many_packed(
        &mut self,
        initial: u64,
        qbits: &[u64],
        qlens: &[u8],
        use_hold: bool,
        out: &mut [u8],
    ) -> bool {
        if qbits.len() != qlens.len()
            || qbits.len() != out.len()
            || qlens.iter().any(|&len| len > 21)
        {
            return false;
        }
        out.fill(0);
        self.probability_paths = 0;
        self.probability_language_nodes = 0;
        self.probability_fallback = false;
        self.trim_cache_between_requests();
        let total = self.height as u32 * 10;
        let empty = total.saturating_sub(initial.count_ones());
        if !empty.is_multiple_of(4) || !self.legal_accept(initial) {
            return true;
        }
        let req = (empty / 4) as u8;
        if req == 0 {
            if initial == full_board(self.height) {
                out.fill(1);
            }
            return true;
        }
        let roots = Self::pattern_multiset_roots(qbits, qlens, req, use_hold);
        if roots.is_empty() {
            return true;
        }
        let start_board = normalize_after_placement(initial, self.height);
        let (dag, root_ids) = self.build_multiset_dag(start_board, &roots);
        if root_ids.is_empty() {
            return true;
        }

        let Some(queue_trie) = QueueTrie::new(qbits, qlens) else {
            return false;
        };
        self.probability_paths = crate::order_language::OrderLanguage::path_count(&dag, &root_ids);
        let use_compressed = self.probability_engine == 1
            || (self.probability_engine == 0 && self.probability_paths >= 100_000);
        let compressed = if use_compressed {
            crate::order_language::OrderLanguage::build(
                &dag,
                &root_ids,
                self.probability_node_budget,
            )
            .and_then(|(language, root)| {
                self.probability_language_nodes = language.children.len() as u32;
                queue_trie.coverage_for_language(&language, root, use_hold)
            })
        } else {
            None
        };
        self.probability_fallback = use_compressed && compressed.is_none();
        let covered = if let Some(covered) = compressed {
            covered
        } else {
            // Exact legacy fallback after either additional representation budget.
            let mut orders = FastSet::default();
            for root in root_ids {
                collect_flat_dag_orders(&dag, root, 0, 0, &mut orders);
            }
            let mut scratch = QueueTrieScratch::new(queue_trie.node_count());
            let mut covered = vec![0u64; queue_trie.words];
            let mut covered_count = 0usize;
            for order in orders {
                let bits = queue_trie.coverage_for_order(order, req, use_hold, &mut scratch);
                for (dst, src) in covered.iter_mut().zip(bits) {
                    covered_count += (src & !*dst).count_ones() as usize;
                    *dst |= src;
                }
                if covered_count >= out.len() {
                    break;
                }
            }
            covered
        };
        for (word_index, word) in covered.into_iter().enumerate() {
            let mut bits = word;
            while bits != 0 {
                let bit = bits.trailing_zeros() as usize;
                bits &= bits - 1;
                let dfs_idx = word_index * 64 + bit;
                if dfs_idx < queue_trie.perm.len() {
                    let case = queue_trie.perm[dfs_idx] as usize;
                    if case < out.len() {
                        out[case] = 1;
                    }
                }
            }
        }
        true
    }

    // Pattern-level compatibility enumeration for broad 4..=6-line queue sets. Geometry is
    // explored once per relevant piece multiset; concrete queues are applied
    // afterwards to the resulting piece orders. This removes the dominant
    // `N queues × enumerate_pc` repetition of the legacy compatibility path.
    pub fn enumerate_pc_pattern_packed(
        &mut self,
        initial: u64,
        qbits: &[u64],
        qlens: &[u8],
        use_hold: bool,
    ) -> Option<Vec<PatternSolutionCoverage>> {
        if qbits.len() != qlens.len() || qlens.iter().any(|&len| len > 21) {
            return None;
        }
        self.trim_cache_between_requests();
        let total = self.height as u32 * 10;
        let empty = total.saturating_sub(initial.count_ones());
        if !empty.is_multiple_of(4) || !self.legal_accept(initial) {
            return Some(Vec::new());
        }
        let req = (empty / 4) as u8;
        if req == 0 {
            return Some(Vec::new());
        }
        let roots = Self::pattern_multiset_roots(qbits, qlens, req, use_hold);
        if roots.is_empty() {
            return Some(Vec::new());
        }

        let mut initial_cleared = 0u8;
        for y in 0..self.height {
            if row(initial, y) == FULL_ROW {
                initial_cleared |= 1 << y;
            }
        }
        let start_board = normalize_after_placement(initial, self.height);
        let (dag, root_ids) = self.build_multiset_dag(start_board, &roots);

        let mut compact = FastMap::default();
        for root in root_ids {
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
                &mut compact,
            );
            self.reconstruction_visits += reconstruction.visits;
            self.reconstruction_skipped += reconstruction.skipped;
        }
        if compact.is_empty() {
            return Some(Vec::new());
        }

        let queue_trie = QueueTrie::new(qbits, qlens)?;
        let mut queue_scratch = QueueTrieScratch::new(queue_trie.node_count());
        let mut order_coverage: FastMap<u64, Vec<u64>> = FastMap::default();
        for orders in compact.values() {
            for &order in orders {
                order_coverage.entry(order).or_insert_with(|| {
                    queue_trie.coverage_for_order(order, req, use_hold, &mut queue_scratch)
                });
            }
        }

        let mut case_order_counts = vec![0u32; qbits.len()];
        let mut touched = Vec::new();
        let mut out = Vec::new();
        for (solution, orders) in compact {
            touched.clear();
            for order in &orders {
                let covered = &order_coverage[order];
                for (word_index, &word) in covered.iter().enumerate() {
                    let mut bits = word;
                    while bits != 0 {
                        let bit = bits.trailing_zeros() as usize;
                        bits &= bits - 1;
                        let dfs_idx = word_index * 64 + bit;
                        if dfs_idx >= queue_trie.perm.len() {
                            continue;
                        }
                        let case = queue_trie.perm[dfs_idx] as usize;
                        if case >= qbits.len() {
                            continue;
                        }
                        if case_order_counts[case] == 0 {
                            touched.push(case as u32);
                        }
                        case_order_counts[case] = case_order_counts[case].saturating_add(1);
                    }
                }
            }
            if touched.is_empty() {
                continue;
            }
            touched.sort_unstable();
            debug_assert!(
                touched
                    .iter()
                    .all(|&case| case_order_counts[case as usize] >= 1)
            );
            let cases = touched
                .iter()
                .map(|&case| (case, case_order_counts[case as usize]))
                .collect();
            for &case in &touched {
                case_order_counts[case as usize] = 0;
            }
            out.push(PatternSolutionCoverage {
                solution: Solution {
                    masks: solution.masks(self.height),
                    order_count: orders.len().min(u32::MAX as usize) as u32,
                },
                cases,
            });
        }
        out.sort_by_key(|entry| entry.solution.masks);
        Some(out)
    }
}
