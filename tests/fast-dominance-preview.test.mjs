import test from 'node:test';
import assert from 'node:assert/strict';
import { minimumCoverAdaptiveAsync } from '../src/highs-min-cover.mjs';

function fixture() {
  const coverage = new Map([
    ['c0', new Set(['a', 'b'])],
    ['c1', new Set(['b', 'c'])],
  ]);
  const quality = new Map([
    ['c0\0a', 9], ['c0\0b', 7],
    ['c1\0b', 8], ['c1\0c', 6],
  ]);
  return {
    coverage,
    qualityFor: (key, caseId) => quality.get(`${caseId}\0${key}`),
  };
}

test('Fast discards a timed-out dominance preview before historical integrated search', async () => {
  const { coverage, qualityFor } = fixture();
  const calls = [];
  const solver = {
    minimumCoverCardinalityIds(cases) {
      // K=1 with b as the exact primary seed.
      return { count: 1, selectedIds: [1], searchedStates: 3 };
    },
    minimumCoverAtCount(_coverage, _count, options) {
      calls.push({ ...options });
      if (options.dominance) {
        // Deliberately different timed-out incumbent. Production must ignore it.
        return { count: 1, keys: ['a'], qualityVector: [0, 0], searchedStates: 4, completed: false };
      }
      if (options.integrated) {
        return { count: 1, keys: ['b'], qualityVector: [7, 8], searchedStates: 6, completed: true };
      }
      throw new Error('threshold prover should not run after historical exact completion');
    },
  };
  const result = await minimumCoverAdaptiveAsync(coverage, {
    qualityFor,
    solver,
    useHiGHS: false,
    exactQuality: 'Fast',
    fastStateBudget: 100,
    tinyExactMaxCandidates: 0,
  });
  assert.deepEqual(result.keys, ['b']);
  assert.deepEqual(result.qualityVector, [7, 8]);
  assert.equal(result.qualityExact, true);
  assert.equal(result.fastDecision, 'integrated-exact');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].dominance, true);
  assert.equal(calls[0].stateBudget, 5);
  assert.equal(calls[1].dominance, undefined);
  assert.deepEqual(calls[1].seedKeys, ['b']);
});


test('Fast skips dominance preview when raw candidate count exceeds the safety cap', async () => {
  const candidateCount = 257;
  const keys = Array.from({ length: candidateCount }, (_, i) => `k${i}`);
  const coverage = new Map([
    ['c0', new Set(keys)],
    ['c1', new Set(keys)],
  ]);
  const calls = [];
  const solver = {
    minimumCoverAtCount(_coverage, count, options) {
      calls.push({ ...options });
      assert.equal(count, 1);
      assert.equal(options.dominance, undefined);
      assert.equal(options.integrated, true);
      return { count: 1, keys: ['k0'], qualityVector: [1, 1], searchedStates: 1, completed: true };
    },
  };
  const result = await minimumCoverAdaptiveAsync(coverage, {
    qualityFor: () => 1,
    solver,
    useHiGHS: false,
    exactQuality: 'Fast',
    tinyExactMaxCandidates: 0,
  });
  assert.deepEqual(result.keys, ['k0']);
  assert.equal(result.fastDecision, 'integrated-exact');
  assert.equal(result.fastDominancePreviewBudget, null);
  assert.equal(result.fastDominancePreviewStates, 0);
  assert.equal(calls.length, 1);
});


import { calculateMinimalsFeatureAsync } from '../src/features.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

const GRACE_FUMEN = 'v115@9gili0DeglAtRpQ4g0DeBtRpR4DeAtzhQ4NeAgH';

test('default Fast GRACE *p7 completes in the exact dominance preview', async () => {
  const solver = await createWasmSolver(4);
  try {
    const fast = await calculateMinimalsFeatureAsync({
      sourceFumen: GRACE_FUMEN,
      pattern: '*p7',
      wantedSave: '',
      clear: 4,
      solver,
      useHold: true,
      exactHumanQuality: 'Fast',
      useHiGHS: 'auto',
    });
    assert.equal(fast.minimalCount, 45);
    assert.equal(fast.qualityBackend, 'fast-dominance-exact');
    assert.equal(fast.fastDecision, 'dominance-preview-exact');
    assert.equal(fast.fastDominancePreviewBudget, 2500);
    assert.ok(fast.fastDominancePreviewStates > 0 && fast.fastDominancePreviewStates <= 2500);
    assert.equal(fast.fastProbeStates, 0);
    assert.equal(fast.fastFallback, false);
    assert.equal(fast.humanQualityExact, true);
  } finally {
    solver.close();
  }
});
