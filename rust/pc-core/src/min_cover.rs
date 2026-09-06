use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MinimumCoverResult {
    pub selected: Vec<u32>,
    pub quality: Vec<u32>,
    pub searched_states: u64,
}

#[path = "min_cover_primary.rs"]
mod primary;
pub use primary::{PrimaryKernelResult, exact_primary_cardinality_kernel};

#[inline]
fn subset_sorted(a: &[(u32, u32)], b: &[(u32, u32)]) -> bool {
    // Candidate IDs are sorted and unique. Quality is ignored for cardinality.
    if a.len() > b.len() {
        return false;
    }
    let mut j = 0usize;
    for &(id, _) in a {
        while j < b.len() && b[j].0 < id {
            j += 1;
        }
        if j == b.len() || b[j].0 != id {
            return false;
        }
    }
    true
}

#[inline]
fn bit_is_set(words: &[u64], index: usize) -> bool {
    words[index >> 6] & (1u64 << (index & 63)) != 0
}

#[inline]
fn set_bit(words: &mut [u64], index: usize) {
    words[index >> 6] |= 1u64 << (index & 63);
}

#[inline]
fn or_into(dst: &mut [u64], src: &[u64]) {
    for (d, s) in dst.iter_mut().zip(src) {
        *d |= *s;
    }
}

#[inline]
fn is_full(covered: &[u64], full: &[u64]) -> bool {
    covered.iter().zip(full).all(|(a, b)| a == b)
}

#[inline]
fn uncovered_count(covered: &[u64], full: &[u64]) -> u32 {
    covered
        .iter()
        .zip(full)
        .map(|(a, b)| (b & !a).count_ones())
        .sum()
}

#[inline]
fn gain(coverage: &[u64], covered: &[u64], full: &[u64]) -> u32 {
    coverage
        .iter()
        .zip(covered)
        .zip(full)
        .map(|((s, c), f)| (s & (f & !c)).count_ones())
        .sum()
}

fn lower_bound(covered: &[u64], full: &[u64], solution_coverage: &[Vec<u64>]) -> usize {
    let remaining = uncovered_count(covered, full) as usize;
    if remaining == 0 {
        return 0;
    }
    let max_gain = solution_coverage
        .iter()
        .map(|s| gain(s, covered, full) as usize)
        .max()
        .unwrap_or(0);
    if max_gain == 0 {
        usize::MAX
    } else {
        remaining.div_ceil(max_gain)
    }
}

fn choose_case(covered: &[u64], full: &[u64], case_candidates: &[Vec<u32>]) -> Option<usize> {
    let mut best = None;
    let mut best_count = usize::MAX;
    for (case, candidates) in case_candidates.iter().enumerate() {
        if bit_is_set(full, case) && !bit_is_set(covered, case) {
            let count = candidates.len();
            if count < best_count {
                best = Some(case);
                best_count = count;
                if count <= 1 {
                    break;
                }
            }
        }
    }
    best
}

fn greedy_cover(full: &[u64], solution_coverage: &[Vec<u64>]) -> Option<Vec<u32>> {
    let mut covered = vec![0u64; full.len()];
    let mut selected = Vec::new();
    while !is_full(&covered, full) {
        let mut best = None;
        let mut best_gain = 0u32;
        for (solution, coverage) in solution_coverage.iter().enumerate() {
            let current_gain = gain(coverage, &covered, full);
            if current_gain > best_gain {
                best = Some(solution);
                best_gain = current_gain;
            }
        }
        let solution = best?;
        if best_gain == 0 {
            return None;
        }
        selected.push(solution as u32);
        or_into(&mut covered, &solution_coverage[solution]);
    }
    Some(selected)
}

struct CardinalitySearch<'a> {
    full: &'a [u64],
    case_candidates: &'a [Vec<u32>],
    solution_coverage: &'a [Vec<u64>],
    best_count: usize,
    best_selected: Vec<u32>,
    best_depth_by_covered: HashMap<Vec<u64>, usize>,
    searched_states: u64,
}

impl CardinalitySearch<'_> {
    fn run(&mut self, covered: Vec<u64>, selected: &mut Vec<u32>) {
        self.searched_states += 1;
        let depth = selected.len();
        if is_full(&covered, self.full) {
            if depth < self.best_count {
                self.best_count = depth;
                self.best_selected = selected.clone();
                self.best_selected.sort_unstable();
            }
            return;
        }
        if depth >= self.best_count {
            return;
        }
        if let Some(&previous) = self.best_depth_by_covered.get(&covered)
            && previous <= depth
        {
            return;
        }
        self.best_depth_by_covered.insert(covered.clone(), depth);
        let bound = lower_bound(&covered, self.full, self.solution_coverage);
        if bound == usize::MAX || depth.saturating_add(bound) >= self.best_count {
            return;
        }
        let Some(case) = choose_case(&covered, self.full, self.case_candidates) else {
            return;
        };
        let mut branches: Vec<(u32, u32)> = self.case_candidates[case]
            .iter()
            .copied()
            .map(|solution| {
                let g = gain(
                    &self.solution_coverage[solution as usize],
                    &covered,
                    self.full,
                );
                (solution, g)
            })
            .collect();
        branches.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        for (solution, _) in branches {
            let mut next = covered.clone();
            or_into(&mut next, &self.solution_coverage[solution as usize]);
            selected.push(solution);
            self.run(next, selected);
            selected.pop();
        }
    }
}

fn quality_vector(
    raw_cases: &[Vec<(u32, u32)>],
    selected: &[u32],
    solution_count: usize,
) -> Vec<u32> {
    let mut chosen = vec![false; solution_count];
    for &solution in selected {
        chosen[solution as usize] = true;
    }
    let mut scores = Vec::with_capacity(raw_cases.len());
    for case in raw_cases {
        let mut best = 0u32;
        for &(solution, quality) in case {
            if chosen[solution as usize] {
                best = best.max(quality);
            }
        }
        scores.push(best);
    }
    scores.sort_unstable();
    scores
}

#[inline]
fn quality_better(candidate: &[u32], current: Option<&[u32]>) -> bool {
    let Some(current) = current else {
        return true;
    };
    for (a, b) in candidate.iter().zip(current) {
        if a != b {
            return a > b;
        }
    }
    false
}

// Keep the common small-search path as cheap as the historical implementation.
// Once enough distinct complete K-covers have been evaluated, repeated
// quality-vector reconstruction becomes dominant and an incremental histogram
// pays for its push/pop maintenance.
const QUALITY_HISTOGRAM_SWITCH_COMPLETE_COVERS: u64 = 64;

#[inline]
fn histogram_better(candidate: &[usize], current: &[usize]) -> bool {
    for (a, b) in candidate.iter().zip(current) {
        if a != b {
            // Sorted quality vectors are lexicographically larger exactly when
            // the first differing low-quality bucket contains fewer cases.
            return a < b;
        }
    }
    false
}

#[derive(Clone, Debug)]
struct QualityRowClass {
    multiplicity: usize,
}

#[derive(Clone, Debug)]
struct QualityHistogramState {
    quality_values: Vec<u32>,
    row_classes: Vec<QualityRowClass>,
    sol_to_classes: Vec<Vec<(usize, u32)>>,
    // DFS removes candidates in reverse insertion order. Each class therefore
    // needs a stack of prefix maxima, not a sorted multiset of active ranks.
    class_active_qualities: Vec<Vec<u32>>,
    histogram: Vec<usize>,
}

