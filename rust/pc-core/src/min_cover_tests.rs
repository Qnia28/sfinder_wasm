use super::*;

#[test]
fn bounded_threshold_prefix_matches_independent_oracle() {
    let mut state = 441u32;
    let mut next = || { state = state.wrapping_mul(1664525).wrapping_add(1013904223); state };
    let mut partial_prefixes = 0;
    for sample in 0..100 {
        let n = 3 + (next() % 5) as usize;
        let mut cases = Vec::new();
        for _ in 0..(3 + next() % 7) {
            let mut row = Vec::new();
            for id in 0..n as u32 {
                if next() % 3 != 0 { row.push((id, if sample % 5 == 0 { 1 } else { 1 + next() % 6 })); }
            }
            if row.is_empty() { row.push((next() % n as u32, 1)); }
            cases.push(row);
        }
        if sample % 3 == 0 { cases.push(cases[0].clone()); }
        if sample % 4 == 0 { let (id,q) = cases[0][0]; cases[0].push((id,q.saturating_sub(1).max(1))); }
        let (oracle, seed) = brute_partition_oracle(&cases, n);
        let normalized = normalize_quality_cases(&cases,n).unwrap();
        let mut levels: Vec<u32> = normalized.iter().flat_map(|r|r.iter().map(|&(_,q)|q)).collect();
        levels.sort_unstable(); levels.dedup(); if levels.len()>1 { levels.remove(0); }
        for budget in [Some(0),Some(1),Some(3),Some(10),Some(30),None] {
            let plain = exact_quality_cover_at_count_bounded(&cases,n,oracle.selected.len(),&seed,budget).unwrap();
            let (progress,prefix) = exact_quality_cover_at_count_progress_bounded(&cases,n,oracle.selected.len(),&seed,budget).unwrap();
            assert_eq!(plain,progress);
            assert!(prefix.len()<=levels.len());
            let incumbent = match &progress {
                BoundedQualityResult::Exact(r) => { assert_eq!(r.selected,oracle.selected); assert_eq!(prefix.len(),levels.len()); r },
                BoundedQualityResult::BudgetExceeded(r) => { if !prefix.is_empty() { partial_prefixes+=1; } r },
            };
            for (index,&target) in prefix.iter().enumerate() {
                let count = |q: &[u32]| q.iter().filter(|&&v| v>=levels[index]).count() as u32;
                assert_eq!(target,count(&oracle.quality));
                assert_eq!(target,count(&incumbent.quality));
            }
        }
    }
    assert!(partial_prefixes>0,"must exercise budget exits after a proved threshold");
}

pub(super) fn brute_partition_oracle(cases: &[Vec<(u32, u32)>], n: usize) -> (MinimumCoverResult, Vec<u32>) {
    let mut best: Option<MinimumCoverResult> = None;
    let mut seed = Vec::new();
    for mask in 0usize..(1usize << n) {
        let selected: Vec<u32> = (0..n)
            .filter(|&id| mask & (1 << id) != 0)
            .map(|id| id as u32)
            .collect();
        if cases
            .iter()
            .any(|row| !row.iter().any(|&(id, _)| mask & (1 << id) != 0))
        {
            continue;
        }
        let mut quality: Vec<u32> = cases
            .iter()
            .map(|row| {
                row.iter()
                    .filter(|&&(id, _)| mask & (1 << id) != 0)
                    .map(|&(_, q)| q)
                    .max()
                    .unwrap()
            })
            .collect();
        quality.sort_unstable();
        if best
            .as_ref()
            .is_none_or(|b| selected.len() <= b.selected.len())
        {
            seed = selected.clone();
        }
        if best.as_ref().is_none_or(|b| {
            selected.len() < b.selected.len()
                || (selected.len() == b.selected.len()
                    && (quality > b.quality || (quality == b.quality && selected < b.selected)))
        }) {
            best = Some(MinimumCoverResult {
                selected,
                quality,
                searched_states: 0,
            });
        }
    }
    (best.unwrap(), seed)
}

