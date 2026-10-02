use super::*;

fn fixture() -> Vec<Vec<(u32, u32)>> {
    vec![vec![(0, 9), (1, 3), (2, 2)], vec![(0, 8), (1, 2), (2, 1)]]
}

#[test]
fn guard_memory_and_work_bypass_restore_full_search() {
    let rows = fixture();
    let baseline = exact_quality_cover_at_count_integrated_partitioned_bounded(&rows, 3, 1, &[2], Some(100000)).unwrap();
    for (memory_cap, work_cap, status) in [(23, 50000000, 2), (24, 0, 3), (24, 1, 3)] {
        let mut audit = BenchDominanceAudit { memory_cap, work_cap, ..Default::default() };
        let got = bench_integrated_bounded(&rows, 3, 1, &[2], Some(100000), true, false, &mut audit).unwrap();
        assert_eq!(format!("{got:?}"), format!("{baseline:?}"));
        assert_eq!(audit.status, status);
        assert_eq!(audit.dominated, 0);
        assert!(audit.pair_visits + audit.word_comparisons + audit.quality_comparisons <= work_cap);
        if status == 2 { assert_eq!(audit.allocated_bytes, 0); }
    }
}

#[test]
fn guard_exact_limit_and_partial_mask_are_sound() {
    let rows = fixture();
    let coverage = vec![vec![1], vec![1], vec![1]];
    let mut full = BenchDominanceAudit::default();
    let mask = guarded_dominance_mask(&rows, 3, &coverage, &mut full).unwrap();
    assert_eq!(mask, vec![false, true, true]);
    let exact_work = full.pair_visits + full.word_comparisons + full.quality_comparisons;
    for (cap, succeeds) in [(exact_work, true), (exact_work - 1, false)] {
        let mut audit = BenchDominanceAudit { memory_cap: 24, work_cap: cap, ..Default::default() };
        assert_eq!(guarded_dominance_mask(&rows, 3, &coverage, &mut audit).is_some(), succeeds);
        assert_eq!(audit.status, if succeeds { 1 } else { 3 });
    }
    let mut audit = BenchDominanceAudit::default();
    let result = bench_integrated_bounded(&rows, 3, 1, &[2], None, true, true, &mut audit).unwrap();
    match result { BoundedQualityResult::Exact(r) => { assert_eq!(r.selected, vec![0]); assert_eq!(r.quality, vec![8, 9]); }, _ => panic!("not exact") }
}

#[test]
fn minimum_k_dominated_seed_is_preserved_when_capped() {
    let rows = fixture();
    let mut audit = BenchDominanceAudit::default();
    match bench_integrated_bounded(&rows, 3, 1, &[2], Some(1), true, false, &mut audit).unwrap() {
        BoundedQualityResult::BudgetExceeded(r) => { assert_eq!(r.selected, vec![2]); assert_eq!(r.quality, vec![1, 2]); },
        _ => panic!("expected cap"),
    }
}
