import { coverageUniverse, packCoverageRows } from './pc-wasm-cover-matrix.mjs';
import { createNumericCoverage, numericPacked, registerNumericCoverage } from './numeric-cover-data.mjs';
import { assertQualityProvider } from './quality-contract.mjs';

function selectedQuality(matrix, selected) {
  const qualityVector = [];
  for (let row = 0; row < matrix.caseCount; row++) {
    let best = 0;
    for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
      if (selected.has(matrix.ids[e])) best = Math.max(best, matrix.qualities[e]);
    }
    if (!best) throw new Error('secondary selection does not cover every original row');
    qualityVector.push(best);
  }
  return qualityVector.sort((a, b) => a - b);
}

// Only original singleton rows certify mandatory candidates. A primary kernel
// can acquire singleton rows after dominance, which is not this proof.
export function findTrivialSecondary(coverage, count, qualityFor) {
  return inspectTrivialSecondary(coverage, count, qualityFor).result;
}

// Reuse the original-singleton scan for cheap routing diagnostics. This is not
// a routing rule or a reduced secondary matrix: every quality row remains live.
// Summaries contain owned scalars only; never cache them against mutable input.
export function inspectTrivialSecondary(coverage, count, qualityFor) {
  assertQualityProvider(qualityFor);
  if (qualityFor === null) throw new Error('exact secondary requires a quality provider');
  const universe = coverageUniverse(coverage);
  const { keys, keyIndex, rawCases } = universe;
  if (!Number.isInteger(count) || count < 0 || count > keys.length) return { result: null, structure: null };
  const packed = numericPacked(rawCases);
  let entryCount = packed?.entryCount ?? null;
  const summarize = forcedCount => Object.freeze({
    candidateCount: keys.length, count, rowCount: rawCases.length, entryCount,
    forcedCount,
    unforcedSlots: forcedCount === null ? null : count - forcedCount,
    unforcedCandidates: forcedCount === null ? null : keys.length - forcedCount,
  });
  if (!rawCases.length) return {
    result: count === 0
      ? { count: 0, keys: [], qualityVector: [], searchedStates: 0, completed: true, secondaryTrivial: 'empty' }
      : null,
    structure: Object.freeze({ ...summarize(0), entryCount: 0 }),
  };
  let selected;
  let reason;
  let forcedCount = null;
  if (count === keys.length) {
    selected = new Set(keys.map((_, id) => id));
    reason = 'all-candidates';
  } else {
    selected = new Set();
    if (!packed) entryCount = 0;
    for (let row = 0; row < rawCases.length; row++) {
      if (packed) {
        const start = packed.offsets[row], end = packed.offsets[row + 1];
        if (start === end) return { result: null, structure: null };
        const first = packed.ids[start];
        let singleton = true;
        for (let e = start + 1; e < end; e++) {
          if (packed.ids[e] !== first) { singleton = false; break; }
        }
        if (singleton) selected.add(first);
      } else {
        entryCount += rawCases[row].row.length;
        if (rawCases[row].row.length === 1) selected.add(keyIndex.get(rawCases[row].row[0]));
      }
    }
    forcedCount = selected.size;
    if (selected.size !== count) return { result: null, structure: summarize(forcedCount) };
    reason = 'original-singletons';
  }
  const matrix = packed ?? packCoverageRows(rawCases, keyIndex, qualityFor);
  entryCount = matrix.entryCount;
  // |F| == K alone is insufficient without a feasible seed / coverage check.
  for (let row = 0; row < matrix.caseCount; row++) {
    let covered = false;
    for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
      if (selected.has(matrix.ids[e])) { covered = true; break; }
    }
    if (!covered) return { result: null, structure: summarize(forcedCount) };
  }
  // The all-candidates shortcut did not inspect singletons. Report unknown F,
  // rather than claiming every selected candidate was forced by an original row.
  return { result: { count, keys: [...selected].sort((a, b) => a - b).map(id => keys[id]),
    qualityVector: selectedQuality(matrix, selected), searchedStates: 0,
    completed: true, secondaryTrivial: reason }, structure: summarize(forcedCount) };
}

// Analyze the ORIGINAL quality graph, never the reduced primary coverage graph.
// Structural analysis retains indices only; component matrices are built lazily.
export function analyzeSecondaryComponents(coverage, qualityFor) {
  return analyzeOriginalGraph(coverage, qualityFor, false);
}

// Routing only needs topology. Do not construct per-component arrays or pack
// qualities on this path; all original rows (including redundant rows) still
// contribute edges. The result owns no input references or reusable proofs.
export function summarizeSecondaryComponents(coverage, qualityFor) {
  return analyzeOriginalGraph(coverage, qualityFor, true);
}