#[test]
fn partitioned_integrated_matches_independent_enumeration_and_valid_bounded_incumbents() {
    let mut state = 0x9357_ae21u32;
    let mut next = || {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        state
    };
    for sample in 0..160 {
        let n = 4 + next() as usize % 6;
        let mut rows = Vec::new();
        for _ in 0..(3 + next() % 10) {
            let mut row: Vec<_> = (0..n as u32)
                .filter_map(|id| {
                    (next() % 3 == 0).then(|| (id, [1, 1, 7, 23, u32::MAX][next() as usize % 5]))
                })
                .collect();
            if row.is_empty() {
                row.push((next() % n as u32, 1));
            }
            if sample % 3 == 0 {
                row.push(row[0]);
            }
            rows.push(row);
        }
        rows.push(rows[0].clone()); // Original row multiplicity affects quality.
        let (expected, seed) = brute_partition_oracle(&rows, n);
        let historical =
            exact_quality_cover_at_count_integrated(&rows, n, seed.len(), &seed).unwrap();
        assert_eq!(historical.selected, expected.selected);
        assert_eq!(historical.quality, expected.quality);
        for histogram_after in [1, u64::MAX] {
            for budget in [Some(0), Some(1), Some(2), Some(5), Some(32), None] {
                let result = exact_quality_cover_at_count_integrated_with_options(
                    &rows,
                    n,
                    seed.len(),
                    &seed,
                    budget,
                    histogram_after,
                    false,
                    true,
                )
                .unwrap();
                let (exact, value) = match result {
                    BoundedQualityResult::Exact(r) => (true, r),
                    BoundedQualityResult::BudgetExceeded(r) => (false, r),
                };
                assert_eq!(value.selected.len(), seed.len());
                assert!(value.selected.windows(2).all(|pair| pair[0] < pair[1]));
                let mut quality = Vec::new();
                for row in &rows {
                    quality.push(
                        row.iter()
                            .filter(|&&(id, _)| value.selected.contains(&id))
                            .map(|&(_, q)| q)
                            .max()
                            .expect("bounded incumbent must cover every original row"),
                    );
                }
                quality.sort_unstable();
                assert_eq!(value.quality, quality);
                assert!(value.quality >= quality_vector(&rows, &seed, n));
                if let Some(limit) = budget {
                    assert!(value.searched_states <= limit);
                }
                if exact {
                    assert_eq!(
                        value.selected, expected.selected,
                        "sample {sample}, budget {budget:?}"
                    );
                    assert_eq!(value.quality, expected.quality);
                } else {
                    assert!(budget.is_some());
                }
            }
        }
    }
}

#[test]
fn partition_excludes_only_earlier_siblings_and_reduces_duplicate_branches() {
    let triangle = vec![
        vec![(0, 1), (1, 1)],
        vec![(1, 1), (2, 1)],
        vec![(0, 1), (2, 1)],
    ];
    let historical = exact_quality_cover_at_count_integrated(&triangle, 3, 2, &[1, 2]).unwrap();
    let BoundedQualityResult::Exact(partitioned) =
        exact_quality_cover_at_count_integrated_partitioned_bounded(&triangle, 3, 2, &[1, 2], None)
            .unwrap()
    else {
        panic!("unbounded must finish")
    };
    assert_eq!(partitioned.selected, vec![0, 1]);
    assert_eq!(partitioned.quality, historical.quality);
    assert!(partitioned.searched_states < historical.searched_states);

    // The best branch selects high ID 3 before low ID 0. A global ascending-ID
    // constraint would drop this cover. Local sibling exclusions must keep it.
    let rows = vec![
        vec![(3, 10), (4, 1)],
        vec![(0, 10), (1, 1)],
        vec![(1, 1), (3, 10)],
        vec![(2, 1), (3, 10)],
    ];
    let BoundedQualityResult::Exact(result) =
        exact_quality_cover_at_count_integrated_partitioned_bounded(&rows, 5, 2, &[1, 3], None)
            .unwrap()
    else {
        panic!("unbounded must finish")
    };
    assert_eq!(result.selected, vec![0, 3]);
    assert_eq!(result.quality, vec![10; 4]);
}

#[test]
fn exact_cardinality_and_quality() {
    // A: X/Y, B: Z/W. X+Z has a bad second case; X+W is preferred.
    let cases = vec![vec![(0, 100), (1, 30)], vec![(2, 1), (3, 30)]];
    let result = exact_minimum_cover(&cases, 4).unwrap();
    assert_eq!(result.selected.len(), 2);
    assert_eq!(result.quality, vec![30, 100]);
    assert_eq!(result.selected, vec![0, 3]);
}