impl QualityHistogramState {
    fn build(raw_cases: &[Vec<(u32, u32)>], solution_count: usize, selected: &[u32]) -> Self {
        // Rank-compress sparse u32 qualities. This avoids allocating by
        // maxQuality and therefore remains safe for values such as u32::MAX.
        let mut quality_values = vec![0u32];
        for case in raw_cases {
            for &(_, quality) in case {
                quality_values.push(quality);
            }
        }
        quality_values.sort_unstable();
        quality_values.dedup();
        let quality_to_rank: HashMap<u32, u32> = quality_values
            .iter()
            .enumerate()
            .map(|(rank, &quality)| (quality, rank as u32))
            .collect();

        // Cases with exactly the same candidate->quality-rank mapping evolve
        // identically under every selected set. Collapse them and retain their
        // multiplicity so histogram updates touch each equivalence class once.
        let mut class_map: HashMap<Vec<(u32, u32)>, usize> = HashMap::new();
        let mut row_classes: Vec<QualityRowClass> = Vec::new();
        let mut sol_to_classes = vec![Vec::<(usize, u32)>::new(); solution_count];
        for case in raw_cases {
            let key: Vec<(u32, u32)> = case
                .iter()
                .map(|&(solution, quality)| (solution, quality_to_rank[&quality]))
                .collect();
            if let Some(&class_id) = class_map.get(&key) {
                row_classes[class_id].multiplicity += 1;
            } else {
                let class_id = row_classes.len();
                for &(solution, rank) in &key {
                    sol_to_classes[solution as usize].push((class_id, rank));
                }
                class_map.insert(key, class_id);
                row_classes.push(QualityRowClass { multiplicity: 1 });
            }
        }

        let mut state = Self {
            quality_values,
            class_active_qualities: vec![Vec::new(); row_classes.len()],
            histogram: {
                let mut histogram = vec![0usize; quality_to_rank.len()];
                histogram[0] = raw_cases.len();
                histogram
            },
            row_classes,
            sol_to_classes,
        };
        for &solution in selected {
            state.push(solution);
        }
        state
    }

    fn push(&mut self, solution: u32) {
        for &(class_id, rank) in &self.sol_to_classes[solution as usize] {
            let active = &mut self.class_active_qualities[class_id];
            let old_max = active.last().copied().unwrap_or(0);
            let new_max = old_max.max(rank);
            active.push(new_max);
            if old_max != new_max {
                let multiplicity = self.row_classes[class_id].multiplicity;
                self.histogram[old_max as usize] -= multiplicity;
                self.histogram[new_max as usize] += multiplicity;
            }
        }
    }

    fn pop(&mut self, solution: u32) {
        for &(class_id, _) in &self.sol_to_classes[solution as usize] {
            let active = &mut self.class_active_qualities[class_id];
            let old_max = *active
                .last()
                .expect("selected solution quality must be active");
            active.pop();
            let new_max = active.last().copied().unwrap_or(0);
            if old_max != new_max {
                let multiplicity = self.row_classes[class_id].multiplicity;
                self.histogram[old_max as usize] -= multiplicity;
                self.histogram[new_max as usize] += multiplicity;
            }
        }
    }

    fn histogram_for_quality_vector(&self, quality: &[u32]) -> Vec<usize> {
        let mut histogram = vec![0usize; self.quality_values.len()];
        for &value in quality {
            let rank = self
                .quality_values
                .binary_search(&value)
                .expect("quality vector value must exist in compressed ranks");
            histogram[rank] += 1;
        }
        histogram
    }

    fn quality_vector(&self) -> Vec<u32> {
        let mut quality = Vec::with_capacity(self.histogram.iter().sum());
        for (rank, &count) in self.histogram.iter().enumerate() {
            quality.extend(std::iter::repeat_n(self.quality_values[rank], count));
        }
        quality
    }
}

struct BestSetSearch<'a> {
    full: &'a [u64],
    case_candidates: &'a [Vec<u32>],
    solution_coverage: &'a [Vec<u64>],
    raw_cases: &'a [Vec<(u32, u32)>],
    solution_count: usize,
    best_count: usize,
    completed: HashSet<Vec<u32>>,
    best_selected: Option<Vec<u32>>,
    best_quality: Option<Vec<u32>>,
    best_histogram: Option<Vec<usize>>,
    histogram_switch_after: u64,
    quality_histogram: Option<QualityHistogramState>,
    searched_states: u64,
    state_budget: Option<u64>,
    budget_exceeded: bool,
}

impl BestSetSearch<'_> {
    fn maybe_activate_histogram(&mut self, selected: &[u32]) {
        if self.quality_histogram.is_some()
            || (self.completed.len() as u64) < self.histogram_switch_after
        {
            return;
        }
        let state = QualityHistogramState::build(self.raw_cases, self.solution_count, selected);
        self.best_histogram = self
            .best_quality
            .as_deref()
            .map(|quality| state.histogram_for_quality_vector(quality));
        self.quality_histogram = Some(state);
    }

    fn consider(&mut self, selected: &[u32]) {
        let mut stable = selected.to_vec();
        stable.sort_unstable();
        if !self.completed.insert(stable.clone()) {
            return;
        }

        self.maybe_activate_histogram(selected);
        if let Some(state) = self.quality_histogram.as_ref() {
            let replace = match self.best_histogram.as_deref() {
                None => true,
                Some(current) if histogram_better(&state.histogram, current) => true,
                Some(current) if state.histogram.as_slice() == current => self
                    .best_selected
                    .as_deref()
                    .is_none_or(|selected| stable.as_slice() < selected),
                Some(_) => false,
            };
            if replace {
                self.best_selected = Some(stable);
                self.best_histogram = Some(state.histogram.clone());
                self.best_quality = Some(state.quality_vector());
            }
            return;
        }

        let quality = quality_vector(self.raw_cases, &stable, self.solution_count);
        let replace = quality_better(&quality, self.best_quality.as_deref())
            || (self.best_quality.as_deref() == Some(quality.as_slice())
                && self
                    .best_selected
                    .as_deref()
                    .is_none_or(|current| stable.as_slice() < current));
        if replace {
            self.best_selected = Some(stable);
            self.best_quality = Some(quality);
        }
    }

    fn run(&mut self, covered: Vec<u64>, selected: &mut Vec<u32>) {
        if self.budget_exceeded {
            return;
        }
        if self
            .state_budget
            .is_some_and(|budget| self.searched_states >= budget)
        {
            self.budget_exceeded = true;
            return;
        }
        self.searched_states += 1;
        if is_full(&covered, self.full) {
            if selected.len() == self.best_count {
                self.consider(selected);
            }
            return;
        }
        if selected.len() >= self.best_count {
            return;
        }
        let bound = lower_bound(&covered, self.full, self.solution_coverage);
        if bound == usize::MAX || selected.len().saturating_add(bound) > self.best_count {
            return;
        }
        let Some(case) = choose_case(&covered, self.full, self.case_candidates) else {
            return;
        };
        let mut branches: Vec<(u32, u32)> = self.case_candidates[case]
            .iter()
            .copied()
            .map(|solution| {
                let g = gain(
                    &self.solution_coverage[solution as usize],
                    &covered,
                    self.full,
                );
                (solution, g)
            })
            .collect();
        branches.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        for (solution, _) in branches {
            if selected.contains(&solution) {
                continue;
            }
            let mut next = covered.clone();
            or_into(&mut next, &self.solution_coverage[solution as usize]);
            selected.push(solution);
            if let Some(state) = self.quality_histogram.as_mut() {
                state.push(solution);
            }
            self.run(next, selected);
            if let Some(state) = self.quality_histogram.as_mut() {
                state.pop(solution);
            }
            selected.pop();
        }
    }
}

