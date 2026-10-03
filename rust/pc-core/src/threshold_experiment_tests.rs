use super::*;

fn fixture(state: &mut u32, sample: usize) -> (Vec<Vec<(u32, u32)>>, usize) {
    fn next(s: &mut u32) -> u32 {
        *s = s.wrapping_mul(1664525).wrapping_add(1013904223);
        *s
    }
    let n = 3 + (next(state) % 7) as usize;
    let mut rows = Vec::new();
    for _ in 0..(2 + next(state) % 11) {
        let mut row = Vec::new();
        for id in 0..n as u32 {
            if next(state) % 3 != 0 {
                let q = if sample.is_multiple_of(7) {
                    5
                } else {
                    [0, 1, 3, 9, u32::MAX][next(state) as usize % 5]
                };
                row.push((id, q));
            }
        }
        if row.is_empty() {
            row.push((next(state) % n as u32, 1));
        }
        if sample.is_multiple_of(3) {
            row.push(row[0]);
        }
        rows.push(row);
    }
    rows.push(rows[0].clone());
    (rows, n)
}

fn check(cases: &[Vec<(u32, u32)>], n: usize, masks: &[u32], bounded: bool) {
    let (oracle, seed) = tests::brute_partition_oracle(cases, n);
    let levels = {
        let normalized = normalize_quality_cases(cases, n).unwrap();
        let mut levels: Vec<_> = normalized.iter().flatten().map(|x| x.1).collect();
        levels.sort_unstable();
        levels.dedup();
        if levels.len() > 1 {
            levels.remove(0);
        }
        levels
    };
    let budgets = if bounded {
        vec![
            Some(0),
            Some(1),
            Some(2),
            Some(5),
            Some(20),
            Some(100),
            None,
        ]
    } else {
        vec![None]
    };
    for &mask in masks {
        for &budget in &budgets {
            let (actual, prefix, _) = exact_quality_cover_at_count_experiment(
                cases,
                n,
                oracle.selected.len(),
                &seed,
                &[],
                budget,
                mask,
            )
            .unwrap();
            let (complete, r) = match actual {
                BoundedQualityResult::Exact(r) => (true, r),
                BoundedQualityResult::BudgetExceeded(r) => (false, r),
            };
            assert_eq!(r.selected.len(), oracle.selected.len());
            assert!(r.selected.windows(2).all(|x| x[0] < x[1]));
            assert!(
                cases
                    .iter()
                    .all(|row| row.iter().any(|x| r.selected.contains(&x.0)))
            );
            assert_eq!(r.quality, quality_vector(cases, &r.selected, n));
            if let Some(limit) = budget {
                assert!(r.searched_states <= limit);
            }
            if complete {
                assert_eq!(
                    r.selected, oracle.selected,
                    "mask={mask}, budget={budget:?}"
                );
                assert_eq!(r.quality, oracle.quality);
                assert_eq!(prefix.len(), levels.len());
            }
            for (i, &target) in prefix.iter().enumerate() {
                assert_eq!(
                    target,
                    oracle.quality.iter().filter(|&&q| q >= levels[i]).count() as u32
                );
                assert_eq!(
                    target,
                    r.quality.iter().filter(|&&q| q >= levels[i]).count() as u32
                );
            }
            if mask & !3 == 0 {
                let (plain, plain_prefix) = exact_quality_cover_at_count_progress_bounded(
                    cases,
                    n,
                    oracle.selected.len(),
                    &seed,
                    budget,
                )
                .unwrap();
                assert_eq!(plain_prefix, prefix);
                let original = if complete {
                    BoundedQualityResult::Exact(r)
                } else {
                    BoundedQualityResult::BudgetExceeded(r)
                };
                assert_eq!(plain, original, "all-off/A/B traversal parity");
            }
        }
        // Imported proofs are generated from the independent optimum, not from
        // arbitrary seed scores. All-locks must still search the stable tie.
        let targets: Vec<u32> = levels
            .iter()
            .map(|&t| oracle.quality.iter().filter(|&&q| q >= t).count() as u32)
            .collect();
        for length in [1, targets.len()] {
            let (outcome, prefix, _) = exact_quality_cover_at_count_experiment(
                cases,
                n,
                oracle.selected.len(),
                &oracle.selected,
                &targets[..length],
                None,
                mask,
            )
            .unwrap();
            let BoundedQualityResult::Exact(r) = outcome else {
                panic!("unlimited")
            };
            assert_eq!(r.selected, oracle.selected);
            assert_eq!(r.quality, oracle.quality);
            assert_eq!(prefix, targets);
        }
    }
}

