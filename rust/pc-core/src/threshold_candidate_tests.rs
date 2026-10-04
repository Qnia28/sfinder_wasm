use super::*;

// Independent enumeration: minimum cardinality, original-row quality vector,
// then stable candidate IDs. No threshold preprocessing/search is called here.
fn oracle(rows: &[Vec<(u32, u32)>], n: usize) -> (MinimumCoverResult, Vec<u32>) {
    let mut best: Option<MinimumCoverResult> = None;
    let mut seed = Vec::new();
    for bits in 0usize..(1usize << n) {
        let selected: Vec<u32> = (0..n)
            .filter(|&id| bits & (1 << id) != 0)
            .map(|id| id as u32)
            .collect();
        if rows
            .iter()
            .any(|r| !r.iter().any(|(id, _)| bits & (1 << id) != 0))
        {
            continue;
        }
        let mut quality: Vec<u32> = rows
            .iter()
            .map(|r| {
                r.iter()
                    .filter(|(id, _)| bits & (1 << id) != 0)
                    .map(|(_, q)| *q)
                    .max()
                    .unwrap()
            })
            .collect();
        quality.sort_unstable();
        if best.as_ref().is_none_or(|b| {
            selected.len() < b.selected.len()
                || (selected.len() == b.selected.len()
                    && (quality > b.quality || (quality == b.quality && selected < b.selected)))
        }) {
            best = Some(MinimumCoverResult {
                selected: selected.clone(),
                quality,
                searched_states: 0,
            });
        }
        if selected.len() == best.as_ref().unwrap().selected.len() {
            seed = selected;
        }
    }
    (best.unwrap(), seed)
}

fn exercise<const CURRENT: bool, const ROOT: bool>(rows: &[Vec<(u32, u32)>], n: usize) {
    let (expected, seed) = oracle(rows, n);
    for budget in [Some(0), Some(1), Some(2), Some(5), Some(20), None] {
        let mut prefix = Vec::new();
        let result = fixed_quality_impl::<CURRENT, ROOT>(
            rows,
            n,
            expected.selected.len(),
            &seed,
            &[],
            budget,
            Some(&mut prefix),
        )
        .unwrap();
        let (done, witness) = match result {
            BoundedQualityResult::Exact(w) => (true, w),
            BoundedQualityResult::BudgetExceeded(w) => (false, w),
        };
        if let Some(limit) = budget {
            assert!(witness.searched_states <= limit);
        }
        assert_eq!(witness.selected.len(), expected.selected.len());
        assert!(
            rows.iter()
                .all(|r| r.iter().any(|(id, _)| witness.selected.contains(id)))
        );
        assert_eq!(witness.quality, quality_vector(rows, &witness.selected, n));
        if done {
            assert_eq!(witness.selected, expected.selected);
            assert_eq!(witness.quality, expected.quality);
        }
        let mut levels: Vec<u32> = rows.iter().flatten().map(|(_, q)| *q).collect();
        levels.sort_unstable();
        levels.dedup();
        if levels.len() > 1 {
            levels.remove(0);
        }
        for (i, &target) in prefix.iter().enumerate() {
            assert_eq!(
                target,
                expected.quality.iter().filter(|&&q| q >= levels[i]).count() as u32
            );
            assert_eq!(
                target,
                witness.quality.iter().filter(|&&q| q >= levels[i]).count() as u32
            );
        }
        // Trusted locks from an actual completed proof, not arbitrary seed counts.
        if done {
            for locks in 0..=prefix.len() {
                let locked = fixed_quality_impl::<CURRENT, ROOT>(
                    rows,
                    n,
                    expected.selected.len(),
                    &witness.selected,
                    &prefix[..locks],
                    None,
                    None,
                )
                .unwrap();
                let BoundedQualityResult::Exact(locked) = locked else {
                    panic!("unlimited locked search")
                };
                assert_eq!(locked.selected, expected.selected);
                assert_eq!(locked.quality, expected.quality);
            }
        }
    }
}

#[test]
fn candidates_match_oracle_with_budget_locks_and_full_undo() {
    let mut state = 1900027942u32;
    let mut next = || {
        state = state.wrapping_mul(1664525).wrapping_add(1013904223);
        state
    };
    for case in 0..120 {
        let n = 2 + next() as usize % 6;
        let mut rows = Vec::new();
        for _ in 0..(3 + next() % 7) {
            let mut row: Vec<(u32, u32)> = (0..n)
                .filter_map(|id| {
                    let value = next();
                    (value % 3 != 0).then_some((id as u32, (value / 3) % 7))
                })
                .collect();
            if row.is_empty() {
                row.push((next() % n as u32, next() % 7));
            }
            if case % 4 == 0 {
                row.push(row[0]);
            }
            rows.push(row);
        }
        if case % 3 == 0 {
            rows.push(rows[0].clone());
        }
        exercise::<false, false>(&rows, n);
        exercise::<true, false>(&rows, n);
    }
}

#[test]
fn empty_invalid_and_constant_quality_contracts() {
    assert!(matches!(
        fixed_quality_impl::<true, false>(&[], 0, 0, &[], &[], Some(0), None),
        Some(BoundedQualityResult::Exact(_))
    ));
    let rows = vec![vec![(0, 1), (1, 1)]];
    assert!(fixed_quality_impl::<true, false>(&rows, 2, 1, &[2], &[], None, None).is_none());
    assert!(fixed_quality_impl::<true, false>(&rows, 2, 1, &[1], &[2], None, None).is_none());
    exercise::<true, false>(&rows, 2);
}
