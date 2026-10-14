import { coverageUniverse, packCoverageRows } from './pc-wasm-cover-matrix.mjs';
import { assertQualityProvider } from './quality-contract.mjs';
import { findTrivialSecondary } from './min-cover-components.mjs';

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// Experimental, explicitly invoked fixed-K portfolio. Production callers keep
// solveExactSecondary. Rust budgets count states (including repeated search),
// not milliseconds; a supervising worker/process must enforce a hard deadline.
// CP loading/model preparation belongs inside solveCpsat and its remaining time.
export async function solveSecondaryPortfolio(coverage, {
  solver, qualityFor, count, seedKeys, cardinalityProven = false,
  integratedStates, thresholdStates, totalBudgetMs, solveCpsat,
  reuseThresholdProof = false,
}) {
  const started = performance.now();
  if (!cardinalityProven) throw new Error('portfolio requires proven minimum cardinality');
  if (typeof reuseThresholdProof !== 'boolean') throw new Error('invalid proof reuse flag');
  assertQualityProvider(qualityFor);
  if (qualityFor === null) throw new Error('portfolio requires quality');
  for (const [name, value] of Object.entries({ integratedStates, thresholdStates })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid portfolio ${name}`);
  }
  if (!Number.isFinite(totalBudgetMs) || totalBudgetMs < 0) throw new Error('invalid portfolio time budget');
  if (typeof solveCpsat !== 'function') throw new Error('portfolio requires a CP-SAT adapter');
  const stages = [];
  const finish = (result, route) => ({ ...result, qualityExact: result.completed === true,
    searchedStates: stages.reduce((n, s) => n + (s.searchedStates ?? 0), 0),
    portfolio: { route, integratedStates, thresholdStates, totalBudgetMs,
      elapsedMs: performance.now() - started, stages } });
  const trivial = findTrivialSecondary(coverage, count, qualityFor);
  if (trivial) return finish(trivial, 'trivial');

  const { keys, keyIndex, rawCases } = coverageUniverse(coverage);
  const matrix = packCoverageRows(rawCases, keyIndex, qualityFor);
  if (!Number.isSafeInteger(count) || count < 0 || count > keys.length) throw new Error('invalid portfolio K');
  // Validate and retain the best feasible incumbent across unfinished stages.
  // Duplicate original rows remain separate quality entries and retain weight.
  function checked(result) {
    if (!result || typeof result.completed !== 'boolean' || result.count !== count ||
        !Array.isArray(result.keys) || result.keys.length !== count || new Set(result.keys).size !== count) {
      throw new Error('invalid portfolio fixed-K result');
    }
    const ids = result.keys.map(key => {
      if (!keyIndex.has(key)) throw new Error('portfolio result has an unknown candidate');
      return keyIndex.get(key);
    }).sort((a, b) => a - b);
    const chosen = new Set(ids), qualityVector = [];
    for (let row = 0; row < matrix.caseCount; row++) {
      let best = 0;
      for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
        if (chosen.has(matrix.ids[e])) best = Math.max(best, matrix.qualities[e]);
      }
      if (!best) throw new Error('portfolio result does not cover every original row');
      qualityVector.push(best);
    }
    qualityVector.sort((a, b) => a - b);
    if (result.qualityVector && (result.qualityVector.length !== qualityVector.length ||
        compare(result.qualityVector, qualityVector) !== 0)) throw new Error('portfolio quality mismatch');
    return { ...result, keys: ids.map(id => keys[id]), qualityVector, ids };
  }
  let best = checked({ count, keys: [...seedKeys], completed: false });
  let provenPrefix = [];
  function accept(result) {
    const candidate = checked(result);
    const quality = compare(candidate.qualityVector, best.qualityVector);
    const better = quality > 0 || (quality === 0 && compare(candidate.ids, best.ids) < 0);
    if (candidate.completed && (quality < 0 || (quality === 0 && compare(candidate.ids, best.ids) > 0))) {
      throw new Error('portfolio exact result is worse than its feasible incumbent');
    }
    if (better || candidate.completed) best = candidate;
    return candidate.completed;
  }
  function done(route) {
    const { ids, ...result } = best;
    return finish(result, route);
  }
  for (const [engine, stateBudget] of [['integrated', integratedStates], ['threshold', thresholdStates]]) {
    if (!stateBudget) continue;
    if (performance.now() - started >= totalBudgetMs) return done('budget');
    const stageStart = performance.now();
    const result = solver.minimumCoverAtCount(coverage, count, {
      qualityFor, seedKeys: [...best.keys], integrated: engine === 'integrated', stateBudget,
      ...(reuseThresholdProof && engine === 'threshold' ? { proofProgress: true } : {}),
    });
    const completed = accept(result);
    if (reuseThresholdProof && engine === 'threshold') {
      if (!Array.isArray(result.provenPrefix)) throw new Error('threshold proof metadata missing');
      const distinct = new Set();
      for (let row = 0; row < matrix.caseCount; row++) {
        const normalized = new Map();
        for (let e = matrix.offsets[row]; e < matrix.offsets[row + 1]; e++) {
          normalized.set(matrix.ids[e], Math.max(normalized.get(matrix.ids[e]) ?? 0, matrix.qualities[e]));
        }
        for (const q of normalized.values()) distinct.add(q);
      }
      const levels = [...distinct].sort((a,b)=>a-b);
      if (levels.length > 1) levels.shift();
      if (result.provenPrefix.length > levels.length) throw new Error('invalid threshold proof length');
      provenPrefix = result.provenPrefix.map((target, index) => {
        if (!Number.isSafeInteger(target) || target < 0 || target > matrix.caseCount ||
            best.qualityVector.filter(q => q >= levels[index]).length !== target) {
          throw new Error('threshold proof and incumbent disagree');
        }
        return target;
      });
    }
    stages.push({ engine, stateBudget, completed, ms: performance.now() - stageStart,
      searchedStates: result.searchedStates ?? 0,
      ...(reuseThresholdProof && engine === 'threshold' ? { provenThresholds: provenPrefix.length } : {}) });
    if (completed) return done(engine);
  }
  const remainingMs = totalBudgetMs - (performance.now() - started);
  if (remainingMs <= 0) return done('budget');
  const stageStart = performance.now();
  // Proofs can only originate from this invocation's threshold call. No option
  // accepts cached/user-provided certificates from a different matrix or K.
  const result = await solveCpsat({ coverage, count, qualityFor, seedKeys: [...best.keys], limitMs: remainingMs,
    ...(reuseThresholdProof ? { provenPrefix: [...provenPrefix] } : {}) });
  // qualityComplete alone is insufficient: the adapter must prove stable ties.
  if (result?.completed && (result.qualityComplete !== true || result.tieComplete !== true)) {
    throw new Error('CP-SAT portfolio result lacks quality or stable-tie proof');
  }
  const completed = accept(result);
  stages.push({ engine: 'cpsat', limitMs: remainingMs, completed,
    ms: performance.now() - stageStart, qualityComplete: result.qualityComplete === true,
    tieComplete: result.tieComplete === true });
  return done(completed ? 'cpsat' : 'budget');
}
