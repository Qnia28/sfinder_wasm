//! Output-specific reconstruction. Queue state and original colouring remain
//! part of the key; piece-order identity is unnecessary for geometry/coverage.
use crate::dag::{CompactSolution, FlatDag, TERMINAL_NODE, map_placement_to_original};
use crate::{FastMap, FastSet, Piece, QueueTrie, QueueTrieScratch};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct GeometryState {
    node: u32,
    cleared: u8,
    colour: CompactSolution,
    queue: u64,
    depth: u8,
}

#[derive(Default)]
pub(crate) struct GeometryStats {
    pub(crate) visits: u64,
    pub(crate) skipped: u64,
}

type GeometryCoverageRows = Vec<([u64; 7], u32)>;

trait Projection {
    type Output;
    fn advance(&mut self, state: u64, piece: Piece, depth: u8) -> Option<Option<u64>>;
    fn finish(&mut self, colour: CompactSolution, state: u64, out: &mut Self::Output);
}

struct GeometryOnly;
impl Projection for GeometryOnly {
    type Output = FastSet<CompactSolution>;
    fn advance(&mut self, state: u64, _: Piece, _: u8) -> Option<Option<u64>> {
        Some(Some(state))
    }
    fn finish(&mut self, colour: CompactSolution, _: u64, out: &mut Self::Output) {
        out.insert(colour);
    }
}

struct QueueProjection<'a> {
    trie: &'a QueueTrie,
    hold: bool,
    states: Vec<Vec<u32>>,
    ids: FastMap<Vec<u32>, u32>,
    transitions: Vec<[u32; 7]>,
    coverages: FastMap<u32, Vec<u64>>,
    state_entries: usize,
    state_budget: usize,
}

impl Projection for QueueProjection<'_> {
    type Output = FastMap<CompactSolution, Vec<u64>>;
    fn advance(&mut self, state: u64, piece: Piece, _: u8) -> Option<Option<u64>> {
        let cached = self.transitions[state as usize][piece as usize];
        if cached != u32::MAX {
            return Some((cached != 0).then_some(cached as u64));
        }
        let mut next = Vec::new();
        for &queue in &self.states[state as usize] {
            next.extend(self.trie.advance(queue, piece as u8, self.hold));
        }
        next.sort_unstable();
        next.dedup();
        let id = if next.is_empty() {
            0
        } else if let Some(&id) = self.ids.get(&next) {
            id
        } else {
            // Budget exhaustion discards this attempt and uses full exact enumeration.
            if self.states.len() >= self.state_budget || self.state_entries + next.len() > 1_000_000
            {
                return None;
            }
            self.state_entries += next.len();
            let id = self.states.len() as u32;
            self.ids.insert(next.clone(), id);
            self.states.push(next);
            self.transitions.push([u32::MAX; 7]);
            id
        };
        self.transitions[state as usize][piece as usize] = id;
        Some((id != 0).then_some(id as u64))
    }
    fn finish(&mut self, colour: CompactSolution, state: u64, out: &mut Self::Output) {
        if (self.coverages.len() + 1).saturating_mul(self.trie.words) > 8_388_608 {
            self.coverages.clear();
        }
        let coverage = self.coverages.entry(state as u32).or_insert_with(|| {
            let mut bits = vec![0; self.trie.words];
            for &queue in &self.states[state as usize] {
                self.trie.add_state_coverage(queue, &mut bits);
            }
            bits
        });
        let target = out
            .entry(colour)
            .or_insert_with(|| vec![0; self.trie.words]);
        for (target, &bits) in target.iter_mut().zip(coverage.iter()) {
            *target |= bits;
        }
    }
}

// Small DAGs are cheaper to project at leaves. Cache an order's bitmap globally,
// without retaining per-geometry order sets or accumulating per-case quality.
struct LeafProjection<'a> {
    trie: &'a QueueTrie,
    hold: bool,
    depth: u8,
    scratch: QueueTrieScratch,
    coverages: FastMap<u64, Vec<u64>>,
}
impl Projection for LeafProjection<'_> {
    type Output = FastMap<CompactSolution, Vec<u64>>;
    fn advance(&mut self, state: u64, piece: Piece, depth: u8) -> Option<Option<u64>> {
        Some(Some(state | ((piece as u64 + 1) << (depth as u32 * 3))))
    }
    fn finish(&mut self, colour: CompactSolution, state: u64, out: &mut Self::Output) {
        // Eviction only recomputes exact coverage; it never truncates results.
        if (self.coverages.len() + 1).saturating_mul(self.trie.words) > 8_388_608 {
            self.coverages.clear();
        }
        let coverage = self.coverages.entry(state).or_insert_with(|| {
            self.trie
                .coverage_for_order(state, self.depth, self.hold, &mut self.scratch)
        });
        if coverage.iter().all(|&word| word == 0) {
            return;
        }
        let target = out
            .entry(colour)
            .or_insert_with(|| vec![0; self.trie.words]);
        for (target, &bits) in target.iter_mut().zip(coverage.iter()) {
            *target |= bits;
        }
    }
}

