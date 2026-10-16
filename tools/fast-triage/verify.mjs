// Independent, untimed verification against complete captured original rows.
import assert from 'node:assert/strict';
import { selectedVector } from '../secondary-bench/contracts.mjs';

export function expectedBudget(arm, { S, F }, K) {
  if (arm === 'BASE100') return 100000;
  if (arm === 'I10_FIXED_AUX') return 10000;
  if (arm === 'U192') return S - F >= 192 ? 10000 : 100000;
  if (arm === 'U228_OR_D16') return S - F >= 228 || K - F >= 16 ? 10000 : 100000;
  if (arm === 'U192_OR_D16') return S - F >= 192 || K - F >= 16 ? 10000 : 100000;
  if (arm === 'S200_OR_D16') return S >= 200 || K - F >= 16 ? 10000 : 100000;
  throw new Error('unknown triage arm: ' + arm);
}

export function verifyTelemetry(fixture, result, arm, diagnostics) {
  const t = result.fastTelemetry;
  if (!diagnostics) { assert(!t); return; }
  if (!t) {
    assert(['rust-legacy-exact', 'direct-exact'].includes(result.qualityBackend), 'missing product telemetry');
    return; // Public compact tiny / single-queue bypass; no bounded stages were called.
  }
  assert.equal(t.policy, arm === 'BASE100' ? 'legacy' : arm);
  assert.equal(t.mode, diagnostics === 'trace' ? 'trace' : 'timing');
  const F = new Set(fixture.rows.filter(r => r.length === 1).map(r => r[0][0])).size;
  const features = { S: fixture.keys.length, F };
  if (t.appliedBudgets.integrated > 0) assert(t.selection, 'integrated stage missing policy evidence');
  if (t.selection) {
    assert.equal(t.selection.S, features.S); assert.equal(t.selection.K, fixture.K);
    assert.equal(t.selection.budget, expectedBudget(arm, features, fixture.K));
    assert(t.selection.forcedLowerBound <= F && t.selection.forcedUpperBound >= F);
    if (t.selection.featuresComplete) assert.equal(t.selection.F, F);
    else for (const key of ['F', 'u', 'd']) assert.equal(t.selection[key], null);
  }
  for (const stage of t.stages) {
    assert(Number.isFinite(stage.ms) && stage.ms >= 0);
    if (stage.budget !== null) {
      const expected = stage.name === 'preview' ? 2500 : stage.name === 'grace' ? 5000 : expectedBudget(arm, features, fixture.K);
      assert.equal(stage.budget, expected, `wrong ${stage.name} budget`);
      assert.equal(t.appliedBudgets[stage.name], expected);
    }
    if (diagnostics === 'trace') {
      const index = new Map(fixture.keys.map((key, id) => [key, id]));
      if (stage.inputKeys) selectedVector(fixture, stage.inputKeys.map(k => index.get(k)));
      if (stage.keys) {
        const vector = selectedVector(fixture, stage.keys.map(k => index.get(k)));
        if (stage.qualityVector) assert.deepEqual(vector, stage.qualityVector, `invalid ${stage.name} quality`);
      }
    }
  }
  if (result.fastDecision === 'dominance-preview-exact' || result.fastDecision === 'primary-hard') assert(!t.selection);
}
