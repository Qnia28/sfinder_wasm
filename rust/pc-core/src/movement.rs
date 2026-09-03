#[cfg(test)]
use std::collections::HashSet;

use crate::board::{FULL_ROW, board_mask, normalize_after_placement};
use crate::{Physics, Piece};

const ANCHOR_STRIDE: i32 = 16;

pub const CELLS: [[[(i8, i8); 4]; 4]; 7] = [
    [
        [(0, 0), (1, 0), (2, 0), (3, 0)],
        [(0, 0), (0, 1), (0, 2), (0, 3)],
        [(0, 0), (1, 0), (2, 0), (3, 0)],
        [(0, 0), (0, 1), (0, 2), (0, 3)],
    ],
    [
        [(0, 0), (1, 0), (2, 0), (0, 1)],
        [(0, 0), (0, 1), (0, 2), (1, 2)],
        [(2, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 0), (1, 0), (1, 1), (1, 2)],
    ],
    [
        [(0, 0), (1, 0), (2, 0), (2, 1)],
        [(0, 0), (1, 0), (0, 1), (0, 2)],
        [(0, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (1, 1), (0, 2), (1, 2)],
    ],
    [
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
        [(0, 0), (1, 0), (0, 1), (1, 1)],
    ],
    [
        [(0, 0), (1, 0), (1, 1), (2, 1)],
        [(1, 0), (0, 1), (1, 1), (0, 2)],
        [(0, 0), (1, 0), (1, 1), (2, 1)],
        [(1, 0), (0, 1), (1, 1), (0, 2)],
    ],
    [
        [(0, 0), (1, 0), (2, 0), (1, 1)],
        [(0, 0), (0, 1), (1, 1), (0, 2)],
        [(1, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (0, 1), (1, 1), (1, 2)],
    ],
    [
        [(1, 0), (2, 0), (0, 1), (1, 1)],
        [(0, 0), (0, 1), (1, 1), (1, 2)],
        [(1, 0), (2, 0), (0, 1), (1, 1)],
        [(0, 0), (0, 1), (1, 1), (1, 2)],
    ],
];
pub(crate) const MAX_X: [[i8; 4]; 7] = [
    [6, 9, 6, 9],
    [7, 8, 7, 8],
    [7, 8, 7, 8],
    [8, 8, 8, 8],
    [7, 8, 7, 8],
    [7, 8, 7, 8],
    [7, 8, 7, 8],
];
pub(crate) const MAX_Y: [[i8; 4]; 7] = [
    [0, 3, 0, 3],
    [1, 2, 1, 2],
    [1, 2, 1, 2],
    [1, 1, 1, 1],
    [1, 2, 1, 2],
    [1, 2, 1, 2],
    [1, 2, 1, 2],
];
const JLSTZ_CW: [[(i8, i8); 5]; 4] = [
    [(1, -1), (0, -1), (0, 0), (1, -3), (0, -3)],
    [(-1, 0), (0, 0), (0, -1), (-1, 2), (0, 2)],
    [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
    [(0, 1), (-1, 1), (-1, 0), (0, 3), (-1, 3)],
];
const JLSTZ_CCW: [[(i8, i8); 5]; 4] = [
    [(0, -1), (1, -1), (1, 0), (0, -3), (1, -3)],
    [(-1, 1), (0, 1), (0, 0), (-1, 3), (0, 3)],
    [(1, 0), (0, 0), (0, 1), (1, -2), (0, -2)],
    [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
];
const I_CW: [[(i8, i8); 5]; 4] = [
    [(2, -2), (0, -2), (3, -2), (0, -3), (3, 0)],
    [(-2, 1), (-3, 1), (0, 1), (-3, 3), (0, 0)],
    [(1, -1), (3, -1), (0, -1), (3, 0), (0, -3)],
    [(-1, 2), (0, 2), (-3, 2), (0, 0), (-3, 3)],
];
const I_CCW: [[(i8, i8); 5]; 4] = [
    [(1, -2), (0, -2), (3, -2), (0, 0), (3, -3)],
    [(-2, 2), (0, 2), (-3, 2), (0, 3), (-3, 0)],
    [(2, -1), (3, -1), (0, -1), (3, -3), (0, 0)],
    [(-1, 1), (-3, 1), (0, 1), (-3, 0), (0, 3)],
];
const HALF: [[(i8, i8); 2]; 4] = [
    [(0, -1), (0, 0)],
    [(-1, 0), (0, 0)],
    [(0, 1), (0, 0)],
    [(1, 0), (0, 0)],
];
const TETRIO_HALF: [[(i8, i8); 6]; 4] = [
    [(0, -1), (0, 0), (1, 0), (-1, 0), (1, -1), (-1, -1)],
    [(-1, 0), (0, 0), (0, 2), (0, 1), (-1, 2), (-1, 1)],
    [(0, 1), (0, 0), (-1, 0), (1, 0), (-1, 1), (1, 1)],
    [(1, 0), (0, 0), (0, 2), (0, 1), (1, 2), (1, 1)],
];
const TETRIO_I_CW: [[(i8, i8); 5]; 4] = [
    [(2, -2), (3, -2), (0, -2), (0, -3), (3, 0)],
    I_CW[1],
    I_CW[2],
    I_CW[3],
];
const TETRIO_I_CCW: [[(i8, i8); 5]; 4] = [
    [(1, -2), (0, -2), (3, -2), (3, -3), (0, 0)],
    [(-2, 2), (-3, 2), (0, 2), (-3, 0), (0, 3)],
    [(2, -1), (0, -1), (3, -1), (0, 0), (3, -3)],
    [(-1, 1), (0, 1), (-3, 1), (0, 3), (-3, 0)],
];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub struct Placement {
    pub piece: Piece,
    pub orientation: u8,
    pub x: i8,
    pub y: i8,
    pub board: u64,
    pub raw_board: u64,
    pub cells: u64,
}

#[cfg(test)]
#[inline]
fn collides(board: u64, p: Piece, o: u8, x: i8, y: i8, height: u8) -> bool {
    if x < 0 || x > MAX_X[p as usize][o as usize] || y < 0 || y > height as i8 + 1 {
        return true;
    }
    for &(dx, dy) in &CELLS[p as usize][o as usize] {
        let xx = x + dx;
        let yy = y + dy;
        if !(0..10).contains(&xx) || yy < 0 {
            return true;
        }
        if yy < height as i8 && board & (1u64 << (yy as u32 * 10 + xx as u32)) != 0 {
            return true;
        }
    }
    false
}
#[inline]
pub(crate) fn place_bits(p: Piece, o: u8, x: i8, y: i8) -> u64 {
    let mut bits = 0;
    for &(dx, dy) in &CELLS[p as usize][o as usize] {
        bits |= 1u64 << ((y + dy) as u32 * 10 + (x + dx) as u32)
    }
    bits
}

#[inline]
fn shift_anchor(bits: u128, delta: i32) -> u128 {
    if delta >= 0 {
        bits.checked_shl(delta as u32).unwrap_or(0)
    } else {
        bits.checked_shr((-delta) as u32).unwrap_or(0)
    }
}

#[inline]
fn board_to_anchor_space(board: u64, height: u8) -> u128 {
    let mut out = 0u128;
    for y in 0..height {
        out |= (((board >> (y as u32 * 10)) & FULL_ROW) as u128) << (y as u32 * 16);
    }
    out
}
#[inline]
fn anchor_bounds(max_x: i8, max_y: i8) -> u128 {
    let row = (1u128 << (max_x as u32 + 1)) - 1;
    let mut out = 0u128;
    for y in 0..=max_y {
        out |= row << (y as u32 * 16);
    }
    out
}
pub(crate) fn valid_anchor_masks(board: u64, p: Piece, height: u8) -> ([u128; 4], [u128; 4]) {
    let occupied = board_to_anchor_space(board, height);
    let mut valid = [0u128; 4];
    let mut inside = [0u128; 4];
    for o in 0..4usize {
        let bounds = anchor_bounds(MAX_X[p as usize][o], height as i8 + 1);
        let mut blocked = 0u128;
        for &(dx, dy) in &CELLS[p as usize][o] {
            blocked |= shift_anchor(occupied, -(dx as i32 + dy as i32 * ANCHOR_STRIDE));
        }
        valid[o] = bounds & !blocked;
        let max_inside_y = height as i8 - 1 - MAX_Y[p as usize][o];
        if max_inside_y >= 0 {
            inside[o] = anchor_bounds(MAX_X[p as usize][o], max_inside_y);
        }
    }
    (valid, inside)
}
// Expand only anchors that became reachable in the previous step.  This keeps
// the same movement graph as the fixed-point implementation while avoiding
// repeated rescans of the entire reached set.
pub(crate) fn add_rotation_frontier(
    p: Piece,
    frontier: &[u128; 4],
    reach: &[u128; 4],
    valid: &[u128; 4],
    physics: Physics,
) -> [u128; 4] {
    let mut out = [0u128; 4];
    if p == Piece::O {
        return out;
    }
    for o in 0..4usize {
        if frontier[o] == 0 {
            continue;
        }
        for dir in [1i8, -1, 2] {
            let no = ((o as i8
                + if dir == 2 {
                    2
                } else if dir == 1 {
                    1
                } else {
                    3
                })
                & 3) as usize;
            let mut remaining = frontier[o];
            if dir == 2 {
                let half: &[(i8, i8)] = match physics {
                    Physics::Jstris => &HALF[o],
                    Physics::Tetrio => &TETRIO_HALF[o],
                };
                for &(dx, dy) in half {
                    let delta = dx as i32 + dy as i32 * ANCHOR_STRIDE;
                    let src_ok = remaining & shift_anchor(valid[no], -delta);
                    if src_ok != 0 {
                        out[no] |= shift_anchor(src_ok, delta) & !reach[no];
                        remaining &= !src_ok;
                    }
                }
            } else {
                let kicks = &if p == Piece::I {
                    match physics {
                        Physics::Jstris => {
                            if dir == 1 {
                                I_CW
                            } else {
                                I_CCW
                            }
                        }
                        Physics::Tetrio => {
                            if dir == 1 {
                                TETRIO_I_CW
                            } else {
                                TETRIO_I_CCW
                            }
                        }
                    }
                } else if dir == 1 {
                    JLSTZ_CW
                } else {
                    JLSTZ_CCW
                };
                for &(dx, dy) in &kicks[o] {
                    let delta = dx as i32 + dy as i32 * ANCHOR_STRIDE;
                    let src_ok = remaining & shift_anchor(valid[no], -delta);
                    if src_ok != 0 {
                        out[no] |= shift_anchor(src_ok, delta) & !reach[no];
                        remaining &= !src_ok;
                    }
                }
            }
        }
    }
    out
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
struct ExactState {
    o: u8,
    x: i8,
    y: i8,
}

// SFinder cover checks exact locks in the SRS-origin coordinate system.  Keep
// this separate from the bounding-box representation used by the fast PC
// vector solver so cover kick priorities are reproduced without touching the
// real-time hot path.
const ORIGIN_SPAWN: [[(i8, i8); 4]; 7] = [
    [(0, 0), (-1, 0), (1, 0), (2, 0)],  // I
    [(0, 0), (-1, 0), (1, 0), (-1, 1)], // J
    [(0, 0), (-1, 0), (1, 0), (1, 1)],  // L
    [(0, 0), (1, 0), (0, 1), (1, 1)],   // O
    [(0, 0), (-1, 0), (0, 1), (1, 1)],  // S
    [(0, 0), (-1, 0), (1, 0), (0, 1)],  // T
    [(0, 0), (1, 0), (0, 1), (-1, 1)],  // Z
];

const fn rotate_origin_cell((x, y): (i8, i8), o: usize) -> (i8, i8) {
    match o & 3 {
        0 => (x, y),
        1 => (y, -x),
        2 => (-x, -y),
        _ => (-y, x),
    }
}

const fn build_origin_cells() -> [[[(i8, i8); 4]; 4]; 7] {
    let mut out = [[[(0, 0); 4]; 4]; 7];
    let mut p = 0;
    while p < 7 {
        let mut o = 0;
        while o < 4 {
            let mut i = 0;
            while i < 4 {
                out[p][o][i] = rotate_origin_cell(ORIGIN_SPAWN[p][i], o);
                i += 1;
            }
            o += 1;
        }
        p += 1;
    }
    out
}

const ORIGIN_CELLS: [[[(i8, i8); 4]; 4]; 7] = build_origin_cells();

const fn build_origin_bounds() -> [[(i8, i8, i8, i8); 4]; 7] {
    let mut out = [[(0, 0, 0, 0); 4]; 7];
    let mut p = 0;
    while p < 7 {
        let mut o = 0;
        while o < 4 {
            let mut min_x = 99;
            let mut max_x = -99;
            let mut min_y = 99;
            let mut max_y = -99;
            let mut i = 0;
            while i < 4 {
                let (x, y) = ORIGIN_CELLS[p][o][i];
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
                i += 1;
            }
            out[p][o] = (min_x, max_x, min_y, max_y);
            o += 1;
        }
        p += 1;
    }
    out
}

const ORIGIN_BOUNDS: [[(i8, i8, i8, i8); 4]; 7] = build_origin_bounds();

#[inline]
fn origin_pos(p: Piece, o: u8, i: usize) -> (i8, i8) {
    ORIGIN_CELLS[p as usize][(o & 3) as usize][i]
}
#[inline]
fn origin_bounds(p: Piece, o: u8) -> (i8, i8, i8, i8) {
    ORIGIN_BOUNDS[p as usize][(o & 3) as usize]
}
#[inline]
fn origin_collides(board: u64, p: Piece, o: u8, x: i8, y: i8, height: u8) -> bool {
    for i in 0..4 {
        let (dx, dy) = origin_pos(p, o, i);
        let xx = x + dx;
        let yy = y + dy;
        if !(0..10).contains(&xx) || yy < 0 {
            return true;
        }
        if yy < height as i8 && board & (1u64 << (yy as u32 * 10 + xx as u32)) != 0 {
            return true;
        }
    }
    false
}
#[inline]
fn origin_mask(p: Piece, o: u8, x: i8, y: i8, height: u8) -> Option<u64> {
    let mut m = 0u64;
    for i in 0..4 {
        let (dx, dy) = origin_pos(p, o, i);
        let xx = x + dx;
        let yy = y + dy;
        if !(0..10).contains(&xx) || yy < 0 || yy >= height as i8 {
            return None;
        }
        m |= 1u64 << (yy as u32 * 10 + xx as u32);
    }
    Some(m)
}

const RAW_J_CW: [[(i8, i8); 5]; 4] = [
    [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
    [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
    [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
    [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
];
const RAW_J_CCW: [[(i8, i8); 5]; 4] = [
    [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
    [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
    [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
    [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
];
const RAW_J_180_JSTRIS: [[(i8, i8); 2]; 4] = [
    [(0, 0), (0, 1)],
    [(0, 0), (1, 0)],
    [(0, 0), (0, -1)],
    [(0, 0), (-1, 0)],
];
const RAW_J_180_TETRIO: [[(i8, i8); 6]; 4] = [
    [(0, 0), (0, 1), (1, 1), (-1, 1), (1, 0), (-1, 0)],
    [(0, 0), (1, 0), (1, 2), (1, 1), (0, 2), (0, 1)],
    [(0, 0), (0, -1), (-1, -1), (1, -1), (-1, 0), (1, 0)],
    [(0, 0), (-1, 0), (-1, 2), (-1, 1), (0, 2), (0, 1)],
];
const RAW_I_CW: [[(i8, i8); 5]; 4] = [
    [(1, 0), (-1, 0), (2, 0), (-1, -1), (2, 2)],
    [(0, -1), (-1, -1), (2, -1), (-1, 1), (2, -2)],
    [(-1, 0), (1, 0), (-2, 0), (1, 1), (-2, -2)],
    [(0, 1), (1, 1), (-2, 1), (1, -1), (-2, 2)],
];
// Exact per-orientation CCW rows from the properties files: NW, EN, SE, WS.
const RAW_I_CCW: [[(i8, i8); 5]; 4] = [
    // N -> W (I.NW)
    [(0, -1), (-1, -1), (2, -1), (-1, 1), (2, -2)],
    // E -> N (I.EN)
    [(-1, 0), (1, 0), (-2, 0), (1, 1), (-2, -2)],
    // S -> E (I.SE)
    [(0, 1), (1, 1), (-2, 1), (1, -1), (-2, 2)],
    // W -> S (I.WS)
    [(1, 0), (-1, 0), (2, 0), (-1, -1), (2, 2)],
];
const RAW_I_CCW_TETRIO: [[(i8, i8); 5]; 4] = [
    // N -> W (I.NW)
    [(0, -1), (-1, -1), (2, -1), (2, -2), (-1, 1)],
    // E -> N (I.EN)
    [(-1, 0), (-2, 0), (1, 0), (-2, -2), (1, 1)],
    // S -> E (I.SE)
    [(0, 1), (-2, 1), (1, 1), (-2, 2), (1, -1)],
    // W -> S (I.WS)
    [(1, 0), (2, 0), (-1, 0), (2, 2), (-1, -1)],
];
const RAW_I_180: [[(i8, i8); 2]; 4] = [
    [(1, -1), (1, 0)],
    [(-1, -1), (0, -1)],
    [(-1, 1), (-1, 0)],
    [(1, 1), (0, 1)],
];
const RAW_O_CW: [[(i8, i8); 1]; 4] = [[(0, 1)], [(1, 0)], [(0, -1)], [(-1, 0)]];
const RAW_O_CCW: [[(i8, i8); 1]; 4] = [[(1, 0)], [(0, -1)], [(-1, 0)], [(0, 1)]];
const RAW_O_180: [[(i8, i8); 1]; 4] = [[(1, 1)], [(1, -1)], [(-1, -1)], [(-1, 1)]];

pub(crate) fn raw_kicks(p: Piece, o: usize, dir: i8, physics: Physics) -> &'static [(i8, i8)] {
    if p == Piece::O {
        return if dir == 2 {
            &RAW_O_180[o]
        } else if dir == 1 {
            &RAW_O_CW[o]
        } else {
            &RAW_O_CCW[o]
        };
    }
    if p == Piece::I {
        if dir == 2 {
            return &RAW_I_180[o];
        }
        if dir == 1 {
            return &RAW_I_CW[o];
        }
        return match physics {
            Physics::Jstris => &RAW_I_CCW[o],
            Physics::Tetrio => &RAW_I_CCW_TETRIO[o],
        };
    }
    if dir == 2 {
        return match physics {
            Physics::Jstris => &RAW_J_180_JSTRIS[o],
            Physics::Tetrio => &RAW_J_180_TETRIO[o],
        };
    }
    if dir == 1 {
        &RAW_J_CW[o]
    } else {
        &RAW_J_CCW[o]
    }
}
fn origin_rotate_forward(
    board: u64,
    p: Piece,
    st: ExactState,
    dir: i8,
    height: u8,
    physics: Physics,
) -> Option<ExactState> {
    let no = ((st.o as i8
        + if dir == 2 {
            2
        } else if dir == 1 {
            1
        } else {
            3
        })
        & 3) as u8;
    for &(dx, dy) in raw_kicks(p, st.o as usize, dir, physics) {
        let n = ExactState {
            o: no,
            x: st.x + dx,
            y: st.y + dy,
        };
        if !origin_collides(board, p, no, n.x, n.y, height) {
            return Some(n);
        }
    }
    None
}
fn origin_harddrop_reachable(
    board: u64,
    p: Piece,
    st: ExactState,
    height: u8,
    appear_y: i8,
) -> bool {
    let (_, _, _, max_y) = origin_bounds(p, st.o);
    let mut y = st.y + 1;
    let limit = appear_y - max_y;
    while y <= limit {
        if origin_collides(board, p, st.o, st.x, y, height) {
            return false;
        }
        y += 1;
    }
    true
}

const EXACT_X_MIN: i8 = -4;
const EXACT_X_MAX: i8 = 13;
const EXACT_Y_MIN: i8 = -4;
const EXACT_Y_MAX: i8 = 31;
const EXACT_X_COUNT: usize = (EXACT_X_MAX - EXACT_X_MIN + 1) as usize;
const EXACT_Y_COUNT: usize = (EXACT_Y_MAX - EXACT_Y_MIN + 1) as usize;
const EXACT_STATE_COUNT: usize = 4 * EXACT_X_COUNT * EXACT_Y_COUNT;
const EXACT_SEEN_WORDS: usize = EXACT_STATE_COUNT.div_ceil(64);

#[inline]
fn exact_state_id(st: ExactState) -> Option<usize> {
    if !(EXACT_X_MIN..=EXACT_X_MAX).contains(&st.x) || !(EXACT_Y_MIN..=EXACT_Y_MAX).contains(&st.y)
    {
        return None;
    }
    let x = (st.x - EXACT_X_MIN) as usize;
    let y = (st.y - EXACT_Y_MIN) as usize;
    Some((st.o as usize & 3) * EXACT_X_COUNT * EXACT_Y_COUNT + y * EXACT_X_COUNT + x)
}

#[inline]
fn push_exact_unseen(
    stack: &mut [ExactState; EXACT_STATE_COUNT],
    stack_len: &mut usize,
    seen: &mut [u64; EXACT_SEEN_WORDS],
    st: ExactState,
) {
    let Some(id) = exact_state_id(st) else {
        return;
    };
    let word = id >> 6;
    let bit = 1u64 << (id & 63);
    if seen[word] & bit != 0 {
        return;
    }
    seen[word] |= bit;
    stack[*stack_len] = st;
    *stack_len += 1;
}

fn origin_state_reachable(
    board: u64,
    p: Piece,
    starts: &[ExactState],
    height: u8,
    physics: Physics,
) -> bool {
    let appear_y = 24i8;
    let mut stack = [ExactState { o: 0, x: 0, y: 0 }; EXACT_STATE_COUNT];
    let mut stack_len = 0usize;
    let mut seen = [0u64; EXACT_SEEN_WORDS];
    for &st in starts {
        push_exact_unseen(&mut stack, &mut stack_len, &mut seen, st);
    }
    while stack_len != 0 {
        stack_len -= 1;
        let st = stack[stack_len];
        let (_, _, _, max_y) = origin_bounds(p, st.o);
        if st.y + max_y >= appear_y || origin_harddrop_reachable(board, p, st, height, appear_y) {
            return true;
        }
        let up = ExactState {
            o: st.o,
            x: st.x,
            y: st.y + 1,
        };
        if !origin_collides(board, p, up.o, up.x, up.y, height) {
            push_exact_unseen(&mut stack, &mut stack_len, &mut seen, up);
        }
        for nx in [st.x - 1, st.x + 1] {
            let n = ExactState {
                o: st.o,
                x: nx,
                y: st.y,
            };
            if !origin_collides(board, p, n.o, n.x, n.y, height) {
                push_exact_unseen(&mut stack, &mut stack_len, &mut seen, n);
            }
        }
        for dir in [1i8, -1, 2] {
            let po = ((st.o as i8
                - if dir == 2 {
                    2
                } else if dir == 1 {
                    1
                } else {
                    3
                })
                & 3) as u8;
            for &(dx, dy) in raw_kicks(p, po as usize, dir, physics) {
                let prev = ExactState {
                    o: po,
                    x: st.x - dx,
                    y: st.y - dy,
                };
                if origin_collides(board, p, po, prev.x, prev.y, height) {
                    continue;
                }
                if origin_rotate_forward(board, p, prev, dir, height, physics) == Some(st) {
                    push_exact_unseen(&mut stack, &mut stack_len, &mut seen, prev);
                }
            }
        }
    }
    false
}

#[inline]
fn corner_block(board: u64, x: i8, y: i8, height: u8) -> bool {
    if !(0..10).contains(&x) || y < 0 {
        return true;
    }
    if y >= height as i8 {
        return false;
    }
    board & (1u64 << (y as u32 * 10 + x as u32)) != 0
}
#[inline]
fn t_front_filled(board: u64, st: ExactState, height: u8) -> bool {
    match st.o & 3 {
        0 => {
            corner_block(board, st.x - 1, st.y + 1, height)
                && corner_block(board, st.x + 1, st.y + 1, height)
        }
        2 => {
            corner_block(board, st.x - 1, st.y - 1, height)
                && corner_block(board, st.x + 1, st.y - 1, height)
        }
        3 => {
            corner_block(board, st.x - 1, st.y - 1, height)
                && corner_block(board, st.x - 1, st.y + 1, height)
        }
        _ => {
            corner_block(board, st.x + 1, st.y - 1, height)
                && corner_block(board, st.x + 1, st.y + 1, height)
        }
    }
}
/// 0 = not a T-spin, 1 = Mini, 2 = Regular.  This mirrors the spin checks used
/// by SFinder cover for the default starting-B2B=0 wrapper contract.
pub fn tspin_kind_exact(board: u64, target_cells: u64, height: u8, physics: Physics) -> u8 {
    let p = Piece::T;
    let mut targets = [ExactState { o: 0, x: 0, y: 0 }; 16];
    let mut target_len = 0usize;
    for o in 0..4u8 {
        let (min_x, max_x, min_y, max_y) = origin_bounds(p, o);
        for y in -min_y..height as i8 - max_y {
            for x in -min_x..10 - max_x {
                if origin_mask(p, o, x, y, height) == Some(target_cells)
                    && !origin_collides(board, p, o, x, y, height)
                    && target_len < targets.len()
                {
                    targets[target_len] = ExactState { o, x, y };
                    target_len += 1;
                }
            }
        }
    }
    let mut best = 0u8;
    for &st in &targets[..target_len] {
        let corners = [
            corner_block(board, st.x - 1, st.y - 1, height),
            corner_block(board, st.x - 1, st.y + 1, height),
            corner_block(board, st.x + 1, st.y - 1, height),
            corner_block(board, st.x + 1, st.y + 1, height),
        ];
        if corners.into_iter().filter(|&x| x).count() < 3 {
            continue;
        }
        let front = t_front_filled(board, st, height);
        for dir in [1i8, -1, 2] {
            let po = ((st.o as i8
                - if dir == 2 {
                    2
                } else if dir == 1 {
                    1
                } else {
                    3
                })
                & 3) as u8;
            for (idx, &(dx, dy)) in raw_kicks(p, po as usize, dir, physics).iter().enumerate() {
                let prev = ExactState {
                    o: po,
                    x: st.x - dx,
                    y: st.y - dy,
                };
                let (_, _, min_y, max_y) = origin_bounds(p, po);
                if prev.y + min_y < 0
                    || prev.y + max_y >= height as i8
                    || origin_collides(board, p, po, prev.x, prev.y, height)
                {
                    continue;
                }
                if origin_rotate_forward(board, p, prev, dir, height, physics) != Some(st) {
                    continue;
                }
                if !origin_state_reachable(board, p, &[prev], height, physics) {
                    continue;
                }
                let privilege = dir != 2 && idx == 4 && (po & 1) == 0;
                let kind = if front || privilege { 2 } else { 1 };
                best = best.max(kind);
                if best == 2 {
                    return 2;
                }
            }
        }
    }
    best
}

/// SFinder-cover style reverse locked reachability for one exact operation.
pub fn reachable_exact_locked(
    board: u64,
    p: Piece,
    target_cells: u64,
    height: u8,
    physics: Physics,
) -> bool {
    let mut starts = [ExactState { o: 0, x: 0, y: 0 }; 16];
    let mut start_len = 0usize;
    for o in 0..4u8 {
        let (min_x, max_x, min_y, max_y) = origin_bounds(p, o);
        for y in -min_y..height as i8 - max_y {
            for x in -min_x..10 - max_x {
                if origin_mask(p, o, x, y, height) == Some(target_cells)
                    && !origin_collides(board, p, o, x, y, height)
                {
                    if start_len == starts.len() {
                        return false;
                    }
                    starts[start_len] = ExactState { o, x, y };
                    start_len += 1;
                }
            }
        }
    }
    origin_state_reachable(board, p, &starts[..start_len], height, physics)
}

pub fn reachable_placements_with_physics(
    board: u64,
    p: Piece,
    height: u8,
    physics: Physics,
) -> Vec<Placement> {
    let (valid, inside) = valid_anchor_masks(board, p, height);
    // reach[o] is always a subset of valid[o], and emitted locks are also
    // restricted by inside[o]. If no orientation has any valid in-board anchor,
    // the frontier can never produce a locked placement.
    if (0..4).all(|o| valid[o] & inside[o] == 0) {
        return Vec::new();
    }
    let mut reach = [0u128; 4];
    let spawn_rows =
        (0xffffu128 << (height as u32 * 16)) | (0xffffu128 << ((height as u32 + 1) * 16));
    for o in 0..4 {
        reach[o] = valid[o] & spawn_rows
    }
    let mut frontier = reach;
    while frontier.iter().any(|&x| x != 0) {
        let mut next = [0u128; 4];
        for o in 0..4 {
            next[o] |= ((frontier[o] << 1) | (frontier[o] >> 1) | (frontier[o] >> 16))
                & valid[o]
                & !reach[o];
        }
        let rotated = add_rotation_frontier(p, &frontier, &reach, &valid, physics);
        for o in 0..4 {
            next[o] |= rotated[o] & !reach[o];
            reach[o] |= next[o];
        }
        frontier = next;
    }
    let mask = board_mask(height);
    let mut out = Vec::with_capacity(48);
    // Lock counts are tiny. A linear scan over the already-emitted compact
    // keys avoids allocating a hash table for every placement query.
    let mut dedup4 = [0u64; 256];
    let mut dedup_tall = [0u128; 256];
    let mut dedup_len = 0usize;
    for o in 0..4usize {
        let downable = valid[o] << 16;
        let mut locks = reach[o] & inside[o] & !downable;
        while locks != 0 {
            let bit = locks.trailing_zeros();
            locks &= locks - 1;
            let y = (bit / 16) as i8;
            let x = (bit % 16) as i8;
            let bits = place_bits(p, o as u8, x, y);
            if bits & board != 0 || bits & !mask != 0 {
                continue;
            }
            let raw = board | bits;
            let next = normalize_after_placement(raw, height);
            let co = match p {
                Piece::O => 0,
                Piece::I | Piece::S | Piece::Z => (o as u8) & 1,
                _ => o as u8,
            };
            let duplicate = if height <= 4 {
                let key = next
                    | ((co as u64) << 40)
                    | ((x as u8 as u64) << 42)
                    | ((y as u8 as u64) << 50);
                if dedup4[..dedup_len].contains(&key) {
                    true
                } else if dedup_len < dedup4.len() {
                    dedup4[dedup_len] = key;
                    false
                } else {
                    false
                }
            } else {
                let key = (next as u128)
                    | ((co as u128) << 64)
                    | ((x as u8 as u128) << 66)
                    | ((y as u8 as u128) << 74);
                if dedup_tall[..dedup_len].contains(&key) {
                    true
                } else if dedup_len < dedup_tall.len() {
                    dedup_tall[dedup_len] = key;
                    false
                } else {
                    false
                }
            };
            if duplicate {
                continue;
            }
            if dedup_len < dedup4.len() {
                dedup_len += 1;
            } else {
                // The fixed array is intentionally much larger than any
                // normal lock set. Preserve correctness if a future ruleset
                // exceeds it by falling back to the output itself.
                if out.iter().any(|pl: &Placement| {
                    pl.board == next
                        && match p {
                            Piece::O => 0,
                            Piece::I | Piece::S | Piece::Z => pl.orientation & 1,
                            _ => pl.orientation,
                        } == co
                        && pl.x == x
                        && pl.y == y
                }) {
                    continue;
                }
            }
            out.push(Placement {
                piece: p,
                orientation: o as u8,
                x,
                y,
                board: next,
                raw_board: raw,
                cells: bits,
            });
        }
    }
    out
}

pub fn reachable_placements(board: u64, p: Piece, height: u8) -> Vec<Placement> {
    reachable_placements_with_physics(board, p, height, Physics::Jstris)
}

#[cfg(test)]
pub(crate) fn reachable_placements_bfs(board: u64, p: Piece, height: u8) -> Vec<Placement> {
    use std::collections::VecDeque;
    #[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
    struct State {
        o: u8,
        x: i8,
        y: i8,
    }
    fn rotate(board: u64, p: Piece, s: State, dir: i8, height: u8) -> Option<State> {
        if p == Piece::O {
            return None;
        }
        let no = ((s.o as i8
            + if dir == 2 {
                2
            } else if dir == 1 {
                1
            } else {
                3
            })
            & 3) as u8;
        if dir == 2 {
            for &(dx, dy) in &HALF[s.o as usize] {
                let n = State {
                    o: no,
                    x: s.x + dx,
                    y: s.y + dy,
                };
                if !collides(board, p, no, n.x, n.y, height) {
                    return Some(n);
                }
            }
        } else {
            let kicks = &if p == Piece::I {
                if dir == 1 { I_CW } else { I_CCW }
            } else if dir == 1 {
                JLSTZ_CW
            } else {
                JLSTZ_CCW
            };
            for &(dx, dy) in &kicks[s.o as usize] {
                let n = State {
                    o: no,
                    x: s.x + dx,
                    y: s.y + dy,
                };
                if !collides(board, p, no, n.x, n.y, height) {
                    return Some(n);
                }
            }
        }
        None
    }
    let mut q = VecDeque::new();
    let mut seen = HashSet::new();
    for o in 0..4u8 {
        for y in height as i8..=height as i8 + 1 {
            for x in 0..=MAX_X[p as usize][o as usize] {
                let s = State { o, x, y };
                if !collides(board, p, o, x, y, height) && seen.insert(s) {
                    q.push_back(s)
                }
            }
        }
    }
    let mask = board_mask(height);
    let mut out = Vec::new();
    let mut dedup = HashSet::new();
    while let Some(s) = q.pop_front() {
        if s.y + MAX_Y[p as usize][s.o as usize] < height as i8
            && collides(board, p, s.o, s.x, s.y - 1, height)
        {
            let bits = place_bits(p, s.o, s.x, s.y);
            if bits & board == 0 && bits & !mask == 0 {
                let raw = board | bits;
                let next = normalize_after_placement(raw, height);
                let co = match p {
                    Piece::O => 0,
                    Piece::I | Piece::S | Piece::Z => s.o & 1,
                    _ => s.o,
                };
                if dedup.insert((next, co, s.x, s.y)) {
                    out.push(Placement {
                        piece: p,
                        orientation: s.o,
                        x: s.x,
                        y: s.y,
                        board: next,
                        raw_board: raw,
                        cells: bits,
                    })
                }
            }
        }
        for n in [
            State {
                o: s.o,
                x: s.x - 1,
                y: s.y,
            },
            State {
                o: s.o,
                x: s.x + 1,
                y: s.y,
            },
            State {
                o: s.o,
                x: s.x,
                y: s.y - 1,
            },
        ] {
            if !collides(board, p, n.o, n.x, n.y, height) && seen.insert(n) {
                q.push_back(n)
            }
        }
        for d in [1, -1, 2] {
            if let Some(n) = rotate(board, p, s, d, height)
                && seen.insert(n)
            {
                q.push_back(n)
            }
        }
    }
    out
}
