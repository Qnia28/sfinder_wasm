mod board;
mod dag;
mod hashing;
mod legal;
pub mod min_cover;
mod movement;
mod order_language;
mod pattern;
mod piece;
mod queue_codec;
pub mod queue_trie;
mod reverse;
mod single_queue;

use board::column_run_reject;
pub use board::{
    FULL_ROW, MAX_HEIGHT, WIDTH, board_mask, cleared_floor, full_board, has_imbalanced_split,
    has_isolated_cell, normalize_after_placement, row,
};
use dag::{
    CompactSolution, DagEdge, DagPathState, FlatDag, FlatDagNode, TERMINAL_NODE,
    collect_flat_dag_orders, collect_flat_dag_paths, flat_dag_productive,
    map_placement_to_original,
};
pub use hashing::{FastBuildHasher, FastHasher, FastMap, FastSet};
pub use legal::LegalTables;
#[cfg(test)]
use legal::PackedBoards;
#[cfg(test)]
use movement::raw_kicks;
#[cfg(test)]
use movement::reachable_placements_bfs;
pub use movement::{
    CELLS, Placement, reachable_exact_locked, reachable_placements,
    reachable_placements_with_physics, tspin_kind_exact,
};
use movement::{MAX_X, MAX_Y, add_rotation_frontier, place_bits, valid_anchor_masks};
pub use piece::{Physics, Piece};
use queue_trie::{QueueTrie, QueueTrieScratch};
use std::hash::Hash;
use std::rc::Rc;

#[derive(Clone)]
struct PlacementSet {
    placements: Rc<[Placement]>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct Solution {
    pub masks: [u64; 7],
    pub order_count: u32,
}

#[derive(Clone, Debug)]
pub struct PatternSolutionCoverage {
    pub solution: Solution,
    // (case index, number of distinct playable piece orders for this solution)
    pub cases: Vec<(u32, u32)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct CompatPlacementCacheKey {
    board: u64,
    piece: Piece,
}

// Estimate retained payload plus conservative hash/Rc bookkeeping. This is a
// retention budget at request boundaries, not a peak-memory bound within DFS.
const PLACEMENT_CACHE_BUDGET_BYTES: usize = 8 * 1024 * 1024;

struct PlacementCacheEntry {
    set: PlacementSet,
    epoch: u64,
    bytes: usize,
}

fn trim_placement_cache<K: Copy + Eq + Hash>(
    cache: &mut FastMap<K, PlacementCacheEntry>,
    bytes: &mut usize,
    budget: usize,
) -> usize {
    if *bytes <= budget {
        return 0;
    }
    let mut entries: Vec<_> = cache
        .iter()
        .map(|(&key, entry)| (key, entry.epoch, entry.bytes))
        .collect();
    entries.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    let mut keep = FastSet::default();
    let target = budget * 3 / 4;
    let mut retained = 0;
    for (key, _, cost) in entries {
        if retained + cost <= target {
            retained += cost;
            keep.insert(key);
        }
    }
    let before = cache.len();
    cache.retain(|key, _| keep.contains(key));
    *bytes = retained;
    before - cache.len()
}

pub struct PcSolver {
    pub reconstruction_visits: u64,
    pub reconstruction_skipped: u64,
    pub probability_engine: u8,
    pub probability_node_budget: usize,
    pub probability_paths: u64,
    pub probability_language_nodes: u32,
    pub probability_fallback: bool,
    height: u8,
    prune: bool,
    legal: Option<LegalTables>,
    // Keep the exact 40-bit fast-path key used by the 2..=4-line solver.
    placement_cache: FastMap<u64, PlacementCacheEntry>,
    // 5..=6-line compatibility boards can occupy bits 40..59, so they need
    // an explicit piece field instead of packing the piece above bit 40.
    compat_placement_cache: FastMap<CompatPlacementCacheKey, PlacementCacheEntry>,
    placement_cache_bytes: usize,
    compat_placement_cache_bytes: usize,
    cache_epoch: u64,
    cache_budget: usize,
    pub placement_cache_evictions: u64,
    pub nodes: u64,
    pub memo_hits: u64,
    pub placement_cache_hits: u64,
    pub placement_cache_misses: u64,
    pub legal_rejects: u64,
    probe_node_limit: u64,
    probe_exhausted: bool,
}
impl PcSolver {
    pub fn new(height: u8) -> Self {
        assert!((2..=6).contains(&height));
        Self {
            height,
            prune: true,
            legal: None,
            placement_cache: FastMap::default(),
            compat_placement_cache: FastMap::default(),
            placement_cache_bytes: 0,
            compat_placement_cache_bytes: 0,
            cache_epoch: 0,
            cache_budget: PLACEMENT_CACHE_BUDGET_BYTES,
            placement_cache_evictions: 0,
            nodes: 0,
            memo_hits: 0,
            placement_cache_hits: 0,
            placement_cache_misses: 0,
            legal_rejects: 0,
            reconstruction_visits: 0,
            reconstruction_skipped: 0,
            probability_engine: 0,
            probability_node_budget: 200_000,
            probability_paths: 0,
            probability_language_nodes: 0,
            probability_fallback: false,
            probe_node_limit: u64::MAX,
            probe_exhausted: false,
        }
    }
    pub fn set_prune(&mut self, v: bool) {
        if self.prune != v {
            self.prune = v;
            self.placement_cache.clear();
            self.compat_placement_cache.clear();
            self.placement_cache_bytes = 0;
            self.compat_placement_cache_bytes = 0;
        }
    }
    pub fn load_legal_pack(&mut self, bytes: &[u8]) -> bool {
        match LegalTables::from_pack(bytes) {
            Some(t) => {
                self.legal = Some(t);
                self.placement_cache.clear();
                self.compat_placement_cache.clear();
                self.placement_cache_bytes = 0;
                self.compat_placement_cache_bytes = 0;
                true
            }
            None => false,
        }
    }
    #[inline]
    fn legal_accept(&mut self, b: u64) -> bool {
        let ok = self
            .legal
            .as_ref()
            .is_none_or(|t| t.accepts(b, self.height));
        if !ok {
            self.legal_rejects += 1
        }
        ok
    }
    pub fn legal_count(&self, stage: usize) -> usize {
        self.legal.as_ref().map_or(0, |t| t.count(stage))
    }
    pub fn legal_pack_version(&self) -> u8 {
        self.legal.as_ref().map_or(0, LegalTables::version)
    }
    pub fn legal_memory_bytes(&self) -> usize {
        self.legal.as_ref().map_or(0, LegalTables::memory_bytes)
    }
    pub fn stage8_oracle_entries(&self) -> usize {
        self.legal
            .as_ref()
            .map_or(0, LegalTables::stage8_oracle_entries)
    }
    pub fn stage9_oracle_entries(&self) -> usize {
        self.legal
            .as_ref()
            .map_or(0, LegalTables::stage9_oracle_entries)
    }
    pub fn placement_cache_entries(&self) -> usize {
        self.placement_cache.len() + self.compat_placement_cache.len()
    }