/// Exact minimum-cardinality set cover without secondary quality enumeration.
///
/// This is intended for callers that only require an exact K and one
/// deterministic K-cover seed. Quality values in `raw_cases` are ignored.
pub fn exact_minimum_cardinality_cover(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
) -> Option<MinimumCoverResult> {
    if raw_cases.is_empty() {
        return Some(MinimumCoverResult {
            selected: Vec::new(),
            quality: Vec::new(),
            searched_states: 0,
        });
    }
    if solution_count == 0 || raw_cases.iter().any(Vec::is_empty) {
        return None;
    }

    let mut normalized = Vec::with_capacity(raw_cases.len());
    for case in raw_cases {
        let mut ids: Vec<(u32, u32)> = case.iter().map(|&(solution, _)| (solution, 0)).collect();
        ids.sort_unstable_by_key(|x| x.0);
        ids.dedup_by_key(|x| x.0);
        if ids
            .iter()
            .any(|&(solution, _)| solution as usize >= solution_count)
            || ids.is_empty()
        {
            return None;
        }
        normalized.push(ids);
    }

    let mut active = vec![true; normalized.len()];
    let mut order: Vec<usize> = (0..normalized.len()).collect();
    order.sort_unstable_by_key(|&i| (normalized[i].len(), i));
    for ai in 0..order.len() {
        let a = order[ai];
        if !active[a] {
            continue;
        }
        for &b in &order[ai + 1..] {
            if active[b] && subset_sorted(&normalized[a], &normalized[b]) {
                active[b] = false;
            }
        }
    }

    let active_original: Vec<usize> = (0..normalized.len()).filter(|&i| active[i]).collect();
    let active_count = active_original.len();
    let words = active_count.div_ceil(64);
    let mut full = vec![u64::MAX; words];
    if let Some(last) = full.last_mut() {
        let rem = active_count & 63;
        if rem != 0 {
            *last = (1u64 << rem) - 1;
        }
    }
    let mut case_candidates = Vec::with_capacity(active_count);
    let mut solution_coverage = vec![vec![0u64; words]; solution_count];
    for (active_case, &original_case) in active_original.iter().enumerate() {
        let ids: Vec<u32> = normalized[original_case].iter().map(|x| x.0).collect();
        for &solution in &ids {
            set_bit(&mut solution_coverage[solution as usize], active_case);
        }
        case_candidates.push(ids);
    }

    let greedy = greedy_cover(&full, &solution_coverage)?;
    let mut greedy_stable = greedy.clone();
    greedy_stable.sort_unstable();
    let mut search = CardinalitySearch {
        full: &full,
        case_candidates: &case_candidates,
        solution_coverage: &solution_coverage,
        best_count: greedy.len(),
        best_selected: greedy_stable,
        best_depth_by_covered: HashMap::new(),
        searched_states: 0,
    };
    search.run(vec![0u64; words], &mut Vec::new());
    Some(MinimumCoverResult {
        selected: search.best_selected,
        quality: Vec::new(),
        searched_states: search.searched_states,
    })
}

/// Exact minimum set cover with a secondary maximin-style quality objective.
///
/// `raw_cases[case]` contains `(solution_id, quality)` pairs. Candidate IDs must
/// be in `0..solution_count`. The primary objective is minimum cardinality.
/// Among equal-cardinality covers, each case receives the best quality offered
/// by the selected solutions; these per-case scores are sorted ascending and
/// maximized lexicographically, so the worst-covered case improves first.
fn exact_minimum_cover_with_histogram_switch(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    histogram_switch_after: u64,
) -> Option<MinimumCoverResult> {
    if raw_cases.is_empty() {
        return Some(MinimumCoverResult {
            selected: Vec::new(),
            quality: Vec::new(),
            searched_states: 0,
        });
    }
    if solution_count == 0 || raw_cases.iter().any(Vec::is_empty) {
        return None;
    }

    let mut normalized = Vec::with_capacity(raw_cases.len());
    for case in raw_cases {
        let mut rows = case.clone();
        rows.sort_unstable_by_key(|x| x.0);
        let mut deduped: Vec<(u32, u32)> = Vec::with_capacity(rows.len());
        for (solution, quality) in rows {
            if solution as usize >= solution_count {
                return None;
            }
            if let Some(last) = deduped.last_mut()
                && last.0 == solution
            {
                last.1 = last.1.max(quality);
            } else {
                deduped.push((solution, quality));
            }
        }
        if deduped.is_empty() {
            return None;
        }
        normalized.push(deduped);
    }

    // A case whose candidate set is a superset of another case is redundant
    // for the primary cardinality search. It is retained in `normalized` for
    // the secondary per-case human-quality objective.
    let mut active = vec![true; normalized.len()];
    let mut order: Vec<usize> = (0..normalized.len()).collect();
    order.sort_unstable_by_key(|&i| (normalized[i].len(), i));
    for ai in 0..order.len() {
        let a = order[ai];
        if !active[a] {
            continue;
        }
        for &b in &order[ai + 1..] {
            if active[b] && subset_sorted(&normalized[a], &normalized[b]) {
                active[b] = false;
            }
        }
    }

    let active_original: Vec<usize> = (0..normalized.len()).filter(|&i| active[i]).collect();
    let active_count = active_original.len();
    let words = active_count.div_ceil(64);
    let mut full = vec![u64::MAX; words];
    if let Some(last) = full.last_mut() {
        let rem = active_count & 63;
        if rem != 0 {
            *last = (1u64 << rem) - 1;
        }
    }

    let mut case_candidates = Vec::with_capacity(active_count);
    let mut solution_coverage = vec![vec![0u64; words]; solution_count];
    for (active_case, &original_case) in active_original.iter().enumerate() {
        let ids: Vec<u32> = normalized[original_case].iter().map(|x| x.0).collect();
        for &solution in &ids {
            set_bit(&mut solution_coverage[solution as usize], active_case);
        }
        case_candidates.push(ids);
    }

    let greedy = greedy_cover(&full, &solution_coverage)?;
    let mut greedy_stable = greedy.clone();
    greedy_stable.sort_unstable();
    let mut cardinality = CardinalitySearch {
        full: &full,
        case_candidates: &case_candidates,
        solution_coverage: &solution_coverage,
        best_count: greedy.len(),
        best_selected: greedy_stable,
        best_depth_by_covered: HashMap::new(),
        searched_states: 0,
    };
    cardinality.run(vec![0u64; words], &mut Vec::new());

    let mut best_search = BestSetSearch {
        full: &full,
        case_candidates: &case_candidates,
        solution_coverage: &solution_coverage,
        raw_cases: &normalized,
        solution_count,
        best_count: cardinality.best_count,
        completed: HashSet::new(),
        best_selected: None,
        best_quality: None,
        best_histogram: None,
        histogram_switch_after,
        quality_histogram: None,
        searched_states: 0,
        state_budget: None,
        budget_exceeded: false,
    };
    best_search.run(vec![0u64; words], &mut Vec::new());

    let selected = best_search.best_selected.or_else(|| {
        if greedy.len() == cardinality.best_count {
            let mut fallback = greedy;
            fallback.sort_unstable();
            Some(fallback)
        } else {
            None
        }
    })?;
    let quality = best_search
        .best_quality
        .unwrap_or_else(|| quality_vector(&normalized, &selected, solution_count));

    Some(MinimumCoverResult {
        selected,
        quality,
        searched_states: cardinality.searched_states + best_search.searched_states,
    })
}

pub fn exact_minimum_cover(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
) -> Option<MinimumCoverResult> {
    exact_minimum_cover_with_histogram_switch(
        raw_cases,
        solution_count,
        QUALITY_HISTOGRAM_SWITCH_COMPLETE_COVERS,
    )
}

