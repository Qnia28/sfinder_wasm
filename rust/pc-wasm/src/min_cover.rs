use crate::state::WasmSolver;
use pc_core::min_cover::{
    BoundedQualityResult, exact_minimum_cardinality_cover, exact_minimum_cover,
    exact_primary_cardinality_kernel, exact_quality_cover_at_count_bounded,
    exact_quality_cover_at_count_integrated_bounded,
    exact_quality_cover_at_count_integrated_dominance_bounded,
    exact_quality_cover_at_count_integrated_partitioned_bounded,
    exact_quality_cover_at_count_progress_bounded, exact_quality_cover_at_count_with_locked_prefix,
};

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernelize(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
) -> u32 {
    if ptr.is_null() || offsets_ptr.is_null() || (entry_count > 0 && ids_ptr.is_null()) {
        return u32::MAX;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
    {
        return u32::MAX;
    }
    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        cases.push(ids[start..end].to_vec());
    }
    let Some(kernel) = exact_primary_cardinality_kernel(&cases, solution_count as usize) else {
        return u32::MAX;
    };
    let solver = unsafe { &mut *ptr };
    solver.primary_kernel_offsets.clear();
    solver.primary_kernel_ids.clear();
    solver.primary_kernel_solution_ids = kernel.solution_ids;
    solver.primary_kernel_forced = kernel.forced;
    solver
        .primary_kernel_offsets
        .reserve(kernel.cases.len() + 1);
    solver.primary_kernel_offsets.push(0);
    for row in kernel.cases {
        solver.primary_kernel_ids.extend(row);
        solver
            .primary_kernel_offsets
            .push(solver.primary_kernel_ids.len() as u32);
    }
    (solver.primary_kernel_offsets.len().saturating_sub(1)) as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_case_count(ptr: *const WasmSolver) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { (&*ptr).primary_kernel_offsets.len().saturating_sub(1) as u32 }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_entry_count(ptr: *const WasmSolver) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { (&*ptr).primary_kernel_ids.len() as u32 }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_solution_count(ptr: *const WasmSolver) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { (&*ptr).primary_kernel_solution_ids.len() as u32 }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_forced_count(ptr: *const WasmSolver) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { (&*ptr).primary_kernel_forced.len() as u32 }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_offsets_ptr(ptr: *const WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { (&*ptr).primary_kernel_offsets.as_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_ids_ptr(ptr: *const WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { (&*ptr).primary_kernel_ids.as_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_solution_ids_ptr(
    ptr: *const WasmSolver,
) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { (&*ptr).primary_kernel_solution_ids.as_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_primary_kernel_forced_ptr(ptr: *const WasmSolver) -> *const u32 {
    if ptr.is_null() {
        return core::ptr::null();
    }
    unsafe { (&*ptr).primary_kernel_forced.as_ptr() }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_cardinality(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
) -> u32 {
    if ptr.is_null() || offsets_ptr.is_null() || (entry_count > 0 && ids_ptr.is_null()) {
        return u32::MAX;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
    {
        return u32::MAX;
    }
    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        cases.push(ids[start..end].iter().map(|&id| (id, 0)).collect());
    }
    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_searched_states = 0;
    let Some(result) = exact_minimum_cardinality_cover(&cases, solution_count as usize) else {
        return u32::MAX;
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_searched_states = result.searched_states;
    solver.min_cover_selected.len() as u32
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
) -> u32 {
    if ptr.is_null() || offsets_ptr.is_null() || (entry_count > 0 && ids_ptr.is_null()) {
        return u32::MAX;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    let qualities = if quality_ptr.is_null() {
        None
    } else {
        Some(unsafe { core::slice::from_raw_parts(quality_ptr, entry_count as usize) })
    };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
    {
        return u32::MAX;
    }

    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        let mut row = Vec::with_capacity(end - start);
        for index in start..end {
            row.push((ids[index], qualities.map_or(0, |q| q[index])));
        }
        cases.push(row);
    }

    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_searched_states = 0;
    let Some(result) = exact_minimum_cover(&cases, solution_count as usize) else {
        return u32::MAX;
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_quality = result.quality;
    solver.min_cover_searched_states = result.searched_states;
    solver.min_cover_selected.len() as u32
}

const MIN_COVER_ERROR: u32 = u32::MAX;
const MIN_COVER_BUDGET_EXCEEDED: u32 = u32::MAX - 1;

// Isolated experimental ABI. budget=0 is a real zero budget; u32::MAX means
// unlimited. Production exports and JS options remain unchanged.
#[cfg(feature = "threshold-experiment")]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_threshold_experiment(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    locked_ptr: *const u32,
    locked_count: u32,
    budget: u32,
    mask: u32,
) -> u32 {
    if ptr.is_null() {
        return MIN_COVER_ERROR;
    }
    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_proven_prefix.clear();
    solver.min_cover_searched_states = 0;
    solver.threshold_diagnostics.fill(0);
    if offsets_ptr.is_null()
        || mask > 127
        || (mask & 96 != 0 && mask & 4 == 0)
        || seed_count != exact_count
        || (entry_count > 0 && (ids_ptr.is_null() || quality_ptr.is_null()))
        || (seed_count > 0 && seed_ptr.is_null())
        || (locked_count > 0 && locked_ptr.is_null())
    {
        return MIN_COVER_ERROR;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    // Empty slices must not be constructed from null pointers, even with len=0.
    let ids = if entry_count == 0 {
        &[][..]
    } else {
        unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) }
    };
    let qualities = if entry_count == 0 {
        &[][..]
    } else {
        unsafe { core::slice::from_raw_parts(quality_ptr, entry_count as usize) }
    };
    let seed = if seed_count == 0 {
        &[][..]
    } else {
        unsafe { core::slice::from_raw_parts(seed_ptr, seed_count as usize) }
    };
    let locked = if locked_count == 0 {
        &[][..]
    } else {
        unsafe { core::slice::from_raw_parts(locked_ptr, locked_count as usize) }
    };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().chain(seed).any(|&id| id >= solution_count)
    {
        return MIN_COVER_ERROR;
    }
    let cases: Vec<Vec<(u32, u32)>> = offsets
        .windows(2)
        .map(|w| {
            (w[0] as usize..w[1] as usize)
                .map(|i| (ids[i], qualities[i]))
                .collect()
        })
        .collect();
    let Some((result, prefix, diagnostics)) =
        pc_core::min_cover::exact_quality_cover_at_count_experiment(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            locked,
            (budget != u32::MAX).then_some(budget as u64),
            mask,
        )
    else {
        return MIN_COVER_ERROR;
    };
    solver.min_cover_proven_prefix = prefix;
    solver.threshold_diagnostics = diagnostics;
    let (completed, result) = match result {
        BoundedQualityResult::Exact(r) => (true, r),
        BoundedQualityResult::BudgetExceeded(r) => (false, r),
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_quality = result.quality;
    solver.min_cover_searched_states = result.searched_states;
    if completed {
        solver.min_cover_selected.len() as u32
    } else {
        MIN_COVER_BUDGET_EXCEEDED
    }
}

#[cfg(feature = "threshold-experiment")]
#[unsafe(no_mangle)]
pub extern "C" fn solver_threshold_experiment_version() -> u32 {
    2
}

#[cfg(feature = "threshold-experiment")]
#[unsafe(no_mangle)]
pub extern "C" fn solver_threshold_trace_enabled() -> u32 {
    u32::from(cfg!(feature = "threshold-trace"))
}

#[cfg(feature = "threshold-experiment")]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_threshold_diagnostic(ptr: *const WasmSolver, index: u32) -> u64 {
    if ptr.is_null() {
        return 0;
    }
    unsafe {
        (&*ptr)
            .threshold_diagnostics
            .get(index as usize)
            .copied()
            .unwrap_or(0)
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_locked(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    locked_ptr: *const u32,
    locked_count: u32,
) -> u32 {
    if ptr.is_null()
        || offsets_ptr.is_null()
        || (entry_count > 0 && ids_ptr.is_null())
        || seed_ptr.is_null()
        || seed_count != exact_count
        || (locked_count > 0 && locked_ptr.is_null())
    {
        return u32::MAX;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    let qualities = if quality_ptr.is_null() {
        None
    } else {
        Some(unsafe { core::slice::from_raw_parts(quality_ptr, entry_count as usize) })
    };
    let seed = unsafe { core::slice::from_raw_parts(seed_ptr, seed_count as usize) };
    let locked = if locked_count == 0 {
        &[][..]
    } else {
        unsafe { core::slice::from_raw_parts(locked_ptr, locked_count as usize) }
    };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
        || seed.iter().any(|&id| id >= solution_count)
    {
        return u32::MAX;
    }
    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        let mut row = Vec::with_capacity(end - start);
        for index in start..end {
            row.push((ids[index], qualities.map_or(0, |q| q[index])));
        }
        cases.push(row);
    }
    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_searched_states = 0;
    let Some(result) = exact_quality_cover_at_count_with_locked_prefix(
        &cases,
        solution_count as usize,
        exact_count as usize,
        seed,
        locked,
    ) else {
        return u32::MAX;
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_quality = result.quality;
    solver.min_cover_searched_states = result.searched_states;
    solver.min_cover_selected.len() as u32
}

#[allow(clippy::too_many_arguments)]
unsafe fn solver_min_cover_at_count_bounded_impl(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
    collect_progress: bool,
) -> u32 {
    if !ptr.is_null() {
        unsafe { &mut *ptr }.min_cover_proven_prefix.clear();
    }
    if ptr.is_null()
        || offsets_ptr.is_null()
        || (entry_count > 0 && ids_ptr.is_null())
        || seed_ptr.is_null()
        || seed_count != exact_count
    {
        return MIN_COVER_ERROR;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    let qualities = if quality_ptr.is_null() {
        None
    } else {
        Some(unsafe { core::slice::from_raw_parts(quality_ptr, entry_count as usize) })
    };
    let seed = unsafe { core::slice::from_raw_parts(seed_ptr, seed_count as usize) };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
        || seed.iter().any(|&id| id >= solution_count)
    {
        return MIN_COVER_ERROR;
    }
    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        let mut row = Vec::with_capacity(end - start);
        for index in start..end {
            row.push((ids[index], qualities.map_or(0, |q| q[index])));
        }
        cases.push(row);
    }
    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_searched_states = 0;
    let budget = (state_budget != 0).then_some(state_budget as u64);
    let outcome = if collect_progress {
        exact_quality_cover_at_count_progress_bounded(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            budget,
        )
    } else {
        exact_quality_cover_at_count_bounded(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            budget,
        )
        .map(|result| (result, Vec::new()))
    };
    let Some((result, prefix)) = outcome else {
        return MIN_COVER_ERROR;
    };
    solver.min_cover_proven_prefix = prefix;
    let (completed, result) = match result {
        BoundedQualityResult::Exact(result) => (true, result),
        BoundedQualityResult::BudgetExceeded(result) => (false, result),
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_quality = result.quality;
    solver.min_cover_searched_states = result.searched_states;
    if completed {
        solver.min_cover_selected.len() as u32
    } else {
        MIN_COVER_BUDGET_EXCEEDED
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_bounded(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
) -> u32 {
    unsafe {
        solver_min_cover_at_count_bounded_impl(
            ptr,
            offsets_ptr,
            case_count,
            ids_ptr,
            quality_ptr,
            entry_count,
            solution_count,
            exact_count,
            seed_ptr,
            seed_count,
            state_budget,
            false,
        )
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_progress_bounded(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
) -> u32 {
    unsafe {
        solver_min_cover_at_count_bounded_impl(
            ptr,
            offsets_ptr,
            case_count,
            ids_ptr,
            quality_ptr,
            entry_count,
            solution_count,
            exact_count,
            seed_ptr,
            seed_count,
            state_budget,
            true,
        )
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_proven_prefix_len(ptr: *const WasmSolver) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { &*ptr }.min_cover_proven_prefix.len() as u32
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_proven_prefix(ptr: *const WasmSolver, index: u32) -> u32 {
    if ptr.is_null() {
        return u32::MAX;
    }
    unsafe { &*ptr }
        .min_cover_proven_prefix
        .get(index as usize)
        .copied()
        .unwrap_or(u32::MAX)
}

#[allow(clippy::too_many_arguments)]
unsafe fn solver_min_cover_at_count_integrated_bounded_impl(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
    candidate_dominance: bool,
    partition_siblings: bool,
) -> u32 {
    if ptr.is_null()
        || offsets_ptr.is_null()
        || (entry_count > 0 && ids_ptr.is_null())
        || seed_ptr.is_null()
        || seed_count != exact_count
    {
        return MIN_COVER_ERROR;
    }
    let offsets = unsafe { core::slice::from_raw_parts(offsets_ptr, case_count as usize + 1) };
    let ids = unsafe { core::slice::from_raw_parts(ids_ptr, entry_count as usize) };
    let qualities = if quality_ptr.is_null() {
        None
    } else {
        Some(unsafe { core::slice::from_raw_parts(quality_ptr, entry_count as usize) })
    };
    let seed = unsafe { core::slice::from_raw_parts(seed_ptr, seed_count as usize) };
    if offsets.first().copied() != Some(0)
        || offsets.last().copied() != Some(entry_count)
        || offsets.windows(2).any(|w| w[0] > w[1])
        || ids.iter().any(|&id| id >= solution_count)
        || seed.iter().any(|&id| id >= solution_count)
    {
        return MIN_COVER_ERROR;
    }
    let mut cases = Vec::with_capacity(case_count as usize);
    for case in 0..case_count as usize {
        let start = offsets[case] as usize;
        let end = offsets[case + 1] as usize;
        let mut row = Vec::with_capacity(end - start);
        for index in start..end {
            row.push((ids[index], qualities.map_or(0, |q| q[index])));
        }
        cases.push(row);
    }
    let solver = unsafe { &mut *ptr };
    solver.min_cover_selected.clear();
    solver.min_cover_quality.clear();
    solver.min_cover_searched_states = 0;
    let budget = (state_budget != 0).then_some(state_budget as u64);
    let result = if partition_siblings {
        exact_quality_cover_at_count_integrated_partitioned_bounded(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            budget,
        )
    } else if candidate_dominance {
        exact_quality_cover_at_count_integrated_dominance_bounded(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            budget,
        )
    } else {
        exact_quality_cover_at_count_integrated_bounded(
            &cases,
            solution_count as usize,
            exact_count as usize,
            seed,
            budget,
        )
    };
    let Some(result) = result else {
        return MIN_COVER_ERROR;
    };
    let (completed, result) = match result {
        BoundedQualityResult::Exact(result) => (true, result),
        BoundedQualityResult::BudgetExceeded(result) => (false, result),
    };
    solver.min_cover_selected = result.selected;
    solver.min_cover_quality = result.quality;
    solver.min_cover_searched_states = result.searched_states;
    if completed {
        solver.min_cover_selected.len() as u32
    } else {
        MIN_COVER_BUDGET_EXCEEDED
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_integrated_bounded(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
) -> u32 {
    unsafe {
        solver_min_cover_at_count_integrated_bounded_impl(
            ptr,
            offsets_ptr,
            case_count,
            ids_ptr,
            quality_ptr,
            entry_count,
            solution_count,
            exact_count,
            seed_ptr,
            seed_count,
            state_budget,
            false,
            false,
        )
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_integrated_dominance_bounded(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
) -> u32 {
    unsafe {
        solver_min_cover_at_count_integrated_bounded_impl(
            ptr,
            offsets_ptr,
            case_count,
            ids_ptr,
            quality_ptr,
            entry_count,
            solution_count,
            exact_count,
            seed_ptr,
            seed_count,
            state_budget,
            true,
            false,
        )
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_at_count_integrated_partitioned_bounded(
    ptr: *mut WasmSolver,
    offsets_ptr: *const u32,
    case_count: u32,
    ids_ptr: *const u32,
    quality_ptr: *const u32,
    entry_count: u32,
    solution_count: u32,
    exact_count: u32,
    seed_ptr: *const u32,
    seed_count: u32,
    state_budget: u32,
) -> u32 {
    unsafe {
        solver_min_cover_at_count_integrated_bounded_impl(
            ptr,
            offsets_ptr,
            case_count,
            ids_ptr,
            quality_ptr,
            entry_count,
            solution_count,
            exact_count,
            seed_ptr,
            seed_count,
            state_budget,
            false,
            true,
        )
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_selected(ptr: *mut WasmSolver, index: u32) -> u32 {
    if ptr.is_null() {
        return u32::MAX;
    }
    unsafe { &*ptr }
        .min_cover_selected
        .get(index as usize)
        .copied()
        .unwrap_or(u32::MAX)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_quality_len(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.min_cover_quality.len() as u32
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_quality(ptr: *mut WasmSolver, index: u32) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { &*ptr }
        .min_cover_quality
        .get(index as usize)
        .copied()
        .unwrap_or(0)
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_min_cover_searched_states(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.min_cover_searched_states
    }
}
