#[cfg(feature = "diagnostics")]
thread_local! { static COUNTERS:std::cell::RefCell<[u64;20]>=const {std::cell::RefCell::new([0;20])}; }
#[inline]
pub(crate) fn add(kind: usize, value: u64) {
    #[cfg(feature = "diagnostics")]
    COUNTERS.with(|cell| {
        let mut counters = cell.borrow_mut();
        counters[kind] = counters[kind].saturating_add(value);
    });
    #[cfg(not(feature = "diagnostics"))]
    let _ = (kind, value);
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_diagnostics_enabled() -> u32 {
    cfg!(feature = "diagnostics") as u32
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_diagnostics_reset() {
    #[cfg(feature = "diagnostics")]
    COUNTERS.with(|cell| *cell.borrow_mut() = [0; 20]);
}
#[unsafe(no_mangle)]
pub extern "C" fn batch_diagnostics_get(kind: u32) -> u64 {
    #[cfg(feature = "diagnostics")]
    return COUNTERS.with(|cell| cell.borrow().get(kind as usize).copied().unwrap_or(0));
    #[cfg(not(feature = "diagnostics"))]
    {
        let _ = kind;
        0
    }
}
