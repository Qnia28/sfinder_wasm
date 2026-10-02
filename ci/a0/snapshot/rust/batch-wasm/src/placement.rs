use pc_core::{Piece, tspin_kind_exact};

use crate::common::{locked_next_board, physics};

#[unsafe(no_mangle)]
pub extern "C" fn batch_place_exact(
    board: u64,
    piece: u32,
    target_cells: u64,
    height: u32,
    physics_id: u32,
) -> u64 {
    if !(2..=6).contains(&height) {
        return 0;
    }
    let Some(piece) = Piece::from_u8(piece as u8) else {
        return 0;
    };
    let Some(next) = locked_next_board(
        board,
        piece,
        target_cells,
        height as u8,
        physics(physics_id),
    ) else {
        return 0;
    };
    (1u64 << 63) | next
}

#[unsafe(no_mangle)]
pub extern "C" fn batch_tspin_kind(
    board: u64,
    target_cells: u64,
    height: u32,
    physics_id: u32,
) -> u32 {
    if !(2..=6).contains(&height) {
        return 0;
    }
    tspin_kind_exact(board, target_cells, height as u8, physics(physics_id)) as u32
}