function analyzeOriginalGraph(coverage, qualityFor, summaryOnly) {
  assertQualityProvider(qualityFor);
  if (qualityFor === null) throw new Error('exact secondary requires a quality provider');
  const universe = coverageUniverse(coverage);
  const matrix = packCoverageRows(universe.rawCases, universe.keyIndex, summaryOnly ? null : qualityFor);
  const parent = Int32Array.from({ length: universe.keys.length }, (_, id) => id);
  const size = new Uint32Array(parent.length).fill(1);
  const active = new Uint8Array(parent.length);
  function find(id) {
    while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; }
    return id;
  }
  function join(a, b) {
    a = find(a); b = find(b);
    if (a === b) return;
    if (size[a] < size[b]) [a, b] = [b, a];
    parent[b] = a; size[a] += size[b];
  }
  for (let row = 0; row < matrix.caseCount; row++) {
    const start = matrix.offsets[row], end = matrix.offsets[row + 1];
    if (start === end) throw new Error('empty original secondary row');
    for (let e = start; e < end; e++) {
      const id = matrix.ids[e]; active[id] = 1; join(matrix.ids[start], id);
    }
  }
  if (summaryOnly) {
    let componentCount = 0, largestComponent = 0;
    for (let id = 0; id < parent.length; id++) {
      if (active[id] && parent[id] === id) {
        componentCount++;
        largestComponent = Math.max(largestComponent, size[id]);
      }
    }
    return { componentCount, largestComponent };
  }
  const byRoot = new Map();
  for (let id = 0; id < parent.length; id++) {
    if (!active[id]) continue;
    const root = find(id);
    if (!byRoot.has(root)) byRoot.set(root, { ids: [], rows: [], entries: 0 });
    byRoot.get(root).ids.push(id);
  }
  for (let row = 0; row < matrix.caseCount; row++) {
    const group = byRoot.get(find(matrix.ids[matrix.offsets[row]]));
    group.rows.push(row);
    group.entries += matrix.offsets[row + 1] - matrix.offsets[row];
  }
  return { universe, matrix, components: [...byRoot.values()] };
}

// Own the matrix once so a caller's later mutation cannot invalidate a cached
// proof. Proofs stay inside this session; they are never imported from a result
// object, another filter or another worker.
function snapshotCoverage(coverage, qualityFor) {
  const original = coverageUniverse(coverage);
  const packed = packCoverageRows(original.rawCases, original.keyIndex, qualityFor);
  const keys = [...original.keys];
  const rawCases = original.rawCases.map(({ caseId }) => ({ caseId }));
  const prepared = { keys, keyIndex: new Map(keys.map((key, id) => [key, id])), rawCases, primaryCases: [] };
  const owned = { size: rawCases.length };
  registerNumericCoverage(owned, prepared, { caseCount: packed.caseCount, entryCount: packed.entryCount,
    offsets: packed.offsets.slice(), ids: packed.ids.slice(), qualities: packed.qualities.slice() });
  return owned;
}

function validateRun(engine, stateBudget) {
  if (!['integrated', 'threshold'].includes(engine)) throw new Error('invalid secondary engine');
  if (stateBudget !== null && (!Number.isSafeInteger(stateBudget) || stateBudget < 0)) {
    throw new Error('secondary state budget must be a nonnegative safe integer');
  }
}

