import assert from 'node:assert/strict';
import { selectedVector } from '../secondary-bench/contracts.mjs';
import { verifyTelemetry } from '../fast-triage/verify.mjs';
import { ARM_OPTIONS } from './policies.mjs';

export function verifyRoutingTelemetry(fixture, result, arm, diagnostics) {
  assert(Object.hasOwn(ARM_OPTIONS, arm));
  if (['BASE100', 'S200_OR_D16', 'U192_OR_D16'].includes(arm)) return verifyTelemetry(fixture, result, arm, diagnostics);
  const t = result.fastTelemetry;
  if (!diagnostics) { assert(!t); return; }
  if (!t) { assert(['rust-legacy-exact', 'direct-exact'].includes(result.qualityBackend)); return; }
  assert.equal(t.policy, ARM_OPTIONS[arm].fastPolicy ?? 'legacy');
  assert.equal(t.mode, diagnostics === 'trace' ? 'trace' : 'timing');
  const expected = { preview: arm === 'PREVIEW_ONLY' ? 2500 : 0,
    integrated: arm === 'I1K' ? 1000 : arm === 'I10K' ? 10000 : 0, grace: 0 };
  for (const [stage, value] of Object.entries(t.appliedBudgets)) {
    assert(value === 0 || value === expected[stage], `unexpected ${stage}: ${value}`);
  }
  if (t.selection) {
    assert.equal(t.selection.budget, expected.integrated);
    assert.equal(t.selection.S, fixture.keys.length); assert.equal(t.selection.K, fixture.K);
  }
  const ids = new Map(fixture.keys.map((key, id) => [key, id]));
  for (const s of t.stages) {
    assert(Number.isFinite(s.ms) && s.ms >= 0);
    if (s.budget !== null) { assert(expected[s.name] > 0); assert.equal(s.budget, expected[s.name]); }
    if (diagnostics === 'trace') {
      if (s.inputKeys) selectedVector(fixture, s.inputKeys.map(k => ids.get(k)));
      if (s.keys) {
        const vector = selectedVector(fixture, s.keys.map(k => ids.get(k)));
        if (s.qualityVector) assert.deepEqual(s.qualityVector, vector);
      }
    }
  }
}