/// Optimize the legacy human-quality objective at an already-proven exact
/// cardinality using the same integrated BestSetSearch as `exact_minimum_cover`.
/// This deliberately skips the cardinality B&B; for ordinary workloads its
/// search tree therefore matches the canonical secondary search while starting
/// with K already known.
fn exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    state_budget: Option<u64>,
    histogram_switch_after: u64,
    candidate_dominance: bool,
) -> Option<BoundedQualityResult> {
    if raw_cases.is_empty() {
        let result = MinimumCoverResult {
            selected: Vec::new(),
            quality: Vec::new(),
            searched_states: 0,
        };
        return (exact_count == 0).then_some(BoundedQualityResult::Exact(result));
    }
    if solution_count == 0 || exact_count == 0 || seed_selected.len() != exact_count {
        return None;
    }

    let normalized = normalize_quality_cases(raw_cases, solution_count)?;
    let mut seed = seed_selected.to_vec();
    seed.sort_unstable();
    seed.dedup();
    if seed.len() != exact_count || seed.iter().any(|&id| id as usize >= solution_count) {
        return None;
    }

    // Primary case dominance is safe here exactly as in the canonical solver:
    // redundant cases are dropped only from the coverage proof, while all raw
    // cases remain in `normalized` for the secondary quality vector.
    let mut active = vec![true; normalized.len()];
    let mut order: Vec<usize> = (0..normalized.len()).collect();
    order.sort_unstable_by_key(|&i| (normalized[i].len(), i));
    for ai in 0..order.len() {
        let a = order[ai];
        if !active[a] {
            continue;
        }
        for &b in &order[ai + 1..] {
            if active[b] && subset_sorted(&normalized[a], &normalized[b]) {
                active[b] = false;
            }
        }
    }

    let active_original: Vec<usize> = (0..normalized.len()).filter(|&i| active[i]).collect();
    let words = active_original.len().div_ceil(64);
    let mut full = vec![u64::MAX; words];
    if let Some(last) = full.last_mut() {
        let rem = active_original.len() & 63;
        if rem != 0 {
            *last = (1u64 << rem) - 1;
        }
    }
    let mut case_candidates = Vec::with_capacity(active_original.len());
    let mut solution_coverage = vec![vec![0u64; words]; solution_count];
    for (active_case, &original_case) in active_original.iter().enumerate() {
        let ids: Vec<u32> = normalized[original_case].iter().map(|x| x.0).collect();
        for &solution in &ids {
            set_bit(&mut solution_coverage[solution as usize], active_case);
        }
        case_candidates.push(ids);
    }

    // Speculative Fast preview only: remove candidates that are provably no
    // better than a lower stable-ID candidate in coverage and every quality
    // row.  This changes DFS traversal, so callers must only trust the result
    // when the bounded search completes exactly; a timed-out preview is
    // discarded and the historical search is restarted from the original seed.
    let dominated = candidate_dominance
        .then(|| quality_candidate_dominance_mask(&normalized, solution_count, &solution_coverage));
    if let Some(dominated) = dominated.as_deref() {
        for row in &mut case_candidates {
            row.retain(|&solution| !dominated[solution as usize]);
            if row.is_empty() {
                return None;
            }
        }
    }

    // The supplied seed must prove that this K is feasible on the full primary
    // problem.  K optimality itself is the caller's responsibility (the primary
    // backend has already proven it).
    let mut seed_covered = vec![0u64; words];
    for &solution in &seed {
        or_into(&mut seed_covered, &solution_coverage[solution as usize]);
    }
    if !is_full(&seed_covered, &full) {
        return None;
    }

    // After seed validation, remove dominated solutions from the gain/lower-bound
    // universe as well as from branch candidate lists. Keeping their coverage
    // here would make lower_bound artificially weak and can turn a tiny exact
    // preview into an unnecessary timeout.
    if let Some(dominated) = dominated.as_deref() {
        for (solution, &is_dominated) in dominated.iter().enumerate() {
            if is_dominated {
                solution_coverage[solution].fill(0);
            }
        }
    }

    let seed_quality = quality_vector(&normalized, &seed, solution_count);
    let mut completed = HashSet::new();
    completed.insert(seed.clone());
    let mut search = BestSetSearch {
        full: &full,
        case_candidates: &case_candidates,
        solution_coverage: &solution_coverage,
        raw_cases: &normalized,
        solution_count,
        best_count: exact_count,
        completed,
        best_selected: Some(seed.clone()),
        best_quality: Some(seed_quality.clone()),
        best_histogram: None,
        histogram_switch_after,
        quality_histogram: None,
        searched_states: 0,
        state_budget,
        budget_exceeded: false,
    };
    search.run(vec![0u64; words], &mut Vec::new());

    let selected = search.best_selected.unwrap_or(seed);
    let quality = search
        .best_quality
        .unwrap_or_else(|| quality_vector(&normalized, &selected, solution_count));
    let result = MinimumCoverResult {
        selected,
        quality,
        searched_states: search.searched_states,
    };
    Some(if search.budget_exceeded {
        BoundedQualityResult::BudgetExceeded(result)
    } else {
        BoundedQualityResult::Exact(result)
    })
}

pub fn exact_quality_cover_at_count_integrated_bounded(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    state_budget: Option<u64>,
) -> Option<BoundedQualityResult> {
    exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        state_budget,
        QUALITY_HISTOGRAM_SWITCH_COMPLETE_COVERS,
        false,
    )
}

/// Speculative exact fixed-K search with sound candidate dominance.
///
/// Candidate dominance changes the DFS tree, so a bounded timeout must not be
/// used as a production incumbent.  The Fast JS caller uses this only as a
/// small preview: an `Exact` result is accepted, while `BudgetExceeded` is
/// discarded before restarting the historical integrated search.
pub fn exact_quality_cover_at_count_integrated_dominance_bounded(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    state_budget: Option<u64>,
) -> Option<BoundedQualityResult> {
    exact_quality_cover_at_count_integrated_bounded_with_histogram_switch(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        state_budget,
        QUALITY_HISTOGRAM_SWITCH_COMPLETE_COVERS,
        true,
    )
}

pub fn exact_quality_cover_at_count_integrated(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
) -> Option<MinimumCoverResult> {
    match exact_quality_cover_at_count_integrated_bounded(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        None,
    )? {
        BoundedQualityResult::Exact(result) => Some(result),
        BoundedQualityResult::BudgetExceeded(_) => unreachable!(),
    }
}

#[derive(Clone, Debug)]
struct QualityThresholdData {
    weights: Vec<u32>,
    group_candidates: Vec<Vec<u32>>,
    candidate_groups: Vec<Vec<u32>>,
    candidate_group_bits: Vec<Vec<u64>>,
    total_weight: u32,
}

impl QualityThresholdData {
    fn build(cases: &[Vec<(u32, u32)>], solution_count: usize, threshold: u32) -> Self {
        let mut grouped: HashMap<Vec<u32>, u32> = HashMap::new();
        for row in cases {
            let mut ids: Vec<u32> = row
                .iter()
                .filter_map(|&(id, quality)| (quality >= threshold).then_some(id))
                .collect();
            ids.sort_unstable();
            ids.dedup();
            *grouped.entry(ids).or_insert(0) += 1;
        }
        let mut entries: Vec<(Vec<u32>, u32)> = grouped.into_iter().collect();
        entries.sort_unstable_by(|a, b| a.0.cmp(&b.0));
        let group_count = entries.len();
        let group_words = group_count.div_ceil(64);
        let mut weights = Vec::with_capacity(group_count);
        let mut group_candidates = Vec::with_capacity(group_count);
        let mut candidate_groups = vec![Vec::new(); solution_count];
        let mut candidate_group_bits = vec![vec![0u64; group_words]; solution_count];
        let mut total_weight = 0u32;
        for (group, (ids, weight)) in entries.into_iter().enumerate() {
            weights.push(weight);
            total_weight += weight;
            for &id in &ids {
                candidate_groups[id as usize].push(group as u32);
                set_bit(&mut candidate_group_bits[id as usize], group);
            }
            group_candidates.push(ids);
        }
        Self {
            weights,
            group_candidates,
            candidate_groups,
            candidate_group_bits,
            total_weight,
        }
    }
}

#[derive(Clone, Debug)]
struct QualityThresholdState {
    cover_count: Vec<u16>,
    available_count: Vec<u16>,
    gains: Vec<u32>,
    good: u32,
    dead_bad: u32,
}

impl QualityThresholdState {
    fn new(data: &QualityThresholdData, solution_count: usize) -> Self {
        let mut gains = vec![0u32; solution_count];
        let mut available_count = Vec::with_capacity(data.weights.len());
        let mut dead_bad = 0u32;
        for (group, candidates) in data.group_candidates.iter().enumerate() {
            available_count.push(candidates.len() as u16);
            if candidates.is_empty() {
                dead_bad += data.weights[group];
            }
            let weight = data.weights[group];
            for &candidate in candidates {
                gains[candidate as usize] += weight;
            }
        }
        Self {
            cover_count: vec![0u16; data.weights.len()],
            available_count,
            gains,
            good: 0,
            dead_bad,
        }
    }

