use pc_core::{PcSolver, Solution};

pub struct WasmSolver {
    pub(crate) core: PcSolver,
    pub(crate) solutions: Vec<Solution>,
    pub(crate) solution_saves: Vec<u8>,
    pub(crate) pattern_offsets: Vec<u32>,
    pub(crate) pattern_case_ids: Vec<u32>,
    pub(crate) pattern_order_counts: Vec<u32>,
    pub(crate) path_coverage_counts: Vec<u32>,
    pub(crate) save_outcome_words: Vec<u32>,
    pub(crate) min_cover_selected: Vec<u32>,
    pub(crate) min_cover_quality: Vec<u32>,
    pub(crate) min_cover_proven_prefix: Vec<u32>,
    pub(crate) min_cover_searched_states: u64,
    #[cfg(feature = "threshold-experiment")]
    pub(crate) threshold_diagnostics: [u64; pc_core::min_cover::THRESHOLD_TRACE_COUNTERS],
    pub(crate) primary_kernel_offsets: Vec<u32>,
    pub(crate) primary_kernel_ids: Vec<u32>,
    pub(crate) primary_kernel_solution_ids: Vec<u32>,
    pub(crate) primary_kernel_forced: Vec<u32>,
}

impl WasmSolver {
    pub(crate) fn new(height: u8) -> Self {
        Self {
            core: PcSolver::new(height),
            solutions: Vec::new(),
            solution_saves: Vec::new(),
            pattern_offsets: Vec::new(),
            pattern_case_ids: Vec::new(),
            pattern_order_counts: Vec::new(),
            path_coverage_counts: Vec::new(),
            save_outcome_words: Vec::new(),
            min_cover_selected: Vec::new(),
            min_cover_quality: Vec::new(),
            min_cover_proven_prefix: Vec::new(),
            min_cover_searched_states: 0,
            #[cfg(feature = "threshold-experiment")]
            threshold_diagnostics: [0; pc_core::min_cover::THRESHOLD_TRACE_COUNTERS],
            primary_kernel_offsets: Vec::new(),
            primary_kernel_ids: Vec::new(),
            primary_kernel_solution_ids: Vec::new(),
            primary_kernel_forced: Vec::new(),
        }
    }
}
