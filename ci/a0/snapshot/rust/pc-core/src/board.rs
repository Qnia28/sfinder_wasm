pub const WIDTH: u8 = 10;
pub const MAX_HEIGHT: u8 = 6;
pub const FULL_ROW: u64 = 0x3ff;

#[inline]
pub fn board_mask(height: u8) -> u64 {
    (1u64 << (height as u32 * 10)) - 1
}
#[inline]
pub fn full_board(height: u8) -> u64 {
    board_mask(height)
}
#[inline]
pub fn row(board: u64, y: u8) -> u64 {
    (board >> (y as u32 * 10)) & FULL_ROW
}
#[inline]
pub fn cleared_floor(board: u64, height: u8) -> u8 {
    let mut c = 0;
    while c < height && row(board, c) == FULL_ROW {
        c += 1
    }
    c
}

pub fn normalize_after_placement(board: u64, height: u8) -> u64 {
    let mut incomplete = [0u64; MAX_HEIGHT as usize];
    let mut n = 0usize;
    let mut complete = 0u8;
    for y in 0..height {
        let r = row(board, y);
        if r == FULL_ROW {
            complete += 1
        } else {
            incomplete[n] = r;
            n += 1
        }
    }
    let mut out = 0u64;
    for y in 0..complete {
        out |= FULL_ROW << (y as u32 * 10)
    }
    for (i, r) in incomplete[..n].iter().enumerate() {
        out |= *r << ((i as u32 + complete as u32) * 10)
    }
    out
}
#[inline]
fn get_cell(board: u64, x: i8, y: i8) -> bool {
    if !(0..10).contains(&x) || !(0..4).contains(&y) {
        return false;
    }
    board & (1u64 << (y as u32 * 10 + x as u32)) != 0
}
pub fn has_isolated_cell(board: u64) -> bool {
    for x in 0..10i8 {
        let (mut non_empty, mut full, mut every) = (false, true, true);
        for y in 0..4i8 {
            let here = get_cell(board, x, y);
            non_empty |= here;
            full &= here;
            if !here {
                let l = x == 0 || get_cell(board, x - 1, y);
                let r = x == 9 || get_cell(board, x + 1, y);
                if !(l && r) {
                    every = false
                }
            }
        }
        if non_empty && !full && every {
            return true;
        }
    }
    false
}
pub fn has_imbalanced_split(board: u64) -> bool {
    for split in 1..=7i8 {
        let mut blocked = true;
        for y in 0..4i8 {
            if !(get_cell(board, split, y) || get_cell(board, split + 1, y)) {
                blocked = false;
                break;
            }
        }
        if !blocked {
            continue;
        }
        let mut filled = 0;
        for x in 0..=split {
            for y in 0..4i8 {
                if get_cell(board, x, y) {
                    filled += 1
                }
            }
        }
        if filled % 4 != 0 {
            return true;
        }
    }
    false
}

// Partition columns 0..9 into maximal horizontal runs: columns x and x+1 share
// a run iff some row has both cells empty (a 4-connected tetromino spanning that
// gap needs a horizontal domino there).
//
// A disconnected gap can never reconnect: emptiness is monotone (placements only
// fill cells) and row normalization is a whole-row permutation, so a gap with no
// row where both adjacent cells are empty remains disconnected in every
// descendant state.
//
// Because no tetromino can cross a disconnected gap, each run's empty cells must
// be independently covered by some subset of the remaining pieces. Each
// tetromino covers exactly 4 cells, so every run's empty count must be
// divisible by 4.
#[inline]
pub(crate) fn column_run_reject(board: u64, height: u8) -> bool {
    // col_empty[x]: one bit per row, set when cell (x, y) is empty.
    let mut col_empty = [0u16; 10];
    for y in 0..height as u32 {
        let row_filled = (board >> (y * 10)) as u16 & 0x3ff;
        let row_empty = !row_filled & 0x3ff;
        let mut mask = row_empty;
        while mask != 0 {
            let x = mask.trailing_zeros() as usize;
            col_empty[x] |= 1 << y;
            mask &= mask - 1;
        }
    }
    let mut run_empty = col_empty[0].count_ones();
    for x in 0..9usize {
        if col_empty[x] & col_empty[x + 1] != 0 {
            run_empty += col_empty[x + 1].count_ones();
        } else {
            if run_empty % 4 != 0 {
                return true;
            }
            run_empty = col_empty[x + 1].count_ones();
        }
    }
    run_empty % 4 != 0
}