#[test]
fn fixed_count_quality_matches_legacy_exact_search() {
    let cases = vec![
        vec![(0, 9), (1, 5), (4, 7)],
        vec![(0, 2), (2, 8), (4, 4)],
        vec![(1, 7), (3, 8), (4, 6)],
        vec![(2, 5), (3, 9), (4, 3)],
    ];
    let legacy = exact_minimum_cover(&cases, 5).unwrap();
    let fixed =
        exact_quality_cover_at_count(&cases, 5, legacy.selected.len(), &legacy.selected).unwrap();
    assert_eq!(fixed.selected, legacy.selected);
    assert_eq!(fixed.quality, legacy.quality);
}

#[test]
fn primary_kernel_preserves_exact_cardinality_on_random_small_matrices() {
    let mut state = 0x3141_5926u32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    for sample in 0..120 {
        let solution_count = 2 + (next() as usize % 8);
        let case_count = 2 + (next() as usize % 9);
        let mut quality_cases = Vec::with_capacity(case_count);
        let mut primary_cases = Vec::with_capacity(case_count);
        for _ in 0..case_count {
            let mut row = Vec::new();
            for solution in 0..solution_count {
                if next() % 100 < 45 {
                    row.push((solution as u32, 1 + next() % 10));
                }
            }
            if row.is_empty() {
                row.push(((next() as usize % solution_count) as u32, 1 + next() % 10));
            }
            primary_cases.push(row.iter().map(|&(id, _)| id).collect());
            quality_cases.push(row);
        }
        let exact = exact_minimum_cardinality_cover(&quality_cases, solution_count)
            .unwrap_or_else(|| panic!("original cardinality failed on sample {sample}"));
        let kernel = exact_primary_cardinality_kernel(&primary_cases, solution_count)
            .unwrap_or_else(|| panic!("kernelization failed on sample {sample}"));
        let residual: Vec<Vec<(u32, u32)>> = kernel
            .cases
            .iter()
            .map(|row| row.iter().map(|&id| (id, 0)).collect())
            .collect();
        let residual_k = exact_minimum_cardinality_cover(&residual, kernel.solution_ids.len())
            .unwrap_or_else(|| panic!("residual cardinality failed on sample {sample}"))
            .selected
            .len();
        assert_eq!(
            kernel.forced.len() + residual_k,
            exact.selected.len(),
            "K mismatch on sample {sample}"
        );
    }
}

#[test]
fn cardinality_only_matches_exact_primary_on_random_small_matrices() {
    let mut state = 0x7a31_9d2bu32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    for _ in 0..100 {
        let solutions = 2 + (next() as usize % 7);
        let cases_len = 2 + (next() as usize % 8);
        let mut cases = Vec::with_capacity(cases_len);
        for _ in 0..cases_len {
            let mut row = Vec::new();
            for solution in 0..solutions {
                if next() % 100 < 45 {
                    row.push((solution as u32, 1 + next() % 10));
                }
            }
            if row.is_empty() {
                row.push(((next() as usize % solutions) as u32, 1 + next() % 10));
            }
            cases.push(row);
        }
        let exact = exact_minimum_cover(&cases, solutions).unwrap();
        let cardinality = exact_minimum_cardinality_cover(&cases, solutions).unwrap();
        assert_eq!(cardinality.selected.len(), exact.selected.len());
        assert!(cardinality.quality.is_empty());
    }
}

#[test]
fn redundant_case_does_not_change_cardinality() {
    let cases = vec![vec![(0, 1)], vec![(0, 1), (1, 10)], vec![(1, 10), (2, 10)]];
    let result = exact_minimum_cover(&cases, 3).unwrap();
    assert_eq!(result.selected.len(), 2);
    assert!(result.selected.contains(&0));
}

#[test]
fn locked_prefix_matches_full_fixed_count_search() {
    let cases = vec![
        vec![(0, 9), (1, 5), (4, 7)],
        vec![(0, 2), (2, 8), (4, 4)],
        vec![(1, 7), (3, 8), (4, 6)],
        vec![(2, 5), (3, 9), (4, 3)],
    ];
    let legacy = exact_minimum_cover(&cases, 5).unwrap();
    let full =
        exact_quality_cover_at_count(&cases, 5, legacy.selected.len(), &legacy.selected).unwrap();
    let mut levels: Vec<u32> = cases
        .iter()
        .flat_map(|row| row.iter().map(|&(_, q)| q))
        .collect();
    levels.sort_unstable();
    levels.dedup();
    levels.remove(0);
    let first = threshold_count_for_selected(&cases, &full.selected, levels[0], 5);
    let locked = exact_quality_cover_at_count_with_locked_prefix(
        &cases,
        5,
        full.selected.len(),
        &full.selected,
        &[first],
    )
    .unwrap();
    assert_eq!(locked.selected, full.selected);
    assert_eq!(locked.quality, full.quality);
}

