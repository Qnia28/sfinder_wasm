use pc_core::{Physics, Piece, normalize_after_placement, reachable_exact_locked};

pub(crate) fn physics(v: u32) -> Physics {
    if v == 1 {
        Physics::Tetrio
    } else {
        Physics::Jstris
    }
}

#[inline]
pub(crate) fn locked_next_board(
    board: u64,
    piece: Piece,
    target_cells: u64,
    height: u8,
    physics: Physics,
) -> Option<u64> {
    let bottom_row = (1u64 << 10) - 1;
    let on_ground = (target_cells & bottom_row) != 0 || ((target_cells >> 10) & board) != 0;
    if !on_ground || !reachable_exact_locked(board, piece, target_cells, height, physics) {
        return None;
    }
    Some(normalize_after_placement(board | target_cells, height))
}
