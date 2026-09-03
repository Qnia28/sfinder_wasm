#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PrimaryKernelResult {
    pub cases: Vec<Vec<u32>>,
    pub solution_ids: Vec<u32>,
    pub forced: Vec<u32>,
}

#[inline]
fn words_subset_u64(a: &[u64], b: &[u64]) -> bool {
    a.iter().zip(b).all(|(a, b)| a & !b == 0)
}

#[inline]
fn set_bit(words: &mut [u64], index: usize) {
    words[index >> 6] |= 1u64 << (index & 63);
}

/// Exact primary-cardinality kernelization. Secondary quality is intentionally
/// ignored, so callers must restore the original candidate universe before any
/// human-quality optimization.
pub fn exact_primary_cardinality_kernel(
    raw_cases: &[Vec<u32>],
    solution_count: usize,
) -> Option<PrimaryKernelResult> {
    if raw_cases.is_empty() {
        return Some(PrimaryKernelResult {
            cases: Vec::new(),
            solution_ids: (0..solution_count as u32).collect(),
            forced: Vec::new(),
        });
    }
    if solution_count == 0 {
        return None;
    }

    let mut active_cases: Vec<(usize, Vec<u32>)> = Vec::with_capacity(raw_cases.len());
    for (original, row) in raw_cases.iter().enumerate() {
        let mut ids = row.clone();
        ids.sort_unstable();
        ids.dedup();
        if ids.is_empty() || ids.iter().any(|&id| id as usize >= solution_count) {
            return None;
        }
        active_cases.push((original, ids));
    }
    let mut active_solutions = vec![true; solution_count];
    let mut forced = Vec::<u32>::new();
    let mut forced_flag = vec![false; solution_count];

    loop {
        let mut changed = false;
        let mut next_cases = Vec::with_capacity(active_cases.len());
        for (original, row) in active_cases.into_iter() {
            if row.iter().any(|&id| forced_flag[id as usize]) {
                changed = true;
                continue;
            }
            let ids: Vec<u32> = row
                .into_iter()
                .filter(|&id| active_solutions[id as usize])
                .collect();
            if ids.is_empty() {
                return None;
            }
            next_cases.push((original, ids));
        }
        active_cases = next_cases;
        if active_cases.is_empty() {
            break;
        }

        let mut singleton_ids = Vec::new();
        for (_, row) in &active_cases {
            if row.len() == 1 {
                let id = row[0] as usize;
                if active_solutions[id] && !forced_flag[id] {
                    forced_flag[id] = true;
                    singleton_ids.push(id as u32);
                }
            }
        }
        if !singleton_ids.is_empty() {
            singleton_ids.sort_unstable();
            singleton_ids.dedup();
            for id in singleton_ids {
                active_solutions[id as usize] = false;
                forced.push(id);
            }
            continue;
        }

        // Case dominance: retain only inclusion-minimal candidate sets. Rows are
        // processed from smallest to largest, so the first kept subset proves a
        // later row redundant.
        let solution_words = solution_count.div_ceil(64);
        let mut masks = vec![vec![0u64; solution_words]; active_cases.len()];
        for (case, (_, row)) in active_cases.iter().enumerate() {
            for &id in row {
                set_bit(&mut masks[case], id as usize);
            }
        }
        let mut order: Vec<usize> = (0..active_cases.len()).collect();
        order.sort_unstable_by_key(|&case| (active_cases[case].1.len(), active_cases[case].0));
        let mut keep = vec![false; active_cases.len()];
        let mut kept = Vec::<usize>::new();
        for case in order {
            let dominated = kept
                .iter()
                .copied()
                .any(|prior| words_subset_u64(&masks[prior], &masks[case]));
            if dominated {
                changed = true;
            } else {
                keep[case] = true;
                kept.push(case);
            }
        }
        if changed {
            active_cases = active_cases
                .into_iter()
                .enumerate()
                .filter_map(|(index, entry)| keep[index].then_some(entry))
                .collect();
        }

        // Candidate dominance on the remaining primary cases.
        let case_words = active_cases.len().div_ceil(64);
        let mut coverage = vec![vec![0u64; case_words]; solution_count];
        for (case, (_, row)) in active_cases.iter().enumerate() {
            for &id in row {
                if active_solutions[id as usize] {
                    set_bit(&mut coverage[id as usize], case);
                }
            }
        }
        let active_ids: Vec<usize> = (0..solution_count)
            .filter(|&id| active_solutions[id] && coverage[id].iter().any(|&word| word != 0))
            .collect();
        let mut remove = vec![false; solution_count];
        for &a in &active_ids {
            if remove[a] {
                continue;
            }
            for &b in &active_ids {
                if a == b || remove[b] {
                    continue;
                }
                if words_subset_u64(&coverage[a], &coverage[b])
                    && (coverage[a] != coverage[b] || a > b)
                {
                    remove[a] = true;
                    break;
                }
            }
        }
        for id in 0..solution_count {
            if active_solutions[id] && coverage[id].iter().all(|&word| word == 0) {
                remove[id] = true;
            }
        }
        if remove.iter().any(|&value| value) {
            for id in 0..solution_count {
                if remove[id] {
                    active_solutions[id] = false;
                }
            }
            changed = true;
        }

        if !changed {
            break;
        }
    }

    forced.sort_unstable();
    forced.dedup();
    let solution_ids: Vec<u32> = (0..solution_count)
        .filter(|&id| active_solutions[id])
        .map(|id| id as u32)
        .collect();
    let mut remap = vec![usize::MAX; solution_count];
    for (local, &original) in solution_ids.iter().enumerate() {
        remap[original as usize] = local;
    }
    let mut cases = Vec::with_capacity(active_cases.len());
    for (_, row) in active_cases {
        let ids: Vec<u32> = row
            .into_iter()
            .filter(|&id| active_solutions[id as usize])
            .map(|id| remap[id as usize] as u32)
            .collect();
        if ids.is_empty() {
            return None;
        }
        cases.push(ids);
    }
    Some(PrimaryKernelResult {
        cases,
        solution_ids,
        forced,
    })
}