#[test]
fn fixed_count_quality_matches_legacy_on_random_small_matrices() {
    let mut state = 0x91e1_0da5u32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    for sample in 0..120 {
        let solution_count = 4 + (next() as usize % 5);
        let case_count = 3 + (next() as usize % 7);
        let mut cases = Vec::with_capacity(case_count);
        for _ in 0..case_count {
            let mut row = Vec::new();
            for solution in 0..solution_count {
                if next() % 100 < 48 {
                    row.push((solution as u32, 1 + next() % 9));
                }
            }
            if row.is_empty() {
                row.push(((next() as usize % solution_count) as u32, 1 + next() % 9));
            }
            cases.push(row);
        }
        let Some(legacy) = exact_minimum_cover(&cases, solution_count) else {
            continue;
        };
        let fixed = exact_quality_cover_at_count(
            &cases,
            solution_count,
            legacy.selected.len(),
            &legacy.selected,
        )
        .unwrap_or_else(|| panic!("fixed solver failed on sample {sample}"));
        assert_eq!(
            fixed.selected, legacy.selected,
            "selected mismatch on sample {sample}"
        );
        assert_eq!(
            fixed.quality, legacy.quality,
            "quality mismatch on sample {sample}"
        );
    }
}
#[test]
fn bounded_fixed_count_exact_completes_or_returns_valid_incumbent() {
    let cases = vec![
        vec![(0, 9), (1, 5), (4, 7)],
        vec![(0, 2), (2, 8), (4, 4)],
        vec![(1, 7), (3, 8), (4, 6)],
        vec![(2, 5), (3, 9), (4, 3)],
    ];
    let legacy = exact_minimum_cover(&cases, 5).unwrap();
    let exact = exact_quality_cover_at_count_bounded(
        &cases,
        5,
        legacy.selected.len(),
        &legacy.selected,
        Some(1_000_000),
    )
    .unwrap();
    match exact {
        BoundedQualityResult::Exact(result) => {
            assert_eq!(result.selected, legacy.selected);
            assert_eq!(result.quality, legacy.quality);
        }
        BoundedQualityResult::BudgetExceeded(_) => {
            panic!("large budget unexpectedly exhausted")
        }
    }

    let bounded = exact_quality_cover_at_count_bounded(
        &cases,
        5,
        legacy.selected.len(),
        &legacy.selected,
        Some(1),
    )
    .unwrap();
    match bounded {
        BoundedQualityResult::BudgetExceeded(result) => {
            assert_eq!(result.selected.len(), legacy.selected.len());
            let mut covered = vec![false; cases.len()];
            for (ci, row) in cases.iter().enumerate() {
                covered[ci] = row.iter().any(|(id, _)| result.selected.contains(id));
            }
            assert!(covered.into_iter().all(|x| x));
        }
        BoundedQualityResult::Exact(_) => panic!("budget=1 unexpectedly completed"),
    }
}

#[test]
fn integrated_fixed_count_matches_legacy_on_random_small_matrices() {
    let mut state = 0x4f91_c2adu32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    for sample in 0..100 {
        let solution_count = 4 + (next() as usize % 5);
        let case_count = 3 + (next() as usize % 7);
        let mut cases = Vec::with_capacity(case_count);
        for _ in 0..case_count {
            let mut row = Vec::new();
            for solution in 0..solution_count {
                if next() % 100 < 48 {
                    row.push((solution as u32, 1 + next() % 9));
                }
            }
            if row.is_empty() {
                row.push(((next() as usize % solution_count) as u32, 1 + next() % 9));
            }
            cases.push(row);
        }
        let Some(legacy) = exact_minimum_cover(&cases, solution_count) else {
            continue;
        };
        let integrated = exact_quality_cover_at_count_integrated(
            &cases,
            solution_count,
            legacy.selected.len(),
            &legacy.selected,
        )
        .unwrap_or_else(|| panic!("integrated fixed-K failed on sample {sample}"));
        assert_eq!(
            integrated.selected, legacy.selected,
            "selected mismatch on sample {sample}"
        );
        assert_eq!(
            integrated.quality, legacy.quality,
            "quality mismatch on sample {sample}"
        );
    }
}

