use crate::state::WasmSolver;
use pc_core::{PcSolver, Solution, decode_queue_array};

const SOLUTION_WORD_STRIDE: usize = 9;

// 0=false, 1=true, 2=budget exhausted or invalid input. Unknown is not false.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_probe_can_pc(
    ptr: *mut WasmSolver,
    board: u64,
    qbits: u64,
    qlen: u32,
    hold: u32,
    budget: u32,
) -> u32 {
    if ptr.is_null() || qlen > 21 || decode_queue_array(qbits, qlen as u8).is_none() {
        return 2;
    }
    match unsafe { &mut *ptr }.core.probe_can_pc_packed(
        board,
        qbits,
        qlen as u8,
        hold != 0,
        budget as u64,
    ) {
        Some(result) => result as u32,
        None => 2,
    }
}

fn set_concrete_solutions(
    solver: &mut WasmSolver,
    queue: &[pc_core::Piece],
    solutions: Vec<Solution>,
) {
    solver.solutions = solutions;
    solver.solution_saves.clear();
    solver.solution_saves.reserve(solver.solutions.len());
    for solution in &solver.solutions {
        solver
            .solution_saves
            .push(PcSolver::saved_piece_for_solution(queue, solution));
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_can_pc(
    ptr: *mut WasmSolver,
    board: u64,
    qbits: u64,
    qlen: u32,
    hold: u32,
) -> u32 {
    if ptr.is_null() || qlen > 21 {
        return 0;
    }
    let Some((q, qn)) = decode_queue_array(qbits, qlen as u8) else {
        return 0;
    };
    unsafe { &mut *ptr }.core.can_pc(board, &q[..qn], hold != 0) as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_can_pc_many(
    ptr: *mut WasmSolver,
    board: u64,
    qbits_ptr: *const u64,
    qlen_ptr: *const u8,
    count: u32,
    hold: u32,
    out_ptr: *mut u8,
) -> u32 {
    if ptr.is_null()
        || (count > 0 && (qbits_ptr.is_null() || qlen_ptr.is_null() || out_ptr.is_null()))
    {
        return 0;
    }
    let qbits = unsafe { core::slice::from_raw_parts(qbits_ptr, count as usize) };
    let qlens = unsafe { core::slice::from_raw_parts(qlen_ptr, count as usize) };
    let out = unsafe { core::slice::from_raw_parts_mut(out_ptr, count as usize) };
    for i in 0..count as usize {
        if qlens[i] > 21 || decode_queue_array(qbits[i], qlens[i]).is_none() {
            return 0;
        }
    }
    unsafe { &mut *ptr }
        .core
        .can_pc_many_packed(board, qbits, qlens, hold != 0, out) as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_can_pc_pattern_many(
    ptr: *mut WasmSolver,
    board: u64,
    qbits_ptr: *const u64,
    qlen_ptr: *const u8,
    count: u32,
    hold: u32,
    out_ptr: *mut u8,
) -> u32 {
    if ptr.is_null()
        || (count > 0 && (qbits_ptr.is_null() || qlen_ptr.is_null() || out_ptr.is_null()))
    {
        return 0;
    }
    let qbits = unsafe { core::slice::from_raw_parts(qbits_ptr, count as usize) };
    let qlens = unsafe { core::slice::from_raw_parts(qlen_ptr, count as usize) };
    let out = unsafe { core::slice::from_raw_parts_mut(out_ptr, count as usize) };
    for i in 0..count as usize {
        if qlens[i] > 21 || decode_queue_array(qbits[i], qlens[i]).is_none() {
            return 0;
        }
    }
    unsafe { &mut *ptr }
        .core
        .can_pc_pattern_many_packed(board, qbits, qlens, hold != 0, out) as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_enumerate_pc(
    ptr: *mut WasmSolver,
    board: u64,
    qbits: u64,
    qlen: u32,
    hold: u32,
) -> u32 {
    if ptr.is_null() || qlen > 21 {
        return 0;
    }
    let Some((q, qn)) = decode_queue_array(qbits, qlen as u8) else {
        return 0;
    };
    let s = unsafe { &mut *ptr };
    let solutions = s.core.enumerate_pc(board, &q[..qn], hold != 0);
    set_concrete_solutions(s, &q[..qn], solutions);
    s.solutions.len() as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_best_pc(
    ptr: *mut WasmSolver,
    board: u64,
    qbits: u64,
    qlen: u32,
    hold: u32,
) -> u32 {
    if ptr.is_null() || qlen > 21 {
        return 0;
    }
    let Some((q, qn)) = decode_queue_array(qbits, qlen as u8) else {
        return 0;
    };
    let s = unsafe { &mut *ptr };
    s.solutions.clear();
    s.solution_saves.clear();
    if let Some(solution) = s.core.best_pc(board, &q[..qn], hold != 0) {
        let saved = PcSolver::saved_piece_for_solution(&q[..qn], &solution);
        s.solutions.push(solution);
        s.solution_saves.push(saved);
        1
    } else {
        0
    }
}

// Pattern-level broad 4..=6-line compatibility enumeration. The Rust core shares
// geometry across all concrete queues and returns sparse per-solution case
// coverage plus the playable-order count used by human-quality tie breaking.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_enumerate_pc_pattern(
    ptr: *mut WasmSolver,
    board: u64,
    qbits_ptr: *const u64,
    qlen_ptr: *const u8,
    count: u32,
    hold: u32,
) -> u32 {
    if ptr.is_null() || (count > 0 && (qbits_ptr.is_null() || qlen_ptr.is_null())) {
        return u32::MAX;
    }
    let qbits = unsafe { core::slice::from_raw_parts(qbits_ptr, count as usize) };
    let qlens = unsafe { core::slice::from_raw_parts(qlen_ptr, count as usize) };
    for i in 0..count as usize {
        if qlens[i] > 21 || decode_queue_array(qbits[i], qlens[i]).is_none() {
            return u32::MAX;
        }
    }
    let s = unsafe { &mut *ptr };
    let Some(rows) = s
        .core
        .enumerate_pc_pattern_packed(board, qbits, qlens, hold != 0)
    else {
        return u32::MAX;
    };
    s.solutions.clear();
    s.solution_saves.clear();
    s.pattern_offsets.clear();
    s.pattern_case_ids.clear();
    s.pattern_order_counts.clear();
    s.pattern_offsets.reserve(rows.len() + 1);
    s.pattern_offsets.push(0);
    for row in rows {
        s.solutions.push(row.solution);
        s.solution_saves.push(7);
        for (case, order_count) in row.cases {
            s.pattern_case_ids.push(case);
            s.pattern_order_counts.push(order_count);
        }
        s.pattern_offsets.push(s.pattern_case_ids.len() as u32);
    }
    s.solutions.len() as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_coverage_offset(
    ptr: *mut WasmSolver,
    solution_index: u32,
) -> u32 {
    if ptr.is_null() {
        return u32::MAX;
    }
    unsafe { &*ptr }
        .pattern_offsets
        .get(solution_index as usize)
        .copied()
        .unwrap_or(u32::MAX)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_coverage_case(
    ptr: *mut WasmSolver,
    entry_index: u32,
) -> u32 {
    if ptr.is_null() {
        return u32::MAX;
    }
    unsafe { &*ptr }
        .pattern_case_ids
        .get(entry_index as usize)
        .copied()
        .unwrap_or(u32::MAX)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_coverage_order_count(
    ptr: *mut WasmSolver,
    entry_index: u32,
) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { &*ptr }
        .pattern_order_counts
        .get(entry_index as usize)
        .copied()
        .unwrap_or(0)
}

// Single-concrete-queue fast API for qniapc/per-save-minimals.  It returns
// only the best solution for each save piece, ranked by playable piece-order
// count and then by a deterministic compact-solution key.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_per_save_best(
    ptr: *mut WasmSolver,
    board: u64,
    qbits: u64,
    qlen: u32,
    hold: u32,
    candidate_limit: u32,
) -> u32 {
    if ptr.is_null() || qlen > 21 {
        return 0;
    }
    let Some((q, qn)) = decode_queue_array(qbits, qlen as u8) else {
        return 0;
    };
    let s = unsafe { &mut *ptr };
    let best = s
        .core
        .per_save_best(board, &q[..qn], hold != 0, candidate_limit.max(1) as usize);
    s.solutions.clear();
    s.solution_saves.clear();
    s.solutions.reserve(best.len());
    s.solution_saves.reserve(best.len());
    for (piece, solution) in best {
        s.solution_saves.push(piece as u8);
        s.solutions.push(solution);
    }
    s.solutions.len() as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_solution_word_stride() -> u32 {
    SOLUTION_WORD_STRIDE as u32
}

// Bulk solution export: seven piece masks, order count, saved-piece code.
// This replaces 8-9 JS->WASM getter calls per solution on hot UI paths.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_copy_solution_words(
    ptr: *mut WasmSolver,
    out_ptr: *mut u64,
    capacity_words: u32,
) -> u32 {
    if ptr.is_null() {
        return u32::MAX;
    }
    let s = unsafe { &*ptr };
    let required = s.solutions.len().saturating_mul(SOLUTION_WORD_STRIDE);
    if required > u32::MAX as usize {
        return u32::MAX;
    }
    if required == 0 {
        return 0;
    }
    if out_ptr.is_null() || (capacity_words as usize) < required {
        return required as u32;
    }
    let out = unsafe { core::slice::from_raw_parts_mut(out_ptr, required) };
    for (index, solution) in s.solutions.iter().enumerate() {
        let base = index * SOLUTION_WORD_STRIDE;
        out[base..base + 7].copy_from_slice(&solution.masks);
        out[base + 7] = solution.order_count as u64;
        out[base + 8] = s.solution_saves.get(index).copied().unwrap_or(7) as u64;
    }
    required as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_solution_mask(ptr: *mut WasmSolver, index: u32, piece: u32) -> u64 {
    if ptr.is_null() || piece >= 7 {
        return 0;
    }
    unsafe { &*ptr }
        .solutions
        .get(index as usize)
        .map(|x| x.masks[piece as usize])
        .unwrap_or(0)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_solution_order_count(ptr: *mut WasmSolver, index: u32) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { &*ptr }
        .solutions
        .get(index as usize)
        .map(|x| x.order_count)
        .unwrap_or(0)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_solution_saved_piece(ptr: *mut WasmSolver, index: u32) -> u32 {
    if ptr.is_null() {
        return 7;
    }
    unsafe { &*ptr }
        .solution_saves
        .get(index as usize)
        .copied()
        .unwrap_or(7) as u32
}

// Borrowed bulk CSR views; JS copies these before any further WASM mutation.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_offsets_ptr(ptr: *mut WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { &*ptr }.pattern_offsets.as_ptr()
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_cases_ptr(ptr: *mut WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { &*ptr }.pattern_case_ids.as_ptr()
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_pattern_qualities_ptr(ptr: *mut WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { &*ptr }.pattern_order_counts.as_ptr()
}