#[test]
fn all_32_masks_match_oracle_512() {
    let mut state = 0x731ae852;
    for sample in 0..512 {
        let (rows, n) = fixture(&mut state, sample);
        check(&rows, n, &(0..32).collect::<Vec<_>>(), false);
    }
}

#[test]
fn independent_seed_2000_single_elements() {
    let mut state = 0x125492ab;
    for sample in 0..2000 {
        let (rows, n) = fixture(&mut state, sample);
        check(&rows, n, &[0, 1, 2, 4, 8, 16, 31], false);
    }
}

#[test]
fn all_masks_bounded_160_and_undo() {
    let mut state = 0x82461397;
    for sample in 0..160 {
        let (rows, n) = fixture(&mut state, sample);
        check(&rows, n, &(0..32).collect::<Vec<_>>(), true);
    }
}

#[test]
fn weighted_slack_forced_quality_and_constant_tie() {
    let fixtures = [
        // Candidate 0 is forced for coverage, but rows it covers still have
        // live quality improvements supplied by candidates 1 and 2.
        vec![
            vec![(0, 1), (0, 3)],
            vec![(0, 1), (1, 9)],
            vec![(1, 1), (2, 9)],
            vec![(0, 1), (2, 9)],
        ],
        vec![
            vec![(0, 5), (1, 5)],
            vec![(0, 5), (2, 5)],
            vec![(1, 5), (3, 5)],
            vec![(2, 5), (3, 5)],
        ],
        vec![
            vec![(0, 1), (1, 9)],
            vec![(0, 1), (1, 9)],
            vec![(0, 1), (2, 9)],
            vec![(1, 1), (2, 9)],
        ],
    ];
    for rows in fixtures {
        let n = 1 + rows.iter().flatten().map(|x| x.0).max().unwrap() as usize;
        check(&rows, n, &(0..32).collect::<Vec<_>>(), true);
    }
}

#[test]
fn invalid_masks_are_rejected() {
    assert!(
        exact_quality_cover_at_count_experiment(&[vec![(0, 1)]], 1, 1, &[0], &[], None, 32)
            .is_none()
    );
}

#[test]
fn root_refinements_oracle_budget_locks_and_undo() {
    let mut state = 0x96512abd;
    for sample in 0..256 {
        let (rows, n) = fixture(&mut state, sample);
        check(&rows, n, &[4, 20, 36, 52, 68, 84, 100, 116, 127], true);
    }
    // No forced candidates, all forced, repeated singleton IDs, primary-covered
    // rows with a live quality improvement, and nonzero stable IDs.
    for rows in [
        vec![vec![(0, 1), (1, 9)], vec![(0, 9), (1, 1)]],
        vec![vec![(0, 1)], vec![(1, 9)], vec![(1, 1), (2, 9)]],
        vec![vec![(2, 1), (2, 9)], vec![(2, 3)], vec![(0, 9), (2, 1)]],
    ] {
        let n = 1 + rows.iter().flatten().map(|x| x.0).max().unwrap() as usize;
        check(&rows, n, &[4, 20, 36, 52, 68, 84, 100, 116], true);
    }
}

#[test]
fn root_refinements_preserve_exact_traversal_and_work_counters() {
    let mut state = 0xa3645b21;
    for sample in 0..128 {
        let (rows, n) = fixture(&mut state, sample);
        let (oracle, seed) = tests::brute_partition_oracle(&rows, n);
        for base in [4, 20] {
            for budget in [Some(0), Some(1), Some(5), Some(100), None] {
                let reference = exact_quality_cover_at_count_experiment(
                    &rows,
                    n,
                    oracle.selected.len(),
                    &seed,
                    &[],
                    budget,
                    base,
                )
                .unwrap();
                for added in [32, 64, 96] {
                    let refined = exact_quality_cover_at_count_experiment(
                        &rows,
                        n,
                        oracle.selected.len(),
                        &seed,
                        &[],
                        budget,
                        base | added,
                    )
                    .unwrap();
                    assert_eq!(reference.0, refined.0);
                    assert_eq!(reference.1, refined.1);
                    assert_eq!(reference.2[..12], refined.2[..12]);
                    #[cfg(feature = "threshold-trace")]
                    {
                        assert_eq!(reference.2[14], refined.2[14]);
                        if added & 32 != 0 {
                            assert_eq!(refined.2[15], 0);
                        }
                        if added & 64 != 0 {
                            assert_eq!(refined.2[17], 0);
                        }
                    }
                }
            }
        }
    }
}