#[test]
fn integrated_fixed_count_budget_returns_valid_incumbent() {
    let cases = vec![
        vec![(0, 9), (1, 5), (4, 7)],
        vec![(0, 2), (2, 8), (4, 4)],
        vec![(1, 7), (3, 8), (4, 6)],
        vec![(2, 5), (3, 9), (4, 3)],
    ];
    let legacy = exact_minimum_cover(&cases, 5).unwrap();
    let bounded = exact_quality_cover_at_count_integrated_bounded(
        &cases,
        5,
        legacy.selected.len(),
        &legacy.selected,
        Some(1),
    )
    .unwrap();
    match bounded {
        BoundedQualityResult::BudgetExceeded(result) => {
            assert_eq!(result.selected.len(), legacy.selected.len());
            let chosen: HashSet<u32> = result.selected.iter().copied().collect();
            assert!(
                cases
                    .iter()
                    .all(|row| row.iter().any(|(id, _)| chosen.contains(id)))
            );
        }
        BoundedQualityResult::Exact(_) => panic!("budget=1 unexpectedly completed"),
    }
}

#[test]
fn integrated_dominance_exact_matches_historical_on_random_small_matrices() {
    let mut state = 0x9a31_74d2u32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    for sample in 0..160 {
        let solution_count = 4 + (next() as usize % 5);
        let case_count = 3 + (next() as usize % 7);
        let mut cases = Vec::with_capacity(case_count);
        for _ in 0..case_count {
            let mut row = Vec::new();
            for solution in 0..solution_count {
                if next() % 100 < 52 {
                    // Include zero and duplicate quality values so membership
                    // remains independent from quality during dominance.
                    row.push((solution as u32, next() % 8));
                }
            }
            if row.is_empty() {
                row.push(((next() as usize % solution_count) as u32, next() % 8));
            }
            cases.push(row);
        }
        let Some(legacy) = exact_minimum_cover(&cases, solution_count) else {
            continue;
        };
        let historical = exact_quality_cover_at_count_integrated_bounded(
            &cases,
            solution_count,
            legacy.selected.len(),
            &legacy.selected,
            None,
        )
        .unwrap_or_else(|| panic!("historical integrated failed on sample {sample}"));
        let dominance = exact_quality_cover_at_count_integrated_dominance_bounded(
            &cases,
            solution_count,
            legacy.selected.len(),
            &legacy.selected,
            None,
        )
        .unwrap_or_else(|| panic!("dominance integrated failed on sample {sample}"));
        let BoundedQualityResult::Exact(historical) = historical else {
            unreachable!();
        };
        let BoundedQualityResult::Exact(dominance) = dominance else {
            unreachable!();
        };
        assert_eq!(
            dominance.selected, historical.selected,
            "selected sample {sample}"
        );
        assert_eq!(
            dominance.quality, historical.quality,
            "quality sample {sample}"
        );
    }
}

#[test]
fn integrated_dominance_timeout_incumbent_is_not_a_parity_contract() {
    // Candidate dominance is exact when the search finishes, but it changes
    // choose_case/branch traversal.  At a tiny common budget the incumbent
    // may differ, which is why production discards a timed-out preview.
    let cases = vec![
        vec![(0, 33), (1, 7), (4, 17)],
        vec![(0, 5), (2, 33), (4, 9)],
        vec![(1, 20), (2, 12), (3, 33)],
        vec![(0, 11), (3, 18), (4, 17)],
    ];
    let exact = exact_minimum_cover(&cases, 5).unwrap();
    let historical = exact_quality_cover_at_count_integrated_bounded(
        &cases,
        5,
        exact.selected.len(),
        &exact.selected,
        Some(4),
    )
    .unwrap();
    let dominance = exact_quality_cover_at_count_integrated_dominance_bounded(
        &cases,
        5,
        exact.selected.len(),
        &exact.selected,
        Some(4),
    )
    .unwrap();
    assert!(matches!(
        historical,
        BoundedQualityResult::BudgetExceeded(_)
    ));
    assert!(matches!(dominance, BoundedQualityResult::BudgetExceeded(_)));
    // No equality assertion by design: only completed dominance previews
    // are a valid replacement for the historical Fast path.
}