    pub fn placement_cache_estimated_bytes(&self) -> usize {
        self.placement_cache_bytes + self.compat_placement_cache_bytes
    }

    pub fn set_placement_cache_budget(&mut self, bytes: usize) {
        self.cache_budget = bytes.clamp(1024, 256 * 1024 * 1024);
        self.trim_cache_between_requests();
    }

    pub fn reset_stats(&mut self) {
        self.reconstruction_visits = 0;
        self.reconstruction_skipped = 0;
        self.probability_paths = 0;
        self.probability_language_nodes = 0;
        self.probability_fallback = false;
        self.nodes = 0;
        self.memo_hits = 0;
        self.placement_cache_hits = 0;
        self.placement_cache_misses = 0;
        self.placement_cache_evictions = 0;
        self.legal_rejects = 0
    }
    #[inline]
    fn cache_key(board: u64, p: Piece) -> u64 {
        board | ((p as u64) << 40)
    }
    fn placement_set(&mut self, board: u64, p: Piece) -> PlacementSet {
        if self.height <= 4 {
            let k = Self::cache_key(board, p);
            if let Some(v) = self.placement_cache.get_mut(&k) {
                self.placement_cache_hits += 1;
                v.epoch = self.cache_epoch;
                return v.set.clone();
            }
        } else {
            let k = CompatPlacementCacheKey { board, piece: p };
            if let Some(v) = self.compat_placement_cache.get_mut(&k) {
                self.placement_cache_hits += 1;
                v.epoch = self.cache_epoch;
                return v.set.clone();
            }
        }
        self.placement_cache_misses += 1;
        let mut ps = reachable_placements(board, p, self.height);
        // These two topology prunes are deliberately kept on the established
        // four-line fast path only. Compatibility mode uses generic search.
        if self.prune && self.height == 4 {
            ps.retain(|x| !has_isolated_cell(x.board) && !has_imbalanced_split(x.board))
        }
        if self.legal.is_some() {
            ps.retain(|x| self.legal_accept(x.board));
        }
        let set = PlacementSet {
            placements: Rc::from(ps),
        };
        let bytes = set.placements.len() * std::mem::size_of::<Placement>() + 96;
        let entry = PlacementCacheEntry {
            set: set.clone(),
            epoch: self.cache_epoch,
            bytes,
        };
        if self.height <= 4 {
            self.placement_cache_bytes += bytes;
            self.placement_cache
                .insert(Self::cache_key(board, p), entry);
        } else {
            self.compat_placement_cache_bytes += bytes;
            self.compat_placement_cache
                .insert(CompatPlacementCacheKey { board, piece: p }, entry);
        }
        set
    }
    // Generic 5..=6-line final-piece fast path. Reuse the same forward
    // frontier reachability as reachable_placements(), but search only for the
    // unique four-cell PC target and stop at the first matching lock.
    fn generic_finish_placement(&self, board: u64, p: Piece) -> Option<Placement> {
        let target = board_mask(self.height) & !board;
        if target.count_ones() != 4 {
            return None;
        }
        let mut min_x = 10i8;
        let min_y = (target.trailing_zeros() / 10) as i8;
        let mut cells = target;
        while cells != 0 {
            min_x = min_x.min((cells.trailing_zeros() % 10) as i8);
            cells &= cells - 1;
        }
        if !(0..4).any(|o| {
            min_x <= MAX_X[p as usize][o as usize]
                && min_y + MAX_Y[p as usize][o as usize] < self.height as i8
                && place_bits(p, o, min_x, min_y) == target
        }) {
            return None;
        }
        let (valid, inside) = valid_anchor_masks(board, p, self.height);
        if (0..4).all(|o| valid[o] & inside[o] == 0) {
            return None;
        }
        let mut reach = [0u128; 4];
        let spawn_rows = (0xffffu128 << (self.height as u32 * 16))
            | (0xffffu128 << ((self.height as u32 + 1) * 16));
        for o in 0..4 {
            reach[o] = valid[o] & spawn_rows;
        }
        let mut frontier = reach;
        while frontier.iter().any(|&x| x != 0) {
            let mut next = [0u128; 4];
            for o in 0..4 {
                next[o] |= ((frontier[o] << 1) | (frontier[o] >> 1) | (frontier[o] >> 16))
                    & valid[o]
                    & !reach[o];
            }
            let rotated = add_rotation_frontier(p, &frontier, &reach, &valid, Physics::Jstris);
            for o in 0..4 {
                next[o] |= rotated[o] & !reach[o];
                reach[o] |= next[o];
            }
            frontier = next;
        }
        for o in 0..4usize {
            let downable = valid[o] << 16;
            let mut locks = reach[o] & inside[o] & !downable;
            while locks != 0 {
                let bit = locks.trailing_zeros();
                locks &= locks - 1;
                let y = (bit / 16) as i8;
                let x = (bit % 16) as i8;
                let cells = place_bits(p, o as u8, x, y);
                if cells != target {
                    continue;
                }
                let raw_board = board | cells;
                return Some(Placement {
                    piece: p,
                    orientation: o as u8,
                    x,
                    y,
                    board: normalize_after_placement(raw_board, self.height),
                    raw_board,
                    cells,
                });
            }
        }
        None
    }

