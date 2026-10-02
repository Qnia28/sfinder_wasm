use crate::board::{FULL_ROW, MAX_HEIGHT, board_mask, row};
use crate::{CELLS, FastMap, FastSet, Piece};

// The edge stores the placement in the normalized current-board coordinate
// system.  Original-row colouring is intentionally not part of the DAG: it is
// reconstructed per successful path because different histories can reach the
// same future state after line clears.
#[derive(Clone, Copy, Debug)]
pub(crate) struct DagEdge {
    pub(crate) raw_board: u64,
    pub(crate) next: u32,
    pub(crate) piece: Piece,
    pub(crate) orientation: u8,
    pub(crate) x: i8,
    pub(crate) y: i8,
    // 0..6 only on terminal edges when the supplied concrete queue has
    // exactly one unplaced piece left; 7 means not applicable.
    pub(crate) saved: u8,
}

// Structural search and pattern-level compatibility search share one flat
// edge arena. This keeps allocation/cache behaviour consistent across every
// wrapper and avoids one Vec allocation per DAG node.
#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct FlatDagNode {
    pub(crate) edge_start: u32,
    pub(crate) edge_len: u32,
}

#[derive(Debug, Default)]
pub(crate) struct FlatDag {
    pub(crate) nodes: Vec<FlatDagNode>,
    pub(crate) edges: Vec<DagEdge>,
    pub(crate) productive: Vec<u8>,
}
impl FlatDag {
    #[inline]
    pub(crate) fn edges(&self, node: u32) -> &[DagEdge] {
        let meta = self.nodes[node as usize];
        let start = meta.edge_start as usize;
        &self.edges[start..start + meta.edge_len as usize]
    }
}

pub(crate) const TERMINAL_NODE: u32 = u32::MAX;

// Three board-size planes store a 3-bit piece code (piece + 1) for every
// placed cell. This is 24 bytes instead of carrying seven u64 piece masks
// (56 bytes) through the enumeration path.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Hash, Ord, PartialOrd)]
pub(crate) struct CompactSolution {
    pub(crate) planes: [u64; 3],
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Hash)]
pub(crate) struct DagPathState {
    pub(crate) depth: u8,
    pub(crate) cleared_rows: u8,
    pub(crate) compact: CompactSolution,
    pub(crate) order_bits: u64,
}
impl CompactSolution {
    #[inline]
    pub(crate) fn with_piece_mask(mut self, piece: Piece, mask: u64) -> Self {
        let code = piece as u8 + 1;
        for bit in 0..3 {
            if code & (1 << bit) != 0 {
                self.planes[bit] |= mask;
            }
        }
        self
    }

    pub(crate) fn masks(self, height: u8) -> [u64; 7] {
        let mut out = [0u64; 7];
        for piece in Piece::ALL {
            let code = piece as u8 + 1;
            let mut mask = board_mask(height);
            for bit in 0..3 {
                if code & (1 << bit) != 0 {
                    mask &= self.planes[bit];
                } else {
                    mask &= !self.planes[bit];
                }
            }
            out[piece as usize] = mask & board_mask(height);
        }
        out
    }
}

// Maps a placement in the normalized current board back to the original rows.
// Unlike the legacy enumerator this returns only the current placement mask;
// previous colouring is not copied into the structural state.
pub(crate) fn map_placement_to_original(
    height: u8,
    cleared_rows: u8,
    piece: Piece,
    orientation: u8,
    x: i8,
    y: i8,
    raw_board: u64,
) -> Option<(u8, u64)> {
    let c = cleared_rows.count_ones() as i8;
    let mut available = [0u8; MAX_HEIGHT as usize];
    let mut an = 0usize;
    for r in 0..height {
        if cleared_rows & (1 << r) == 0 {
            available[an] = r;
            an += 1;
        }
    }
    let mut original_mask = 0u64;
    for &(dx, dy) in &CELLS[piece as usize][orientation as usize] {
        let nx = x + dx;
        let ny = y + dy;
        if ny < c {
            return None;
        }
        let ai = (ny - c) as usize;
        if ai >= an {
            return None;
        }
        let orig = available[ai];
        original_mask |= 1u64 << (orig as u32 * 10 + nx as u32);
    }
    let mut next_cleared = cleared_rows;
    for ny in c..height as i8 {
        if row(raw_board, ny as u8) == FULL_ROW {
            let ai = (ny - c) as usize;
            if ai < an {
                next_cleared |= 1 << available[ai];
            }
        }
    }
    Some((next_cleared, original_mask))
}

