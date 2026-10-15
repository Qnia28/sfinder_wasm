// Fixed-K Fast experiment contract. Never relax the exact-only harness contract.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { packedView, validateFixture, selectedVector } from '../secondary-bench/contracts.mjs';
import { refineMinimumCoverQuality } from '../../src/min-cover-quality-refine.mjs';
import { isHardPrimaryKernel, primaryKernelStats } from '../../src/highs-cardinality.mjs';

export const ARMS = Object.freeze({
  BASE100: [100000, 2500, 5000], B1: [1000, 50, 100],
  B10: [10000, 500, 1000], B40: [40000, 2000, 4000],
  DIRECT: [0, 0, 0], NO_PREVIEW: [100000, 0, 5000],
  NO_GRACE: [100000, 2500, 0], I_ONLY: [100000, 0, 0],
  I10_FIXED_AUX: [10000, 2500, 5000], I1_FIXED_AUX: [1000, 2500, 5000],
  I10_NO_GRACE: [10000, 2500, 0], P_ONLY_2x2: [0, 2500, 0],
});

export function prepareFastFixture(fixture, solver) {
  validateFixture(fixture);
  const kernel = solver.primaryKernelize(fixture.rows.map(r => r.map(([id]) => id)), fixture.keys.length);
  assert(kernel, 'primary kernel ABI required');
  const stats = primaryKernelStats(kernel);
  return { fixture, ...packedView(fixture),
    prepared: { keys: fixture.keys, cases: fixture.rows },
    kernelStats: stats, primaryHard: isHardPrimaryKernel(kernel),
    previewEligible: stats.entries <= 512 && fixture.keys.length <= 256
      && fixture.keys.length * fixture.rows.length <= 1500000 };
}

// Caller owns fresh solver/process, watchdog, scope and input provenance.
// Preparation and original-row verification are outside policyMs.
export function runFastFixedK(context, solver, arm, { trace = true, signal = null } = {}) {
  assert(Object.hasOwn(ARMS, arm), 'unknown Fast arm');
  signal?.throwIfAborted();
  const { fixture: f, coverage, qualityFor, prepared, primaryHard, previewEligible } = context;
  const [integratedBudget, previewBudget, graceBudget] = ARMS[arm];
  const primaryKeys = f.seed.map(id => f.keys[id]);
  const stages = [];
  let states = 0;
  const started = performance.now();
  const probe = (stage, seedKeys, budget, integrated, dominance = false) => {
    signal?.throwIfAborted();
    const begin = performance.now();
    const r = solver.minimumCoverAtCount(coverage, f.K,
      { qualityFor, seedKeys, stateBudget: budget, integrated, dominance });
    signal?.throwIfAborted();
    assert(r && Array.isArray(r.keys), 'missing fixed-K result');
    states += r.searchedStates ?? 0;
    if (trace) stages.push({ stage, budget, inputKeys: [...seedKeys], result: r,
      wrapperCallMs: performance.now() - begin,
      rustPrepareAndSearchMs: 'UNOBSERVED' });
    return r;
  };
  const exact = r => r?.completed === true && Number.isFinite(r.count) && r.count === f.K;
  let result, decision;
  let seedKeys = primaryKeys;
  if (!primaryHard && arm !== 'DIRECT') {
    const preview = previewEligible && previewBudget
      ? probe('preview', primaryKeys, previewBudget, true, true) : null;
    if (exact(preview)) { result = preview; decision = 'dominance-preview-exact'; }
    // Incomplete preview is deliberately discarded.
    if (!result && integratedBudget) {
      const integrated = probe('integrated', primaryKeys, integratedBudget, true);
      if (exact(integrated)) { result = integrated; decision = 'integrated-exact'; }
      else if (integrated.keys.length === f.K) seedKeys = integrated.keys;
    }
    if (!result && graceBudget) {
      const grace = probe('grace', seedKeys, graceBudget, false);
      if (exact(grace)) { result = grace; decision = 'threshold-exact-after-integrated-budget'; }
      else if (grace.keys.length === f.K) seedKeys = grace.keys;
    }
  }
  const qualityExact = !!result;
  if (!result) {
    const index = new Map(f.keys.map((k, i) => [k, i]));
    const seed = seedKeys.map(k => index.get(k));
    assert(seed.every(id => id !== undefined), 'unknown incumbent');
    const begin = performance.now();
    const refined = refineMinimumCoverQuality(prepared, seed);
    result = { count: f.K, keys: refined.selected.map(id => f.keys[id]),
      qualityVector: refined.qualityVector, passes: refined.passes };
    decision = primaryHard ? 'primary-hard' : arm === 'DIRECT' ? 'explicit-2x2' : 'budget-exceeded';
    if (trace) stages.push({ stage: 'refine', inputKeys: [...seedKeys], result,
      wrapperCallMs: performance.now() - begin });
  }
  const policyMs = performance.now() - started;
  // Audit every returned incumbent, including the discarded preview, after timing.
  const index = new Map(f.keys.map((k, i) => [k, i]));
  const audit = r => {
    assert.equal(r.count, f.K);
    const vector = selectedVector(f, r.keys.map(k => index.get(k)));
    assert.deepEqual(r.qualityVector, vector, 'original-row quality mismatch');
    return vector;
  };
  for (const s of stages) s.verifiedQuality = audit(s.result);
  audit(result);
  return { ...result, arm, qualityExact, status: qualityExact ? 'RETURNED_EXACT' : 'RETURNED_APPROX',
    decision, searchedStates: states, policyMs, stages, primaryHard, previewEligible,
    kernelStats: context.kernelStats, trace };
}