    fn disable_candidate(&mut self, data: &QualityThresholdData, solution: usize) {
        for &group in &data.candidate_groups[solution] {
            let group = group as usize;
            debug_assert!(self.available_count[group] > 0);
            if self.cover_count[group] == 0 && self.available_count[group] == 1 {
                self.dead_bad += data.weights[group];
            }
            self.available_count[group] -= 1;
        }
    }

    fn enable_candidate(&mut self, data: &QualityThresholdData, solution: usize) {
        for &group in &data.candidate_groups[solution] {
            let group = group as usize;
            if self.cover_count[group] == 0 && self.available_count[group] == 0 {
                self.dead_bad -= data.weights[group];
            }
            self.available_count[group] += 1;
        }
    }

    fn add(&mut self, data: &QualityThresholdData, solution: usize) {
        self.disable_candidate(data, solution);
        for &group in &data.candidate_groups[solution] {
            let group = group as usize;
            if self.cover_count[group] == 0 {
                let weight = data.weights[group];
                if self.available_count[group] == 0 {
                    self.dead_bad -= weight;
                }
                self.good += weight;
                for &candidate in &data.group_candidates[group] {
                    self.gains[candidate as usize] -= weight;
                }
            }
            self.cover_count[group] += 1;
        }
    }

    fn remove(&mut self, data: &QualityThresholdData, solution: usize) {
        for &group in &data.candidate_groups[solution] {
            let group = group as usize;
            self.cover_count[group] -= 1;
            if self.cover_count[group] == 0 {
                let weight = data.weights[group];
                self.good -= weight;
                for &candidate in &data.group_candidates[group] {
                    self.gains[candidate as usize] += weight;
                }
                if self.available_count[group] == 0 {
                    self.dead_bad += weight;
                }
            }
        }
        self.enable_candidate(data, solution);
    }
}

#[inline]
fn words_subset(a: &[u64], b: &[u64]) -> bool {
    a.iter().zip(b).all(|(a, b)| a & !b == 0)
}

fn quality_candidate_dominance_mask(
    normalized: &[Vec<(u32, u32)>],
    solution_count: usize,
    solution_coverage: &[Vec<u64>],
) -> Vec<bool> {
    let case_count = normalized.len();
    let mut quality = vec![0u32; solution_count.saturating_mul(case_count)];
    for (case, row) in normalized.iter().enumerate() {
        for &(solution, score) in row {
            quality[solution as usize * case_count + case] = score;
        }
    }

    let mut dominated = vec![false; solution_count];
    // Only a lower stable ID may dominate a higher one.  Coverage is compared
    // on the active primary rows; quality is compared on every normalized row
    // with absence represented as zero.  These three conditions preserve the
    // exact fixed-K quality objective and its final stable-ID tie-break.
    for y in 0..solution_count {
        for x in 0..y {
            if dominated[x] {
                continue;
            }
            let coverage_superset = solution_coverage[x]
                .iter()
                .zip(&solution_coverage[y])
                .all(|(&cx, &cy)| cx & cy == cy);
            if !coverage_superset {
                continue;
            }
            let xq = &quality[x * case_count..(x + 1) * case_count];
            let yq = &quality[y * case_count..(y + 1) * case_count];
            if xq.iter().zip(yq).all(|(qx, qy)| qx >= qy) {
                dominated[y] = true;
                break;
            }
        }
    }
    dominated
}

fn normalize_quality_cases(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
) -> Option<Vec<Vec<(u32, u32)>>> {
    let mut normalized = Vec::with_capacity(raw_cases.len());
    for case in raw_cases {
        let mut rows = case.clone();
        rows.sort_unstable_by_key(|row| row.0);
        let mut deduped: Vec<(u32, u32)> = Vec::with_capacity(rows.len());
        for (solution, quality) in rows {
            if solution as usize >= solution_count {
                return None;
            }
            if let Some(last) = deduped.last_mut()
                && last.0 == solution
            {
                last.1 = last.1.max(quality);
            } else {
                deduped.push((solution, quality));
            }
        }
        if deduped.is_empty() {
            return None;
        }
        normalized.push(deduped);
    }
    Some(normalized)
}

fn full_primary_coverage(cases: &[Vec<(u32, u32)>], solution_count: usize) -> Vec<Vec<u64>> {
    let words = cases.len().div_ceil(64);
    let mut coverage = vec![vec![0u64; words]; solution_count];
    for (case, row) in cases.iter().enumerate() {
        for &(solution, _) in row {
            set_bit(&mut coverage[solution as usize], case);
        }
    }
    coverage
}

fn threshold_static_active_candidates(
    primary_coverage: &[Vec<u64>],
    threshold_data: &[QualityThresholdData],
    through: usize,
    stable_tie: bool,
) -> Vec<bool> {
    let solution_count = primary_coverage.len();
    let mut active = vec![true; solution_count];
    for a in 0..solution_count {
        if primary_coverage[a].iter().all(|&word| word == 0) {
            active[a] = false;
            continue;
        }
        for b in 0..solution_count {
            if a == b || !words_subset(&primary_coverage[a], &primary_coverage[b]) {
                continue;
            }
            let mut dominates = true;
            let mut strict = primary_coverage[a] != primary_coverage[b];
            for data in &threshold_data[..=through] {
                let a_bits = &data.candidate_group_bits[a];
                let b_bits = &data.candidate_group_bits[b];
                if !words_subset(a_bits, b_bits) {
                    dominates = false;
                    break;
                }
                strict |= a_bits != b_bits;
            }
            if dominates && ((!stable_tie && strict) || b < a) {
                active[a] = false;
                break;
            }
        }
    }
    active
}

type PrimaryKernel = (Vec<u64>, Vec<Vec<u32>>, Vec<Vec<u64>>);

fn kernelize_primary_for_candidates(
    cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    active_candidate: &[bool],
) -> Option<PrimaryKernel> {
    let mut rows: Vec<Vec<u32>> = Vec::with_capacity(cases.len());
    for row in cases {
        let mut ids: Vec<u32> = row
            .iter()
            .filter_map(|&(id, _)| active_candidate[id as usize].then_some(id))
            .collect();
        ids.sort_unstable();
        ids.dedup();
        if ids.is_empty() {
            return None;
        }
        rows.push(ids);
    }

    let mut active_case = vec![true; rows.len()];
    let mut order: Vec<usize> = (0..rows.len()).collect();
    order.sort_unstable_by_key(|&case| (rows[case].len(), case));
    for ai in 0..order.len() {
        let a = order[ai];
        if !active_case[a] {
            continue;
        }
        for &b in &order[ai + 1..] {
            if active_case[b] && rows[a].iter().all(|id| rows[b].binary_search(id).is_ok()) {
                active_case[b] = false;
            }
        }
    }

    let kept: Vec<usize> = (0..rows.len()).filter(|&case| active_case[case]).collect();
    let words = kept.len().div_ceil(64);
    let mut full = vec![u64::MAX; words];
    if let Some(last) = full.last_mut() {
        let rem = kept.len() & 63;
        if rem != 0 {
            *last = (1u64 << rem) - 1;
        }
    }
    let mut case_candidates = Vec::with_capacity(kept.len());
    let mut solution_coverage = vec![vec![0u64; words]; solution_count];
    for (active_case_index, &case) in kept.iter().enumerate() {
        for &solution in &rows[case] {
            set_bit(&mut solution_coverage[solution as usize], active_case_index);
        }
        case_candidates.push(rows[case].clone());
    }
    Some((full, case_candidates, solution_coverage))
}

#[inline]
fn available_candidate(id: usize, selected: &[bool], excluded: &[bool]) -> bool {
    !selected[id] && !excluded[id]
}