/// Regression for #5: a single distinct quality level must still resolve the
/// final stable candidate-ID objective instead of returning the seed.
#[test]
fn fixed_count_zero_quality_resolves_stable_id_tie() {
    // One case, two interchangeable candidates, all-zero quality.
    let cases = vec![vec![(0, 0), (1, 0)]];
    let result = exact_quality_cover_at_count(&cases, 2, 1, &[1]).unwrap();
    assert_eq!(result.selected, vec![0]);
    assert_eq!(result.quality, vec![0]);
}

/// Regression for #5: positive constant quality reaches the same early
/// return as all-zero quality, so it must be corrected as well.
#[test]
fn fixed_count_positive_constant_quality_resolves_stable_id_tie() {
    let cases = vec![vec![(0, 1), (1, 1)]];
    let result = exact_quality_cover_at_count(&cases, 2, 1, &[1]).unwrap();
    assert_eq!(result.selected, vec![0]);
    assert_eq!(result.quality, vec![1]);
}

/// Regression for #5 where the stable-ID objective is not reachable by any
/// greedy lowest-ID rule: the two minimum 2-covers are [0, 3] and [1, 2],
/// no candidate primary-dominates another, and [0, 1] is not a cover.
#[test]
fn fixed_count_constant_quality_picks_lex_smallest_of_several_k_covers() {
    let cases = vec![
        vec![(0, 5), (1, 5)],
        vec![(0, 5), (2, 5)],
        vec![(1, 5), (3, 5)],
        vec![(2, 5), (3, 5)],
    ];
    // The noncanonical seed is the other minimum 2-cover.
    let result = exact_quality_cover_at_count(&cases, 4, 2, &[1, 2]).unwrap();
    assert_eq!(result.selected, vec![0, 3]);
    assert_eq!(result.quality, vec![5, 5, 5, 5]);

    // Independent of the seed, and equal to the integrated search, which
    // already resolved this tie before the correction.
    let from_canonical_seed = exact_quality_cover_at_count(&cases, 4, 2, &[0, 3]).unwrap();
    assert_eq!(from_canonical_seed.selected, result.selected);
    assert_eq!(from_canonical_seed.quality, result.quality);
    let integrated = exact_quality_cover_at_count_integrated(&cases, 4, 2, &[1, 2]).unwrap();
    assert_eq!(integrated.selected, result.selected);
    assert_eq!(integrated.quality, result.quality);
}

/// Single-level fixed-K must equal a brute-force lexicographically smallest
/// K-cover on random small matrices, for zero and positive constant quality.
#[test]
fn single_level_fixed_count_matches_brute_force_lex_minimum() {
    let mut state = 0x5f37_59dfu32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    let mut checked = 0;
    for sample in 0..200 {
        let solution_count = 3 + (next() % 4) as usize;
        let case_count = 2 + (next() % 4) as usize;
        let quality = if sample % 2 == 0 { 0 } else { 7 };
        let mut cases: Vec<Vec<(u32, u32)>> = Vec::with_capacity(case_count);
        let mut usable = true;
        for _ in 0..case_count {
            let mut ids: Vec<u32> = (0..solution_count as u32)
                .filter(|_| next() % 2 == 0)
                .collect();
            ids.sort_unstable();
            ids.dedup();
            if ids.is_empty() {
                usable = false;
                break;
            }
            cases.push(ids.into_iter().map(|id| (id, quality)).collect());
        }
        if !usable {
            continue;
        }
        let Some(primary) = exact_minimum_cardinality_cover(&cases, solution_count) else {
            continue;
        };
        let exact_count = primary.selected.len();
        if exact_count == 0 || exact_count > 3 {
            continue;
        }

        // Brute force every exactly-K cover; keep the lex-smallest as the
        // expected answer and the lex-largest as a deliberately
        // noncanonical seed.
        let mut covers: Vec<Vec<u32>> = Vec::new();
        let mut combo = vec![0usize; exact_count];
        fn enumerate(
            start: usize,
            depth: usize,
            combo: &mut Vec<usize>,
            solution_count: usize,
            cases: &[Vec<(u32, u32)>],
            covers: &mut Vec<Vec<u32>>,
        ) {
            if depth == combo.len() {
                let selected: Vec<u32> = combo.iter().map(|&id| id as u32).collect();
                if cases
                    .iter()
                    .all(|case| case.iter().any(|&(id, _)| selected.contains(&id)))
                {
                    covers.push(selected);
                }
                return;
            }
            for id in start..solution_count {
                combo[depth] = id;
                enumerate(id + 1, depth + 1, combo, solution_count, cases, covers);
            }
        }
        enumerate(0, 0, &mut combo, solution_count, &cases, &mut covers);
        covers.sort_unstable();
        let expected = covers.first().expect("a K-cover exists").clone();
        let worst_seed = covers.last().expect("a K-cover exists").clone();

        for seed in [&primary.selected, &worst_seed] {
            let actual =
                exact_quality_cover_at_count(&cases, solution_count, exact_count, seed).unwrap();
            assert_eq!(actual.selected, expected, "sample {sample}");
            assert_eq!(
                actual.quality,
                vec![quality; cases.len()],
                "sample {sample}"
            );
        }
        if covers.len() > 1 {
            checked += 1;
        }
    }
    assert!(
        checked > 20,
        "expected many multi-cover samples, got {checked}"
    );
}

