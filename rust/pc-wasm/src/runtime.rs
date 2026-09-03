use crate::state::WasmSolver;

#[unsafe(no_mangle)]
pub extern "C" fn solver_new(height: u32) -> *mut WasmSolver {
    if !(2..=6).contains(&height) {
        return core::ptr::null_mut();
    }
    Box::into_raw(Box::new(WasmSolver::new(height as u8)))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_free(ptr: *mut WasmSolver) {
    if !ptr.is_null() {
        drop(unsafe { Box::from_raw(ptr) })
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_alloc(len: usize) -> *mut u8 {
    let mut b = vec![0u8; len].into_boxed_slice();
    let p = b.as_mut_ptr();
    core::mem::forget(b);
    p
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn wasm_dealloc(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        let s = core::ptr::slice_from_raw_parts_mut(ptr, len);
        drop(unsafe { Box::from_raw(s) })
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_alloc_u32(len: usize) -> *mut u32 {
    let mut b = vec![0u32; len].into_boxed_slice();
    let p = b.as_mut_ptr();
    core::mem::forget(b);
    p
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn wasm_dealloc_u32(ptr: *mut u32, len: usize) {
    if !ptr.is_null() {
        let s = core::ptr::slice_from_raw_parts_mut(ptr, len);
        drop(unsafe { Box::from_raw(s) })
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_alloc_u64(len: usize) -> *mut u64 {
    let mut b = vec![0u64; len].into_boxed_slice();
    let p = b.as_mut_ptr();
    core::mem::forget(b);
    p
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn wasm_dealloc_u64(ptr: *mut u64, len: usize) {
    if !ptr.is_null() {
        let s = core::ptr::slice_from_raw_parts_mut(ptr, len);
        drop(unsafe { Box::from_raw(s) })
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn solver_load_legal_pack(
    ptr: *mut WasmSolver,
    data: *const u8,
    len: usize,
) -> u32 {
    if ptr.is_null() || data.is_null() {
        return 0;
    }
    let bytes = unsafe { core::slice::from_raw_parts(data, len) };
    unsafe { &mut *ptr }.core.load_legal_pack(bytes) as u32
}
