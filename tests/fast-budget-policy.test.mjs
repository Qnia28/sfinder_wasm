import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFastBudgets, selectFastBudget } from '../src/fast-budget-policy.mjs';
import { minimumCoverAsync, minimumCoverAdaptiveAsync } from '../src/min-cover-adaptive.mjs';
import { packFilterTask } from '../src/filter-cover-task.mjs';
import { verifyTelemetry } from '../tools/fast-triage/verify.mjs';

test('lazy bounds agree with full original-singleton rules across both boundaries', () => {
  const rules = { U192: (S, F) => S - F >= 192, U228: (S, F) => S - F >= 228,
    S200: S => S > 200, S200_OR_D16: (S, F, K) => S >= 200 || K - F >= 16,
    U192_OR_D16: (S, F, K) => S - F >= 192 || K - F >= 16,
    U228_OR_D16: (S, F, K) => S - F >= 228 || K - F >= 16 };
  for (const S of [16, 48, 118, 191, 192, 199, 200, 201, 227, 228, 257, 512]) {
    for (const K of [1, 15, 16, 17, Math.min(S, 68)]) for (let F = 0; F <= K; F++) {
      if (K > S) continue;
      const singleton = Array.from({ length: F }, (_, id) => [[id, 1]]);
      // Repeated singleton rows must not increase F. Prefix/suffix ordering tests early exits.
      for (const cases of [[...singleton, ...singleton, [[0, 1], [1, 2]]], [[[0, 1], [1, 2]], ...singleton]]) {
        for (const [fastPolicy, rule] of Object.entries(rules)) {
          const r = selectFastBudget({ keys: Array(S), cases }, K, resolveFastBudgets({ fastPolicy }));
          assert.equal(r.budget, rule(S, F, K) ? 10000 : 100000, `${fastPolicy}/${S}/${K}/${F}`);
          assert(r.forcedLowerBound <= F && F <= r.forcedUpperBound);
          assert.equal(r.F, r.featuresComplete ? F : null);
          if (!r.featuresComplete) assert.equal(r.u, null);
        }
      }
    }
  }
});

test('legacy and explicit budgets retain scaling, independent auxiliary zeros disable', () => {
  for (const [value, expected] of [[undefined, 100000], [0, 100000], [NaN, 100000], [-2, 1], [10000, 10000]]) {
    const b = resolveFastBudgets({ fastStateBudget: value, fastPolicy: 'U192' });
    assert.equal(b.integrated, expected);
    assert.equal(selectFastBudget({ keys: Array(500), cases: [] }, 1, b).budget,
      value === undefined ? 10000 : expected);
  }
  assert.equal(resolveFastBudgets({ fastStateBudget: 10000 }).preview, 500);
  assert.equal(resolveFastBudgets({ fastStateBudget: 10000 }).grace, 1000);
  assert.equal(resolveFastBudgets({ fastPolicy: 'U192' }).preview, 2500);
  assert.equal(resolveFastBudgets({ fastPolicy: 'U192' }).grace, 5000);
  assert.equal(resolveFastBudgets({ fastGraceBudget: 0 }).grace, 0);
  assert.throws(() => resolveFastBudgets({ fastPreviewBudget: -1 }));
  assert.throws(() => resolveFastBudgets({ fastPolicy: 'typo' }));
});

function matrix(S = 200) {
  const keys = Array.from({ length: S }, (_, i) => String(i).padStart(3, '0'));
  return { keys, coverage: new Map([[0, new Set(keys)]]), qualityFor: key => Number(key) + 1 };
}

test('real product orchestrator preserves seed chain and runs lazy decision after preview', async () => {
  const m = matrix(), calls = [];
  const solver = { minimumCoverAtCount(_c, K, options) {
    calls.push(options);
    const key = calls.length === 1 ? '199' : calls.length === 2 ? '100' : '150';
    return { count: K, keys: [key], qualityVector: [Number(key) + 1], completed: false, searchedStates: 1 };
  } };
  const r = await minimumCoverAsync(m.coverage, { solver, qualityFor: m.qualityFor,
    primary: 'rust', fastPolicy: 'U192', fastDiagnostics: 'trace' });
  assert.deepEqual(calls.map(c => c.stateBudget), [2500, 10000, 5000]);
  assert.deepEqual(calls[1].seedKeys, calls[0].seedKeys);
  assert.deepEqual(calls[2].seedKeys, ['100']);
  assert.deepEqual(r.fastTelemetry.stages.find(s => s.name === 'refine').inputKeys, ['150']);
  assert.equal(r.count, 1); assert.equal(r.keys.length, 1);
  assert.deepEqual(r.qualityVector, [151]);
  assert.equal(r.fastTelemetry.selection.reason, 'F<=K-bound');
  assert.deepEqual(r.fastTelemetry.appliedBudgets, { preview: 2500, integrated: 10000, grace: 5000 });
  const fixture = { keys: m.keys, K: 1, rows: [m.keys.map((_, id) => [id, id + 1])] };
  verifyTelemetry(fixture, r, 'U192', 'trace');
  const wrongBudget = structuredClone(r);
  wrongBudget.fastTelemetry.stages.find(s => s.name === 'grace').budget = 1000;
  assert.throws(() => verifyTelemetry(fixture, wrongBudget, 'U192', 'trace'), /wrong grace budget/);
  const wrongSeed = structuredClone(r);
  wrongSeed.fastTelemetry.stages.find(s => s.name === 'refine').inputKeys = ['unknown'];
  assert.throws(() => verifyTelemetry(fixture, wrongSeed, 'U192', 'trace'), /unknown selected ID/);
});

test('preview proof skips features; disabled auxiliaries and diagnostic modes keep results', async () => {
  const m = matrix();
  for (const fastDiagnostics of [false, 'timing', 'trace']) {
    const solver = { minimumCoverAtCount: (_c, count, o) => ({ count, keys: o.seedKeys,
      qualityVector: o.seedKeys.map(m.qualityFor), completed: true, searchedStates: 1 }) };
    const r = await minimumCoverAsync(m.coverage, { ...m, solver, fastPolicy: 'U228_OR_D16', fastDiagnostics });
    assert.equal(r.fastDecision, 'dominance-preview-exact');
    assert.equal(r.fastTelemetry?.selection, undefined);
    const direct = await minimumCoverAsync(m.coverage, { ...m, solver, fastPolicy: 'I10_FIXED_AUX',
      fastDiagnostics, fastPreviewBudget: 0, fastGraceBudget: 0 });
    assert.equal(direct.fastProbeBudget, 10000);
    assert.equal(direct.fastDecision, 'integrated-exact');
    assert.deepEqual(r.keys, direct.keys);
  }
});

test('tiny path and filter worker transport preserve policy contract', async () => {
  const m = matrix(3);
  const options = { fastPolicy: 'U192_OR_D16', fastPreviewBudget: 12, fastGraceBudget: 34, fastDiagnostics: 'trace' };
  assert.deepEqual(Object.fromEntries(Object.keys(options).map(k => [k, packFilterTask(m.coverage, m.qualityFor, options).options[k]])), options);
  const r = await minimumCoverAdaptiveAsync(m.coverage, { ...options, qualityFor: m.qualityFor, exactQuality: 'fast' });
  assert.equal(r.fastDecision, 'tiny-legacy-exact');
  assert.deepEqual(r.fastTelemetry.appliedBudgets, { preview: 0, integrated: 0, grace: 0 });
});
