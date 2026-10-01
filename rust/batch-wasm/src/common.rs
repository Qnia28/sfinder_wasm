use pc_core::{Physics, Piece, normalize_after_placement, reachable_exact_locked};

pub(crate) fn physics(v: u32) -> Physics {
    if v == 1 {
        Physics::Tetrio
    } else {
        Physics::Jstris
    }
}

#[inline]
fn locked_next_board_uncached(
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

// Only retained inside an explicit synchronous batch session. Both positive
// and negative exact-lock results distinguish physics and the target mask.
type LockKey = (u64, u64, u8, u8, u8);
#[derive(Default)]
struct ExactCache {
    depth: u32,
    locks: pc_core::FastMap<LockKey, Option<u64>>,
    spins: pc_core::FastMap<(u64, u64, u8, u8), u8>,
}
thread_local! {
    static EXACT_CACHE: std::cell::RefCell<ExactCache> = std::cell::RefCell::new(ExactCache::default());
}
pub(crate) fn begin_session() {
    EXACT_CACHE.with(|cell| cell.borrow_mut().depth += 1);
}
pub(crate) fn end_session() {
    EXACT_CACHE.with(|cell| {
        let mut cache = cell.borrow_mut();
        cache.depth = cache.depth.saturating_sub(1);
        if cache.depth == 0 {
            *cache = ExactCache::default();
        }
    });
}
pub(crate) fn in_session() -> bool {
    EXACT_CACHE.with(|cell| cell.borrow().depth != 0)
}
pub(crate) fn locked_next_board(
    board: u64,
    piece: Piece,
    target: u64,
    height: u8,
    physics: Physics,
) -> Option<u64> {
    crate::diagnostics::add(4, 1);
    EXACT_CACHE.with(|cell| {
        let mut cache = cell.borrow_mut();
        if cache.depth == 0 {
            return locked_next_board_uncached(board, piece, target, height, physics);
        }
        let key = (board, target, height, physics as u8, piece as u8);
        if let Some(&hit) = cache.locks.get(&key) {
            crate::diagnostics::add(5, 1);
            return hit;
        }
        let result = locked_next_board_uncached(board, piece, target, height, physics);
        if cache.locks.len() < 65_536 {
            cache.locks.insert(key, result);
        }
        result
    })
}
pub(crate) fn cached_tspin_kind(board: u64, target: u64, height: u8, physics: Physics) -> u8 {
    crate::diagnostics::add(6, 1);
    EXACT_CACHE.with(|cell| {
        let mut cache = cell.borrow_mut();
        if cache.depth == 0 {
            return pc_core::tspin_kind_exact(board, target, height, physics);
        }
        let key = (board, target, height, physics as u8);
        if let Some(&hit) = cache.spins.get(&key) {
            crate::diagnostics::add(7, 1);
            return hit;
        }
        let result = pc_core::tspin_kind_exact(board, target, height, physics);
        if cache.spins.len() < 16_384 {
            cache.spins.insert(key, result);
        }
        result
    })
}