    // Remove only h-4 complete bottom rows. Walls, spawn-relative height,
    // normalized floor and every remaining cell translate by the same amount.
    fn tail_board4(&self, board: u64) -> Option<(u64, u8)> {
        if self.height == 4 {
            return Some((board, 0));
        }
        if self.height < 4 {
            return None;
        }
        let delta = self.height - 4;
        if cleared_floor(board, self.height) < delta {
            return None;
        }
        Some((board >> (delta as u32 * 10), delta))
    }
    fn tail_finish_placement(&self, board: u64, p: Piece) -> Option<Option<Placement>> {
        let (reduced, delta) = self.tail_board4(board)?;
        self.legal
            .as_ref()?
            .stage9_finish_placement(reduced, p)
            .map(|placement| {
                placement.map(|mut pl| {
                    if delta != 0 {
                        pl.y += delta as i8;
                        pl.cells <<= delta as u32 * 10;
                        pl.raw_board = board | pl.cells;
                        pl.board = normalize_after_placement(pl.raw_board, self.height);
                    }
                    pl
                })
            })
    }

    // When exactly one tetromino remains, LGB2 contains the exact finishing
    // lock state.  Enumeration therefore keeps the same final geometry while
    // avoiding a full movement search.  LGB1 transparently falls back to the
    // normal placement cache.
    fn placement_set_for_remaining(&mut self, board: u64, p: Piece, remaining: u8) -> PlacementSet {
        if remaining == 1 {
            if let Some(result) = self.tail_finish_placement(board, p) {
                return match result {
                    Some(pl) => PlacementSet {
                        placements: Rc::from(vec![pl]),
                    },
                    None => PlacementSet {
                        placements: Rc::from(Vec::<Placement>::new()),
                    },
                };
            }
            if self.height > 4 {
                return match self.generic_finish_placement(board, p) {
                    Some(pl) => PlacementSet {
                        placements: Rc::from(vec![pl]),
                    },
                    None => PlacementSet {
                        placements: Rc::from(Vec::<Placement>::new()),
                    },
                };
            }
        }
        self.placement_set(board, p)
    }

