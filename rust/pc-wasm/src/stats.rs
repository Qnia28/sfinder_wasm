use crate::state::WasmSolver;

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_set_cache_budget(ptr: *mut WasmSolver, bytes: u32) {
    if !ptr.is_null() {
        unsafe { &mut *ptr }
            .core
            .set_placement_cache_budget(bytes as usize);
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_cache_estimated_bytes(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }
            .core
            .placement_cache_estimated_bytes()
            .min(u32::MAX as usize) as u32
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_cache_evictions(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.placement_cache_evictions
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_nodes(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.nodes
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_cache_hits(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.placement_cache_hits
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_cache_misses(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.placement_cache_misses
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_legal_rejects(ptr: *mut WasmSolver) -> u64 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.legal_rejects
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_legal_count(ptr: *mut WasmSolver, stage: u32) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.legal_count(stage as usize) as u32
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_legal_pack_version(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.legal_pack_version() as u32
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_legal_memory_bytes(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }
            .core
            .legal_memory_bytes()
            .min(u32::MAX as usize) as u32
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_stage8_oracle_entries(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }
            .core
            .stage8_oracle_entries()
            .min(u32::MAX as usize) as u32
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_stage9_oracle_entries(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }
            .core
            .stage9_oracle_entries()
            .min(u32::MAX as usize) as u32
    }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_cache_entries(ptr: *mut WasmSolver) -> u32 {
    if ptr.is_null() {
        0
    } else {
        unsafe { &*ptr }.core.placement_cache_entries() as u32
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_set_probability_engine(
    ptr: *mut WasmSolver,
    engine: u32,
    node_budget: u32,
) -> u32 {
    if ptr.is_null() || engine > 2 || node_budget > 200_000 {
        return 0;
    }
    let core = &mut unsafe { &mut *ptr }.core;
    core.probability_engine = engine as u8;
    core.probability_node_budget = node_budget as usize;
    1
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_probability_stat(ptr: *mut WasmSolver, kind: u32) -> u64 {
    if ptr.is_null() {
        return 0;
    }
    let core = &unsafe { &*ptr }.core;
    match kind {
        0 => core.probability_paths,
        1 => core.probability_language_nodes as u64,
        2 => core.probability_fallback as u64,
        _ => 0,
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_reconstruction_stat(ptr: *mut WasmSolver, skipped: u32) -> u64 {
    if ptr.is_null() {
        return 0;
    }
    let core = &unsafe { &*ptr }.core;
    if skipped == 0 {
        core.reconstruction_visits
    } else {
        core.reconstruction_skipped
    }
}