fn choose_available_case(
    covered: &[u64],
    full: &[u64],
    case_candidates: &[Vec<u32>],
    selected: &[bool],
    excluded: &[bool],
) -> Option<(usize, usize)> {
    let mut best = None;
    let mut best_count = usize::MAX;
    for (case, candidates) in case_candidates.iter().enumerate() {
        if !bit_is_set(full, case) || bit_is_set(covered, case) {
            continue;
        }
        let count = candidates
            .iter()
            .filter(|&&id| available_candidate(id as usize, selected, excluded))
            .count();
        if count < best_count {
            best = Some(case);
            best_count = count;
            if count <= 1 {
                break;
            }
        }
    }
    best.map(|case| (case, best_count))
}

fn available_primary_lower_bound(
    covered: &[u64],
    full: &[u64],
    solution_coverage: &[Vec<u64>],
    selected: &[bool],
    excluded: &[bool],
) -> usize {
    let remaining = uncovered_count(covered, full) as usize;
    if remaining == 0 {
        return 0;
    }
    let mut max_gain = 0usize;
    for (solution, coverage) in solution_coverage.iter().enumerate() {
        if available_candidate(solution, selected, excluded) {
            max_gain = max_gain.max(gain(coverage, covered, full) as usize);
        }
    }
    if max_gain == 0 {
        usize::MAX
    } else {
        remaining.div_ceil(max_gain)
    }
}

fn top_available_gain_sum(
    gains: &[u32],
    selected: &[bool],
    excluded: &[bool],
    slots: usize,
) -> u32 {
    if slots == 0 {
        return 0;
    }
    if slots <= 64 {
        let mut top = [0u32; 64];
        for (id, &value) in gains.iter().enumerate() {
            if !available_candidate(id, selected, excluded) {
                continue;
            }
            if value <= top[slots - 1] {
                continue;
            }
            let mut at = slots - 1;
            while at > 0 && value > top[at - 1] {
                top[at] = top[at - 1];
                at -= 1;
            }
            top[at] = value;
        }
        top[..slots].iter().sum()
    } else {
        gains
            .iter()
            .enumerate()
            .filter(|(id, _)| available_candidate(*id, selected, excluded))
            .map(|(_, &gain)| gain)
            .sum()
    }
}

fn pair_overlap_weight(
    data: &QualityThresholdData,
    state: &QualityThresholdState,
    a: usize,
    b: usize,
) -> u32 {
    let (small, other) = if data.candidate_groups[a].len() <= data.candidate_groups[b].len() {
        (a, b)
    } else {
        (b, a)
    };
    let mut overlap = 0u32;
    for &group in &data.candidate_groups[small] {
        let group = group as usize;
        if state.cover_count[group] == 0 && bit_is_set(&data.candidate_group_bits[other], group) {
            overlap += data.weights[group];
        }
    }
    overlap
}

fn exact_pair_gain_bound(
    data: &QualityThresholdData,
    state: &QualityThresholdState,
    selected: &[bool],
    excluded: &[bool],
) -> u32 {
    let mut candidates: Vec<usize> = (0..state.gains.len())
        .filter(|&id| available_candidate(id, selected, excluded) && state.gains[id] > 0)
        .collect();
    candidates.sort_unstable_by(|&a, &b| state.gains[b].cmp(&state.gains[a]).then(a.cmp(&b)));
    if candidates.is_empty() {
        return 0;
    }
    if candidates.len() == 1 {
        return state.gains[candidates[0]];
    }
    let mut best = state.gains[candidates[0]];
    for i in 0..candidates.len() {
        let a = candidates[i];
        if state.gains[a].saturating_add(state.gains[candidates[0]]) <= best {
            break;
        }
        for &b in &candidates[i + 1..] {
            let sum = state.gains[a].saturating_add(state.gains[b]);
            if sum <= best {
                break;
            }
            best = best.max(sum.saturating_sub(pair_overlap_weight(data, state, a, b)));
        }
    }
    best
}

fn optimistic_quality_gain(
    data: &QualityThresholdData,
    state: &QualityThresholdState,
    selected: &[bool],
    excluded: &[bool],
    slots: usize,
) -> u32 {
    if slots == 0 {
        return 0;
    }
    let reachable_bad = data
        .total_weight
        .saturating_sub(state.good)
        .saturating_sub(state.dead_bad);
    let simple = top_available_gain_sum(&state.gains, selected, excluded, slots).min(reachable_bad);
    if slots == 1 {
        return simple;
    }
    if slots <= 4 {
        let pair = exact_pair_gain_bound(data, state, selected, excluded);
        let single = top_available_gain_sum(&state.gains, selected, excluded, 1);
        let pair_sum = (slots / 2) as u32 * pair + (slots % 2) as u32 * single;
        return simple.min(pair_sum.min(reachable_bad));
    }
    simple
}

struct DynamicDominanceContext<'a> {
    branches: &'a [u32],
    covered: &'a [u64],
    solution_coverage: &'a [Vec<u64>],
    threshold_data: &'a [QualityThresholdData],
    states: &'a [QualityThresholdState],
    selected: &'a [bool],
    excluded: &'a [bool],
    stable_tie: bool,
}

fn dynamic_branch_dominated(a: usize, context: &DynamicDominanceContext<'_>) -> bool {
    'candidate: for &b_raw in context.branches {
        let b = b_raw as usize;
        if b == a || !available_candidate(b, context.selected, context.excluded) {
            continue;
        }
        // During intermediate threshold proofs stable IDs are irrelevant, so
        // any strict dominator is safe. During the final threshold (where the
        // legacy stable-ID tie is resolved), only a lower-ID replacement is
        // allowed.
        if context.stable_tie && b >= a {
            continue;
        }
        let mut strict = false;
        for word in 0..context.covered.len() {
            let a_need = context.solution_coverage[a][word] & !context.covered[word];
            let b_need = context.solution_coverage[b][word] & !context.covered[word];
            if a_need & !b_need != 0 {
                continue 'candidate;
            }
            strict |= b_need & !a_need != 0;
        }
        for (data, state) in context.threshold_data.iter().zip(context.states) {
            for &group in &data.candidate_groups[a] {
                let group = group as usize;
                if state.cover_count[group] == 0
                    && !bit_is_set(&data.candidate_group_bits[b], group)
                {
                    continue 'candidate;
                }
            }
            if !strict {
                for &group in &data.candidate_groups[b] {
                    let group = group as usize;
                    if state.cover_count[group] == 0
                        && !bit_is_set(&data.candidate_group_bits[a], group)
                    {
                        strict = true;
                        break;
                    }
                }
            }
        }
        if strict || b < a {
            return true;
        }
    }
    false
}

fn threshold_count_for_selected(
    cases: &[Vec<(u32, u32)>],
    selected: &[u32],
    threshold: u32,
    solution_count: usize,
) -> u32 {
    let mut chosen = vec![false; solution_count];
    for &id in selected {
        chosen[id as usize] = true;
    }
    cases
        .iter()
        .filter(|case| {
            case.iter()
                .any(|&(id, q)| q >= threshold && chosen[id as usize])
        })
        .count() as u32
}

fn optimistic_lex_completion(
    selected_ids: &[u32],
    selected: &[bool],
    excluded: &[bool],
    exact_count: usize,
) -> Option<Vec<u32>> {
    let mut result = selected_ids.to_vec();
    for id in 0..selected.len() {
        if result.len() >= exact_count {
            break;
        }
        if available_candidate(id, selected, excluded) {
            result.push(id as u32);
        }
    }
    if result.len() != exact_count {
        return None;
    }
    result.sort_unstable();
    Some(result)
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BoundedQualityResult {
    Exact(MinimumCoverResult),
    BudgetExceeded(MinimumCoverResult),
}

struct SequentialThresholdSearch<'a> {
    full: &'a [u64],
    case_candidates: &'a [Vec<u32>],
    solution_coverage: &'a [Vec<u64>],
    threshold_data: &'a [QualityThresholdData],
    prior_targets: &'a [u32],
    current_index: usize,
    exact_count: usize,
    stable_tie: bool,
    best_current: u32,
    best_selected: Vec<u32>,
    selected_flags: Vec<bool>,
    excluded: Vec<bool>,
    selected_ids: Vec<u32>,
    states: Vec<QualityThresholdState>,
    searched_states: u64,
    state_budget: Option<u64>,
    budget_exceeded: bool,
}