struct Walk<'a, P: Projection> {
    height: u8,
    dag: &'a FlatDag,
    projection: P,
    seen: FastSet<GeometryState>,
    memo_enabled: bool,
    stats: GeometryStats,
    out: P::Output,
}

impl<P: Projection> Walk<'_, P> {
    fn visit(&mut self, state: GeometryState) -> Option<()> {
        self.stats.visits += 1;
        if self.memo_enabled {
            if self.seen.contains(&state) {
                self.stats.skipped += 1;
                return Some(());
            }
            if self.seen.len() < 200_000 {
                self.seen.insert(state);
            }
        }
        let meta = self.dag.nodes[state.node as usize];
        for index in meta.edge_start..meta.edge_start + meta.edge_len {
            let edge = self.dag.edges[index as usize];
            if edge.next != TERMINAL_NODE && self.dag.productive[edge.next as usize] != 2 {
                continue;
            }
            let Some(queue) = self
                .projection
                .advance(state.queue, edge.piece, state.depth)?
            else {
                continue;
            };
            let Some((cleared, mask)) = map_placement_to_original(
                self.height,
                state.cleared,
                edge.piece,
                edge.orientation,
                edge.x,
                edge.y,
                edge.raw_board,
            ) else {
                continue;
            };
            let colour = state.colour.with_piece_mask(edge.piece, mask);
            if edge.next == TERMINAL_NODE {
                self.projection.finish(colour, queue, &mut self.out);
            } else {
                self.visit(GeometryState {
                    node: edge.next,
                    cleared,
                    colour,
                    queue,
                    depth: state.depth + 1,
                })?;
            }
        }
        Some(())
    }
}

pub(crate) fn collect_geometry(
    height: u8,
    dag: &FlatDag,
    root: u32,
    cleared: u8,
) -> (FastSet<CompactSolution>, GeometryStats) {
    let memo_enabled = crate::order_language::OrderLanguage::path_count(dag, &[root]) >= 100_000;
    let mut walk = Walk {
        height,
        dag,
        projection: GeometryOnly,
        seen: FastSet::default(),
        memo_enabled,
        stats: GeometryStats::default(),
        out: FastSet::default(),
    };
    walk.visit(GeometryState {
        node: root,
        cleared,
        colour: CompactSolution::default(),
        queue: 0,
        depth: 0,
    });
    (walk.out, walk.stats)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn collect_path_geometry(
    height: u8,
    dag: &FlatDag,
    roots: &[u32],
    cleared: u8,
    trie: &QueueTrie,
    hold: bool,
    required: u8,
    state_budget: usize,
) -> Option<(GeometryCoverageRows, GeometryStats)> {
    let path_count = crate::order_language::OrderLanguage::path_count(dag, roots);
    if path_count < 100_000 && state_budget == 200_000 {
        // At most one cached bitmap per leaf order, bounded by this path budget.
        let mut walk = Walk {
            height,
            dag,
            projection: LeafProjection {
                trie,
                hold,
                depth: required,
                scratch: QueueTrieScratch::new(trie.node_count()),
                coverages: FastMap::default(),
            },
            seen: FastSet::default(),
            memo_enabled: false,
            stats: GeometryStats::default(),
            out: FastMap::default(),
        };
        for &root in roots {
            if dag.productive[root as usize] == 2 {
                walk.visit(GeometryState {
                    node: root,
                    cleared,
                    colour: CompactSolution::default(),
                    queue: 0,
                    depth: 0,
                })?;
            }
        }
        return Some((coverage_rows(height, walk.out), walk.stats));
    }
    let initial = vec![trie.initial_state()];
    let projection = QueueProjection {
        trie,
        hold,
        states: vec![Vec::new(), initial.clone()],
        ids: FastMap::from_iter([(initial, 1)]),
        transitions: vec![[0; 7], [u32::MAX; 7]],
        coverages: FastMap::default(),
        state_entries: 1,
        state_budget,
    };
    let memo_enabled = crate::order_language::OrderLanguage::path_count(dag, roots) >= 100_000;
    let mut walk = Walk {
        height,
        dag,
        projection,
        seen: FastSet::default(),
        memo_enabled,
        stats: GeometryStats::default(),
        out: FastMap::default(),
    };
    for &root in roots {
        if dag.productive[root as usize] == 2 {
            walk.visit(GeometryState {
                node: root,
                cleared,
                colour: CompactSolution::default(),
                queue: 1,
                depth: 0,
            })?;
        }
    }
    Some((coverage_rows(height, walk.out), walk.stats))
}

fn coverage_rows(height: u8, out: FastMap<CompactSolution, Vec<u64>>) -> GeometryCoverageRows {
    let mut rows: Vec<_> = out
        .into_iter()
        .filter_map(|(colour, coverage)| {
            let count = coverage.iter().map(|word| word.count_ones()).sum::<u32>();
            (count != 0).then(|| (colour.masks(height), count))
        })
        .collect();
    rows.sort_unstable_by_key(|row| row.0);
    rows
}