/// Keeping the single level (#5) also makes a one-entry locked prefix
/// reachable, where it was previously ignored along with the whole search.
/// The only achievable target is "every case good", and the fully locked
/// branch must still return the lexicographically smallest K-cover.
#[test]
fn single_level_fully_locked_prefix_resolves_stable_id_tie() {
    let cases = vec![
        vec![(0, 3), (1, 3)],
        vec![(0, 3), (2, 3)],
        vec![(1, 3), (3, 3)],
        vec![(2, 3), (3, 3)],
    ];
    let all_good = cases.len() as u32;
    let result =
        exact_quality_cover_at_count_with_locked_prefix(&cases, 4, 2, &[1, 2], &[all_good])
            .unwrap();
    assert_eq!(result.selected, vec![0, 3]);
    assert_eq!(result.quality, vec![3, 3, 3, 3]);

    // An unreachable locked target is still rejected rather than silently
    // returning the seed.
    assert!(
        exact_quality_cover_at_count_with_locked_prefix(&cases, 4, 2, &[1, 2], &[all_good - 1])
            .is_none()
    );
}

#[test]
fn fully_locked_prefix_still_resolves_stable_id_tie() {
    // Candidate 1 strictly primary-dominates candidate 0, but when the
    // quality vector is already locked, [0,2] is the stable-ID winner.
    let cases = vec![
        vec![(0, 1), (1, 1)],
        vec![(1, 1), (2, 1)],
        vec![(2, 2), (3, 2)],
    ];
    let result =
        exact_quality_cover_at_count_with_locked_prefix(&cases, 4, 2, &[1, 2], &[1]).unwrap();
    assert_eq!(result.selected, vec![0, 2]);
    assert_eq!(result.quality, vec![1, 1, 2]);
}

#[test]
fn histogram_rank_compression_handles_sparse_u32_qualities() {
    let cases = vec![
        vec![(0, 0), (1, u32::MAX)],
        vec![(0, 1_000_000), (1, u32::MAX - 1)],
    ];
    let mut state = QualityHistogramState::build(&cases, 2, &[0]);
    assert_eq!(
        state.quality_values,
        vec![0, 1_000_000, u32::MAX - 1, u32::MAX]
    );
    assert_eq!(state.quality_vector(), vec![0, 1_000_000]);
    let before = state.histogram.clone();
    state.push(1);
    assert_eq!(state.quality_vector(), vec![u32::MAX - 1, u32::MAX]);
    state.pop(1);
    assert_eq!(state.histogram, before);
}

#[test]
fn histogram_prefix_max_stack_restores_hidden_values_and_duplicate_rows() {
    let cases = vec![
        vec![(0, 2), (1, 9), (2, 4), (3, 9)],
        vec![(0, 2), (1, 9), (2, 4), (3, 9)],
        vec![(0, 0), (2, u32::MAX)],
    ];
    let mut selected = vec![0];
    let mut state = QualityHistogramState::build(&cases, 4, &selected);
    for id in [1, 2, 3] {
        selected.push(id);
        state.push(id);
        assert_eq!(state.quality_vector(), quality_vector(&cases, &selected, 4));
    }
    for id in [3, 2, 1] {
        state.pop(id);
        selected.pop();
        assert_eq!(state.quality_vector(), quality_vector(&cases, &selected, 4));
    }
}