impl SequentialThresholdSearch<'_> {
    fn add_solution(&mut self, solution: usize) {
        self.selected_flags[solution] = true;
        self.selected_ids.push(solution as u32);
        for (data, state) in self.threshold_data.iter().zip(&mut self.states) {
            state.add(data, solution);
        }
    }

    fn remove_solution(&mut self, solution: usize) {
        for (data, state) in self.threshold_data.iter().zip(&mut self.states) {
            state.remove(data, solution);
        }
        self.selected_ids.pop();
        self.selected_flags[solution] = false;
    }

    fn exclude_solution(&mut self, solution: usize) {
        debug_assert!(!self.excluded[solution]);
        self.excluded[solution] = true;
        for (data, state) in self.threshold_data.iter().zip(&mut self.states) {
            state.disable_candidate(data, solution);
        }
    }

    fn include_solution(&mut self, solution: usize) {
        debug_assert!(self.excluded[solution]);
        for (data, state) in self.threshold_data.iter().zip(&mut self.states) {
            state.enable_candidate(data, solution);
        }
        self.excluded[solution] = false;
    }

    fn prior_possible(&self, slots: usize) -> bool {
        for index in 0..self.current_index {
            let upper = self.states[index]
                .good
                .saturating_add(optimistic_quality_gain(
                    &self.threshold_data[index],
                    &self.states[index],
                    &self.selected_flags,
                    &self.excluded,
                    slots,
                ));
            if upper < self.prior_targets[index] {
                return false;
            }
        }
        true
    }

    fn current_upper(&self, slots: usize) -> u32 {
        self.states[self.current_index]
            .good
            .saturating_add(optimistic_quality_gain(
                &self.threshold_data[self.current_index],
                &self.states[self.current_index],
                &self.selected_flags,
                &self.excluded,
                slots,
            ))
    }

    fn run(&mut self, covered: Vec<u64>) {
        if self.budget_exceeded {
            return;
        }
        if let Some(limit) = self.state_budget
            && self.searched_states >= limit
        {
            self.budget_exceeded = true;
            return;
        }
        self.searched_states += 1;
        #[cfg(not(target_arch = "wasm32"))]
        if self.searched_states.is_multiple_of(1_000_000)
            && std::env::var_os("SFINDER_QUALITY_TRACE").is_some()
        {
            eprintln!(
                "quality-bnb states={} depth={} current={} best={}",
                self.searched_states,
                self.selected_ids.len(),
                self.states[self.current_index].good,
                self.best_current
            );
        }
        let depth = self.selected_ids.len();
        if depth > self.exact_count {
            return;
        }
        let slots = self.exact_count - depth;
        if !self.prior_possible(slots) {
            return;
        }
        let upper = self.current_upper(slots);
        if upper < self.best_current || (!self.stable_tie && upper == self.best_current) {
            return;
        }
        if self.stable_tie && upper == self.best_current {
            let Some(optimistic) = optimistic_lex_completion(
                &self.selected_ids,
                &self.selected_flags,
                &self.excluded,
                self.exact_count,
            ) else {
                return;
            };
            if optimistic.as_slice() >= self.best_selected.as_slice() {
                return;
            }
        }

        if is_full(&covered, self.full) {
            if depth != self.exact_count {
                return;
            }
            for index in 0..self.current_index {
                if self.states[index].good != self.prior_targets[index] {
                    return;
                }
            }
            let current = self.states[self.current_index].good;
            let mut stable = self.selected_ids.clone();
            stable.sort_unstable();
            if current > self.best_current
                || (self.stable_tie
                    && current == self.best_current
                    && stable.as_slice() < self.best_selected.as_slice())
            {
                self.best_current = current;
                self.best_selected = stable;
            }
            return;
        }
        if slots == 0 {
            return;
        }

        let bound = available_primary_lower_bound(
            &covered,
            self.full,
            self.solution_coverage,
            &self.selected_flags,
            &self.excluded,
        );
        if bound == usize::MAX || bound > slots {
            return;
        }
        let Some((case, available)) = choose_available_case(
            &covered,
            self.full,
            self.case_candidates,
            &self.selected_flags,
            &self.excluded,
        ) else {
            return;
        };
        if available == 0 {
            return;
        }

        let mut branches: Vec<u32> = self.case_candidates[case]
            .iter()
            .copied()
            .filter(|&id| available_candidate(id as usize, &self.selected_flags, &self.excluded))
            .collect();
        branches.sort_unstable_by(|&a, &b| {
            self.states[self.current_index].gains[b as usize]
                .cmp(&self.states[self.current_index].gains[a as usize])
                .then_with(|| {
                    gain(&self.solution_coverage[b as usize], &covered, self.full).cmp(&gain(
                        &self.solution_coverage[a as usize],
                        &covered,
                        self.full,
                    ))
                })
                .then(a.cmp(&b))
        });

        let mut excluded_here = Vec::with_capacity(branches.len());
        for &solution in &branches {
            if self.budget_exceeded {
                break;
            }
            let id = solution as usize;
            if !available_candidate(id, &self.selected_flags, &self.excluded) {
                continue;
            }
            if dynamic_branch_dominated(
                id,
                &DynamicDominanceContext {
                    branches: &branches,
                    covered: &covered,
                    solution_coverage: self.solution_coverage,
                    threshold_data: self.threshold_data,
                    states: &self.states,
                    selected: &self.selected_flags,
                    excluded: &self.excluded,
                    stable_tie: self.stable_tie,
                },
            ) {
                self.exclude_solution(id);
                excluded_here.push(id);
                continue;
            }
            let mut next = covered.clone();
            or_into(&mut next, &self.solution_coverage[id]);
            self.add_solution(id);
            self.run(next);
            self.remove_solution(id);
            if self.budget_exceeded {
                break;
            }
            self.exclude_solution(id);
            excluded_here.push(id);
        }
        for id in excluded_here.into_iter().rev() {
            self.include_solution(id);
        }
    }
}