pub(crate) fn flat_dag_productive(dag: &mut FlatDag, node: u32) -> bool {
    match dag.productive[node as usize] {
        1 => return false,
        2 => return true,
        _ => {}
    }
    // Remaining piece counts strictly decrease across every non-terminal
    // edge, so this recursion cannot cycle.
    let meta = dag.nodes[node as usize];
    let start = meta.edge_start as usize;
    let end = start + meta.edge_len as usize;
    let mut productive = false;
    for index in start..end {
        let next = dag.edges[index].next;
        let edge_productive = next == TERMINAL_NODE || flat_dag_productive(dag, next);
        productive |= edge_productive;
    }
    dag.productive[node as usize] = if productive { 2 } else { 1 };
    productive
}

pub(crate) struct ReconstructionMemo {
    pub(crate) visits: u64,
    pub(crate) skipped: u64,
    enabled: bool,
    seen: FastSet<(u32, DagPathState)>,
}
pub(crate) fn collect_flat_dag_paths(
    height: u8,
    dag: &FlatDag,
    node: u32,
    path: DagPathState,
    out: &mut FastMap<CompactSolution, FastSet<u64>>,
) -> ReconstructionMemo {
    let enabled = crate::order_language::OrderLanguage::path_count(dag, &[node]) >= 100_000;
    let mut memo = ReconstructionMemo {
        visits: 0,
        skipped: 0,
        enabled,
        seen: FastSet::default(),
    };
    walk_flat_dag_paths(height, dag, node, path, out, &mut memo);
    // Do not retain request workspaces in the solver.
    memo.seen = FastSet::default();
    memo
}

fn walk_flat_dag_paths(
    height: u8,
    dag: &FlatDag,
    node: u32,
    path: DagPathState,
    out: &mut FastMap<CompactSolution, FastSet<u64>>,
    memo: &mut ReconstructionMemo,
) {
    memo.visits += 1;
    if memo.enabled {
        let key = (node, path);
        if memo.seen.contains(&key) {
            memo.skipped += 1;
            return;
        }
        if memo.seen.len() < 200_000 {
            memo.seen.insert(key);
        }
    }
    for edge in dag.edges(node) {
        if edge.next != TERMINAL_NODE && dag.productive[edge.next as usize] != 2 {
            continue;
        }
        let Some((next_cleared, original_mask)) = map_placement_to_original(
            height,
            path.cleared_rows,
            edge.piece,
            edge.orientation,
            edge.x,
            edge.y,
            edge.raw_board,
        ) else {
            continue;
        };
        let next_compact = path.compact.with_piece_mask(edge.piece, original_mask);
        let next_order = path.order_bits | ((edge.piece as u64 + 1) << (path.depth as u32 * 3));
        if edge.next == TERMINAL_NODE {
            out.entry(next_compact).or_default().insert(next_order);
        } else {
            walk_flat_dag_paths(
                height,
                dag,
                edge.next,
                DagPathState {
                    depth: path.depth + 1,
                    cleared_rows: next_cleared,
                    compact: next_compact,
                    order_bits: next_order,
                },
                out,
                memo,
            );
        }
    }
}

pub(crate) fn collect_flat_dag_orders(
    dag: &FlatDag,
    node: u32,
    depth: u8,
    order_bits: u64,
    out: &mut FastSet<u64>,
) {
    for edge in dag.edges(node) {
        if edge.next != TERMINAL_NODE && dag.productive[edge.next as usize] != 2 {
            continue;
        }
        let next_order = order_bits | ((edge.piece as u64 + 1) << (depth as u32 * 3));
        if edge.next == TERMINAL_NODE {
            out.insert(next_order);
        } else {
            collect_flat_dag_orders(dag, edge.next, depth + 1, next_order, out);
        }
    }
}