#[test]
fn adaptive_histogram_matches_naive_fixed_k_on_random_matrices_and_budgets() {
    let mut state = 0x8d12_3a77u32;
    let mut next = || {
        state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        state
    };
    let quality_pool = [0u32, 1, 3, 5, 5, 17, 1_000_000, u32::MAX];
    let mut checked = 0;
    for sample in 0..180 {
        let solution_count = 3 + (next() % 4) as usize;
        let case_count = 2 + (next() % 5) as usize;
        let mut cases = Vec::with_capacity(case_count);
        let mut usable = true;
        for _ in 0..case_count {
            let mut ids: Vec<u32> = (0..solution_count as u32)
                .filter(|_| next() % 3 != 0)
                .collect();
            ids.sort_unstable();
            ids.dedup();
            if ids.is_empty() {
                usable = false;
                break;
            }
            cases.push(
                ids.into_iter()
                    .map(|id| (id, quality_pool[next() as usize % quality_pool.len()]))
                    .collect::<Vec<_>>(),
            );
        }
        if !usable {
            continue;
        }
        let Some(primary) = exact_minimum_cardinality_cover(&cases, solution_count) else {
            continue;
        };
        let exact_count = primary.selected.len();
        if exact_count == 0 {
            continue;
        }
        for budget in [Some(32), Some(64), Some(127), None] {
            let histogram = exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
                &cases,
                solution_count,
                exact_count,
                &primary.selected,
                budget,
                1,
                false,
            )
            .unwrap();
            let naive = exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
                &cases,
                solution_count,
                exact_count,
                &primary.selected,
                budget,
                u64::MAX,
                false,
            )
            .unwrap();
            assert_eq!(histogram, naive, "sample={sample} budget={budget:?}");
        }
        checked += 1;
    }
    assert!(
        checked > 100,
        "expected broad randomized coverage, got {checked}"
    );
}

#[test]
fn production_histogram_threshold_activates_after_many_complete_covers() {
    // Every minimum cover chooses one solution from each side, yielding
    // exactly 8 * 8 = 64 distinct K=2 covers. This exercises the production
    // switch threshold rather than a test-only forced activation.
    let mut left = Vec::new();
    let mut right = Vec::new();
    for id in 0..8u32 {
        left.push((id, id + 1));
    }
    for id in 8..16u32 {
        right.push((id, id - 7));
    }
    let cases = vec![left, right];
    let seed = vec![0, 8];
    let adaptive = exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
        &cases,
        16,
        2,
        &seed,
        None,
        QUALITY_HISTOGRAM_SWITCH_COMPLETE_COVERS,
        false,
    )
    .unwrap();
    let naive = exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
        &cases,
        16,
        2,
        &seed,
        None,
        u64::MAX,
        false,
    )
    .unwrap();
    assert_eq!(adaptive, naive);
    match adaptive {
        BoundedQualityResult::Exact(result) => {
            assert_eq!(result.selected, vec![7, 15]);
            assert_eq!(result.quality, vec![8, 8]);
        }
        BoundedQualityResult::BudgetExceeded(_) => unreachable!(),
    }
}

#[test]
fn adaptive_histogram_matches_naive_full_exact_search_on_random_matrices() {
    let mut state = 0x4142_1356u32;
    let mut next = || {
        state = state.wrapping_mul(1_103_515_245).wrapping_add(12_345);
        state
    };
    let quality_pool = [0u32, 1, 2, 7, 7, 99, 1_000_000, u32::MAX];
    let mut checked = 0;
    for sample in 0..140 {
        let solution_count = 3 + (next() % 4) as usize;
        let case_count = 1 + (next() % 5) as usize;
        let mut cases = Vec::with_capacity(case_count);
        let mut usable = true;
        for _ in 0..case_count {
            let mut ids: Vec<u32> = (0..solution_count as u32)
                .filter(|_| next() % 3 != 0)
                .collect();
            ids.sort_unstable();
            ids.dedup();
            if ids.is_empty() {
                usable = false;
                break;
            }
            cases.push(
                ids.into_iter()
                    .map(|id| (id, quality_pool[next() as usize % quality_pool.len()]))
                    .collect::<Vec<_>>(),
            );
        }
        if !usable {
            continue;
        }
        let adaptive = exact_minimum_cover_with_histogram_switch(&cases, solution_count, 1);
        let naive = exact_minimum_cover_with_histogram_switch(&cases, solution_count, u64::MAX);
        assert_eq!(adaptive, naive, "sample={sample}");
        checked += 1;
    }
    assert!(
        checked > 80,
        "expected broad randomized coverage, got {checked}"
    );
}