/// Exact secondary human-quality optimization at a cardinality already proven
/// optimal by another exact primary solver (normally HiGHS).
///
/// The legacy quality objective is represented exactly by sequentially
/// maximizing the number of cases whose score reaches each increasing quality
/// threshold. The final threshold also resolves the original stable-ID tie.
fn fixed_quality_internal(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    locked_prefix: &[u32],
    state_budget: Option<u64>,
) -> Option<BoundedQualityResult> {
    if raw_cases.is_empty() {
        let result = MinimumCoverResult {
            selected: Vec::new(),
            quality: Vec::new(),
            searched_states: 0,
        };
        return (exact_count == 0).then_some(BoundedQualityResult::Exact(result));
    }
    if solution_count == 0 || exact_count == 0 || seed_selected.len() != exact_count {
        return None;
    }
    let normalized = normalize_quality_cases(raw_cases, solution_count)?;
    let mut seed = seed_selected.to_vec();
    seed.sort_unstable();
    seed.dedup();
    if seed.len() != exact_count || seed.iter().any(|&id| id as usize >= solution_count) {
        return None;
    }

    let primary_coverage = full_primary_coverage(&normalized, solution_count);
    let mut seed_primary = vec![0u64; normalized.len().div_ceil(64)];
    for &id in &seed {
        or_into(&mut seed_primary, &primary_coverage[id as usize]);
    }
    let mut all_primary = vec![u64::MAX; seed_primary.len()];
    if let Some(last) = all_primary.last_mut() {
        let rem = normalized.len() & 63;
        if rem != 0 {
            *last = (1u64 << rem) - 1;
        }
    }
    if !is_full(&seed_primary, &all_primary) {
        return None;
    }

    let mut levels: Vec<u32> = normalized
        .iter()
        .flat_map(|row| row.iter().map(|&(_, quality)| quality))
        .collect();
    levels.sort_unstable();
    levels.dedup();
    // The lowest quality threshold is normally vacuous for an exact cover, so
    // discard it only when another threshold remains. With one distinct level,
    // removing it would skip the sequential search entirely and therefore skip
    // the final stable candidate-ID tie-break, returning the caller's seed.
    if levels.len() > 1 {
        levels.remove(0);
    }
    let threshold_data: Vec<QualityThresholdData> = levels
        .iter()
        .map(|&threshold| QualityThresholdData::build(&normalized, solution_count, threshold))
        .collect();

    if locked_prefix.len() > threshold_data.len() {
        return None;
    }
    for (index, &target) in locked_prefix.iter().enumerate() {
        if threshold_count_for_selected(&normalized, &seed, levels[index], solution_count) != target
        {
            return None;
        }
    }

    let mut best = seed;
    let mut targets = locked_prefix.to_vec();
    let mut searched_states = 0u64;

    for current_index in locked_prefix.len()..threshold_data.len() {
        let remaining_budget = state_budget.map(|limit| limit.saturating_sub(searched_states));
        if remaining_budget == Some(0) {
            return Some(BoundedQualityResult::BudgetExceeded(MinimumCoverResult {
                selected: best.clone(),
                quality: quality_vector(&normalized, &best, solution_count),
                searched_states,
            }));
        }
        let stable_tie = current_index + 1 == threshold_data.len();
        let active_candidate = threshold_static_active_candidates(
            &primary_coverage,
            &threshold_data,
            current_index,
            stable_tie,
        );
        let (full, mut case_candidates, solution_coverage) =
            kernelize_primary_for_candidates(&normalized, solution_count, &active_candidate)?;
        let incumbent =
            threshold_count_for_selected(&normalized, &best, levels[current_index], solution_count);
        let current_size: Vec<u32> = threshold_data[current_index]
            .candidate_groups
            .iter()
            .map(|groups| {
                groups
                    .iter()
                    .map(|&g| threshold_data[current_index].weights[g as usize])
                    .sum()
            })
            .collect();
        let best_flag: Vec<bool> = (0..solution_count)
            .map(|id| best.binary_search(&(id as u32)).is_ok())
            .collect();
        for candidates in &mut case_candidates {
            candidates.sort_unstable_by(|a, b| {
                best_flag[*b as usize]
                    .cmp(&best_flag[*a as usize])
                    .then(current_size[*b as usize].cmp(&current_size[*a as usize]))
                    .then(a.cmp(b))
            });
        }
        let mut states: Vec<QualityThresholdState> = threshold_data[..=current_index]
            .iter()
            .map(|data| QualityThresholdState::new(data, solution_count))
            .collect();
        for (solution, &active) in active_candidate.iter().enumerate().take(solution_count) {
            if !active {
                for (data, state) in threshold_data[..=current_index].iter().zip(&mut states) {
                    state.disable_candidate(data, solution);
                }
            }
        }
        let mut search = SequentialThresholdSearch {
            full: &full,
            case_candidates: &case_candidates,
            solution_coverage: &solution_coverage,
            threshold_data: &threshold_data[..=current_index],
            prior_targets: &targets,
            current_index,
            exact_count,
            stable_tie,
            best_current: incumbent,
            best_selected: best.clone(),
            selected_flags: vec![false; solution_count],
            excluded: active_candidate.iter().map(|&active| !active).collect(),
            selected_ids: Vec::with_capacity(exact_count),
            states,
            searched_states: 0,
            state_budget: remaining_budget,
            budget_exceeded: false,
        };
        search.run(vec![0u64; full.len()]);
        searched_states += search.searched_states;
        best = search.best_selected;
        if search.budget_exceeded {
            return Some(BoundedQualityResult::BudgetExceeded(MinimumCoverResult {
                selected: best.clone(),
                quality: quality_vector(&normalized, &best, solution_count),
                searched_states,
            }));
        }
        targets.push(search.best_current);
    }

    if !threshold_data.is_empty() && locked_prefix.len() == threshold_data.len() {
        let remaining_budget = state_budget.map(|limit| limit.saturating_sub(searched_states));
        if remaining_budget == Some(0) {
            return Some(BoundedQualityResult::BudgetExceeded(MinimumCoverResult {
                selected: best.clone(),
                quality: quality_vector(&normalized, &best, solution_count),
                searched_states,
            }));
        }
        let last = threshold_data.len() - 1;
        let active_candidate =
            threshold_static_active_candidates(&primary_coverage, &threshold_data, last, true);
        let (full, mut case_candidates, solution_coverage) =
            kernelize_primary_for_candidates(&normalized, solution_count, &active_candidate)?;
        let best_flag: Vec<bool> = (0..solution_count)
            .map(|id| best.binary_search(&(id as u32)).is_ok())
            .collect();
        for candidates in &mut case_candidates {
            candidates.sort_unstable_by(|a, b| {
                best_flag[*b as usize]
                    .cmp(&best_flag[*a as usize])
                    .then(a.cmp(b))
            });
        }
        let mut states: Vec<QualityThresholdState> = threshold_data
            .iter()
            .map(|data| QualityThresholdState::new(data, solution_count))
            .collect();
        for (solution, &active) in active_candidate.iter().enumerate().take(solution_count) {
            if !active {
                for (data, state) in threshold_data.iter().zip(&mut states) {
                    state.disable_candidate(data, solution);
                }
            }
        }
        let mut search = SequentialThresholdSearch {
            full: &full,
            case_candidates: &case_candidates,
            solution_coverage: &solution_coverage,
            threshold_data: &threshold_data,
            prior_targets: &locked_prefix[..last],
            current_index: last,
            exact_count,
            stable_tie: true,
            best_current: locked_prefix[last],
            best_selected: best.clone(),
            selected_flags: vec![false; solution_count],
            excluded: active_candidate.iter().map(|&active| !active).collect(),
            selected_ids: Vec::with_capacity(exact_count),
            states,
            searched_states: 0,
            state_budget: remaining_budget,
            budget_exceeded: false,
        };
        search.run(vec![0u64; full.len()]);
        searched_states += search.searched_states;
        best = search.best_selected;
        if search.budget_exceeded {
            return Some(BoundedQualityResult::BudgetExceeded(MinimumCoverResult {
                selected: best.clone(),
                quality: quality_vector(&normalized, &best, solution_count),
                searched_states,
            }));
        }
        if search.best_current != locked_prefix[last] {
            return None;
        }
    }

    let quality = quality_vector(&normalized, &best, solution_count);
    Some(BoundedQualityResult::Exact(MinimumCoverResult {
        selected: best,
        quality,
        searched_states,
    }))
}

pub fn exact_quality_cover_at_count_bounded(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    state_budget: Option<u64>,
) -> Option<BoundedQualityResult> {
    fixed_quality_internal(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        &[],
        state_budget,
    )
}

pub fn exact_quality_cover_at_count(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
) -> Option<MinimumCoverResult> {
    match fixed_quality_internal(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        &[],
        None,
    )? {
        BoundedQualityResult::Exact(result) => Some(result),
        BoundedQualityResult::BudgetExceeded(_) => unreachable!(),
    }
}

pub fn exact_quality_cover_at_count_with_locked_prefix(
    raw_cases: &[Vec<(u32, u32)>],
    solution_count: usize,
    exact_count: usize,
    seed_selected: &[u32],
    locked_prefix: &[u32],
) -> Option<MinimumCoverResult> {
    match fixed_quality_internal(
        raw_cases,
        solution_count,
        exact_count,
        seed_selected,
        locked_prefix,
        None,
    )? {
        BoundedQualityResult::Exact(result) => Some(result),
        BoundedQualityResult::BudgetExceeded(_) => unreachable!(),
    }
}

#[cfg(test)]
#[path = "min_cover_tests.rs"]
mod tests;