    #[inline]
    fn packed_piece(qbits: u64, index: u8) -> Option<Piece> {
        Piece::from_u8(((qbits >> (index as u32 * 3)) & 7) as u8)
    }

    #[inline]
    fn next_piece_mask(q: &[Piece], idx: u8, hold: u8, use_hold: bool) -> u8 {
        let n = q.len() as u8;
        let mut mask = 0u8;
        if idx < n {
            let cur = q[idx as usize];
            mask |= 1 << cur as u8;
            if use_hold {
                if hold == 7 {
                    if idx + 1 < n {
                        mask |= 1 << q[idx as usize + 1] as u8;
                    }
                } else {
                    mask |= 1 << hold;
                }
            }
        } else if use_hold && hold != 7 {
            mask |= 1 << hold;
        }
        mask
    }

    #[inline]
    fn next_piece_mask_packed(qbits: u64, qlen: u8, hold: u8, use_hold: bool) -> u8 {
        let mut mask = 0u8;
        if qlen > 0 {
            let cur = Self::packed_piece(qbits, 0).unwrap();
            mask |= 1 << cur as u8;
            if use_hold {
                if hold == 7 {
                    if qlen > 1 {
                        mask |= 1 << Self::packed_piece(qbits, 1).unwrap() as u8;
                    }
                } else {
                    mask |= 1 << hold;
                }
            }
        } else if use_hold && hold != 7 {
            mask |= 1 << hold;
        }
        mask
    }

    // Stage 8 has two tetrominoes left.  The oracle says which second piece
    // can follow a chosen first piece.  It is only a rejection test: when the
    // masks intersect we still enumerate exact first placements, preserving
    // all solution geometries.
    #[inline]
    fn stage8_pair_allows(
        &self,
        board: u64,
        first: Piece,
        next_piece_mask: u8,
        remaining: u8,
    ) -> bool {
        if remaining != 2 {
            return true;
        }
        let Some(pair_mask) = self.tail_board4(board).and_then(|(reduced, _)| {
            self.legal
                .as_ref()
                .and_then(|t| t.stage8_pair_mask(reduced, first))
        }) else {
            return true;
        };
        pair_mask & next_piece_mask != 0
    }
    #[inline]
    fn trim_cache_between_requests(&mut self) {
        self.cache_epoch = self.cache_epoch.saturating_add(1);
        if self.height <= 4 {
            self.placement_cache_evictions += trim_placement_cache(
                &mut self.placement_cache,
                &mut self.placement_cache_bytes,
                self.cache_budget,
            ) as u64;
        } else {
            self.placement_cache_evictions += trim_placement_cache(
                &mut self.compat_placement_cache,
                &mut self.compat_placement_cache_bytes,
                self.cache_budget,
            ) as u64;
        }
    }

    // Existence-only pattern batch for 5..=6-line compatibility mode. It
    // shares the same multiset geometry DAG and queue-trie Hold projection as
    // full pattern enumeration, but skips solution-colour reconstruction.
    // This is the hot path for chance/solve-rate queries.
}

pub use queue_codec::{decode_queue_array, decode_queue_bits, encode_queue_ascii};
pub use reverse::{geometric_predecessor_pairs, geometric_predecessors};

#[cfg(test)]
mod tests;