// The caller must have proved minimum K, not an arbitrary fixed count. Reuse
// includes immutable matrices, feasible seeds and whole-component exact proofs.
// An unfinished DFS / threshold prefix is not claimed to be resumable here.
export function createSecondarySession(coverage, {
  qualityFor, count, seedKeys, cardinalityProven = false, decomposition = 'off',
}) {
  if (!cardinalityProven) throw new Error('component secondary requires proven minimum cardinality');
  if (!['off', 'on', 'auto'].includes(decomposition)) throw new Error('invalid secondary decomposition mode');
  const trivial = findTrivialSecondary(coverage, count, qualityFor);
  if (trivial) return { run({ engine = 'integrated', stateBudget = null } = {}) {
    validateRun(engine, stateBudget);
    return { ...trivial, keys: [...trivial.keys], qualityVector: [...trivial.qualityVector],
      componentCount: 0, solvedComponents: 0, preparedComponents: 0, reusedComponents: 0 };
  } };
  coverage = snapshotCoverage(coverage, qualityFor);
  // The control path must not pay for a graph analysis it never uses. Otherwise
  // off/on timings would hide the real cost of deciding to split a problem.
  let universe, matrix, components;
  if (decomposition === 'on') {
    ({ universe, matrix, components } = analyzeSecondaryComponents(coverage, qualityFor));
  } else {
    universe = coverageUniverse(coverage);
    matrix = packCoverageRows(universe.rawCases, universe.keyIndex, qualityFor);
  }
  const { keys, keyIndex } = universe;
  const seed = new Set(seedKeys.map(key => {
    if (!keyIndex.has(key)) throw new Error('secondary seed contains an inactive candidate');
    return keyIndex.get(key);
  }));
  if (seed.size !== count || seedKeys.length !== count) throw new Error('invalid minimum-K secondary seed');
  selectedQuality(matrix, seed); // Validate feasibility before using local K.
  const groups = components ?? [{
    ids: keys.map((_, id) => id), rows: Array.from({ length: matrix.caseCount }, (_, row) => row),
  }];
  const selected = new Set(seed);
  for (const group of groups) {
    group.seedKeys = group.ids.filter(id => seed.has(id)).map(id => keys[id]);
    group.members = new Set(group.ids);
    group.completed = false;
    group.view = null;
  }
  function prepare(group) {
    if (group.view) return group.view;
    if (groups.length === 1) group.view = { coverage };
    else {
      const rows = new Map();
      // Retain original duplicate rows: each contributes to the quality vector.
      for (let ri = 0; ri < group.rows.length; ri++) {
        const row = group.rows[ri], entries = [];
        for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
          entries.push([matrix.ids[e], matrix.qualities[e]]);
        }
        rows.set(ri, entries);
      }
      group.view = createNumericCoverage(keys, rows, group.rows.map(row => ({ caseId: universe.rawCases[row].caseId })));
    }
    return group.view;
  }
  let exactQuality = null;
  return { run({ solver, engine = 'integrated', stateBudget = null } = {}) {
    validateRun(engine, stateBudget);
    let searchedStates = 0, solvedComponents = 0, reusedComponents = 0;
    const componentStats = [];
    for (const group of groups) {
      const localSeed = group.seedKeys;
      if (group.completed) {
        solvedComponents++; reusedComponents++;
        componentStats.push({ candidates: group.ids.length, count: localSeed.length,
          completed: true, searchedStates: 0, reusedProof: true, trivial: group.trivial ?? null });
        continue;
      }
      const view = prepare(group);
      let result = findTrivialSecondary(view.coverage, localSeed.length, qualityFor);
      if (!result) {
        const remaining = stateBudget === null ? null : Math.max(0, stateBudget - searchedStates);
        if (remaining === 0) {
          componentStats.push({ candidates: group.ids.length, count: localSeed.length, completed: false, searchedStates: 0 });
          continue; // Still allow later trivial components to finish for free.
        }
        result = solver?.minimumCoverAtCount?.(view.coverage, localSeed.length, {
          qualityFor, seedKeys: localSeed, integrated: engine === 'integrated', stateBudget: remaining,
        });
        if (!result || result.count !== localSeed.length || result.keys.length !== localSeed.length) {
          throw new Error('component fixed-count secondary failed');
        }
      }
      const resultIds = new Set(result.keys.map(key => keyIndex.get(key)));
      if (resultIds.size !== localSeed.length || [...resultIds].some(id => !group.members.has(id))) {
        throw new Error('invalid component secondary selection');
      }
      // Validate before committing a proof or changing the session incumbent.
      for (const row of group.rows) {
        let covered = false;
        for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
          if (resultIds.has(matrix.ids[e])) { covered = true; break; }
        }
        if (!covered) throw new Error('invalid component secondary coverage');
      }
      for (const id of group.ids) selected.delete(id);
      for (const id of resultIds) selected.add(id);
      group.seedKeys = [...result.keys];
      group.completed = result.completed === true;
      group.trivial = result.secondaryTrivial;
      searchedStates += result.searchedStates ?? 0;
      if (group.completed) solvedComponents++;
      componentStats.push({ candidates: group.ids.length, count: localSeed.length,
        completed: group.completed, searchedStates: result.searchedStates ?? 0,
        trivial: result.secondaryTrivial ?? null });
    }
    const completed = solvedComponents === groups.length;
    const qualityVector = exactQuality ? [...exactQuality] : selectedQuality(matrix, selected);
    if (completed && !exactQuality) exactQuality = [...qualityVector];
    return { count, keys: [...selected].sort((a, b) => a - b).map(id => keys[id]),
      qualityVector, searchedStates, completed, componentCount: components?.length ?? null,
      solvedComponents, componentStats, preparedComponents: groups.filter(group => group.view).length,
      reusedComponents };
  } };
}

// One-shot experiment API. Keep the session explicitly when switching engines.
export function solveStructuredSecondary(coverage, options) {
  validateRun(options.engine ?? 'integrated', options.stateBudget ?? null);
  return createSecondarySession(coverage, options).run(options);
}
