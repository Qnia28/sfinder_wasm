use super::*;

mod reference {
    #![allow(dead_code, unused_imports)]
    include!("four_arm_reference.rs");
    pub(super) fn eval(
        rows: &[Vec<(u32, u32)>],
        n: usize,
        k: usize,
        seed: &[u32],
        budget: Option<u64>,
        hist: u64,
        partition: bool,
    ) -> (bool, Vec<u32>, Vec<u32>, u64) {
        match exact_quality_cover_at_count_integrated_with_options(
            rows, n, k, seed, budget, hist, false, partition,
        )
        .unwrap()
        {
            BoundedQualityResult::Exact(r) => (true, r.selected, r.quality, r.searched_states),
            BoundedQualityResult::BudgetExceeded(r) => {
                (false, r.selected, r.quality, r.searched_states)
            }
        }
    }
}

fn tuple(r: BoundedQualityResult) -> (bool, Vec<u32>, Vec<u32>, u64) {
    match r {
        BoundedQualityResult::Exact(r) => (true, r.selected, r.quality, r.searched_states),
        BoundedQualityResult::BudgetExceeded(r) => {
            (false, r.selected, r.quality, r.searched_states)
        }
    }
}

#[test]
fn cutoff_predicate_matches_old_bound_including_padding_and_zero_gain() {
    let mut state = 0x27861u64;
    for sample in 0..3000 {
        let mut next = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        let words = 1 + sample % 5;
        let full: Vec<u64> = (0..words).map(|_| next()).collect();
        let covered: Vec<u64> = (0..words).map(|_| next()).collect();
        let candidates: Vec<Vec<u64>> = (0..sample % 19)
            .map(|_| (0..words).map(|_| next()).collect())
            .collect();
        let bound = lower_bound(&covered, &full, &candidates);
        for slots in 0..40 {
            let expected = if uncovered_count(&covered, &full) == 0 {
                false
            } else {
                bound == usize::MAX || bound > slots
            };
            assert_eq!(
                lower_bound_exceeds_slots(&covered, &full, &candidates, slots),
                expected
            );
        }
    }
    assert!(!lower_bound_exceeds_slots(&[u64::MAX], &[1], &[], 0));
    assert!(lower_bound_exceeds_slots(&[0], &[1], &[vec![0]], 1));
    assert!(!lower_bound_exceeds_slots(
        &[0, 0],
        &[1, 1],
        &[vec![1, 1]],
        2
    ));
}

#[test]
fn current_arm_matches_frozen_a0_and_nonpartition_at_all_budget_boundaries() {
    let mut state = 0x3590380u32;
    let mut next = || {
        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
        state
    };
    for sample in 0..120 {
        let n = 4 + (next() % 5) as usize;
        let mut rows = Vec::new();
        for _ in 0..3 + next() % 9 {
            let mut row = Vec::new();
            for id in 0..n as u32 {
                if next() % 3 != 0 {
                    row.push((id, [1, 7, 23, u32::MAX][(next() % 4) as usize]));
                }
            }
            if row.is_empty() {
                row.push((next() % n as u32, 1));
            }
            if sample % 3 == 0 {
                row.push(row[0]);
            }
            rows.push(row);
        }
        rows.push(rows[0].clone());
        let (oracle, seed) = super::tests::brute_partition_oracle(&rows, n);
        for partition in [false, true] {
            for hist in [1, u64::MAX] {
                let complete = reference::eval(&rows, n, seed.len(), &seed, None, hist, partition);
                assert_eq!(complete.1, oracle.selected);
                assert_eq!(complete.2, oracle.quality);
                let states = complete.3;
                for budget in [
                    Some(0),
                    Some(1),
                    Some(2),
                    Some(5),
                    Some(31),
                    Some(states.saturating_sub(1)),
                    Some(states),
                    Some(states + 1),
                    None,
                ] {
                    let expected =
                        reference::eval(&rows, n, seed.len(), &seed, budget, hist, partition);
                    let actual = tuple(
                        exact_quality_cover_at_count_integrated_with_options(
                            &rows,
                            n,
                            seed.len(),
                            &seed,
                            budget,
                            hist,
                            false,
                            partition,
                        )
                        .unwrap(),
                    );
                    assert_eq!(
                        actual, expected,
                        "sample={sample} partition={partition} hist={hist} budget={budget:?}"
                    );
                }
            }
        }
    }
}

#[test]
fn sibling_single_last_ancestor_and_budget_unwind_match_reference() {
    for rows in [
        vec![vec![(0, 1)], vec![(1, 2)], vec![(2, 3)]],
        vec![
            vec![(0, 1), (1, 7)],
            vec![(1, 2), (2, 5)],
            vec![(0, 3), (2, 9)],
        ],
        vec![
            vec![(3, 10), (4, 1)],
            vec![(0, 10), (1, 1)],
            vec![(1, 1), (3, 10)],
            vec![(2, 1), (3, 10)],
        ],
    ] {
        let (oracle, seed) = super::tests::brute_partition_oracle(&rows, 5);
        for budget in (0..100).map(Some).chain([None]) {
            let actual = tuple(
                exact_quality_cover_at_count_integrated_with_options(
                    &rows,
                    5,
                    oracle.selected.len(),
                    &seed,
                    budget,
                    1,
                    false,
                    true,
                )
                .unwrap(),
            );
            assert_eq!(
                actual,
                reference::eval(&rows, 5, oracle.selected.len(), &seed, budget, 1, true)
            );
        }
    }
}
