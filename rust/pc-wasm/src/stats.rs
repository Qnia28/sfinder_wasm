use crate::state::WasmSolver;

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
