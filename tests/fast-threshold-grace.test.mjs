import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMinimalsFeatureAsync } from '../src/features.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

const FUMEN = 'v115@9gili0DeglAtRpQ4g0DeBtRpR4DeAtzhQ4NeAgH';
const PATTERN = '*p7';

async function run(exactHumanQuality, fastStateBudget = undefined) {
  const solver = await createWasmSolver(4);
  try {
    return await calculateMinimalsFeatureAsync({
      sourceFumen: FUMEN,
      pattern: PATTERN,
      wantedSave: '',
      clear: 4,
      solver,
      useHold: true,
      exactHumanQuality,
      useHiGHS: 'auto',
      fastStateBudget,
    });
  } finally {
    solver.close();
  }
}

test('Fast bounded threshold grace upgrades GRACE *p7 to exact after integrated budget exhaustion', async () => {
  // Keep this fixture on the historical integrated->threshold path by
  // shrinking Fast enough that the 2.5k dominance preview cannot complete.
  const fast = await run('Fast', 40000);
  assert.equal(fast.minimalCount, 45);
  assert.equal(fast.cardinalityBackend, 'rust');
  assert.equal(fast.qualityBackend, 'fast-threshold-exact');
  assert.equal(fast.fastDecision, 'threshold-exact-after-integrated-budget');
  assert.equal(fast.fastProbeStates, 40000);
  assert.equal(fast.fastThresholdBudget, 4000);
  assert.ok(fast.fastThresholdStates > 0 && fast.fastThresholdStates <= 4000);
  assert.equal(fast.fastFallback, false);
  assert.equal(fast.humanQualityExact, true);

  const exact = await run(true);
  assert.equal(exact.humanQualityExact, true);
  assert.equal(exact.minimalCount, fast.minimalCount);
  assert.deepEqual(exact.coverageCounts, fast.coverageCounts);
  assert.equal(exact.fumen, fast.fumen);
});
