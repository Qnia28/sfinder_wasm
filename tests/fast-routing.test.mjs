import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { minimumCoverAsync } from '../src/min-cover-adaptive.mjs';
import { resolveFastBudgets, selectFastBudget } from '../src/fast-budget-policy.mjs';
import { ARM_OPTIONS } from '../tools/fast-routing/policies.mjs';
import { verifyRoutingTelemetry } from '../tools/fast-routing/verify.mjs';
import { routingCommands, routingPlan, routingDiagnosticAudit } from '../tools/fast-routing/planner.mjs';

test('direct and preview-only use actual API, discard preview incumbent, preserve integrated seed', async () => {
  const keys = Array.from({ length: 200 }, (_, i) => String(i).padStart(3, '0'));
  const coverage = new Map([[0, new Set(keys)]]), qualityFor = key => Number(key) + 1;
  const fixture = { keys, K: 1, rows: [keys.map((_, i) => [i, i + 1])] };
  for (const [arm, expected] of Object.entries({ DIRECT: [], PREVIEW_ONLY: [2500], I1K: [1000], I10K: [10000], BASE100: [2500, 100000, 5000] })) {
    const calls = [], solver = { minimumCoverAtCount(_c, count, options) {
      calls.push(options); return { count, keys: ['150'], qualityVector: [151], completed: false, searchedStates: 1 };
    } };
    const r = await minimumCoverAsync(coverage, { solver, qualityFor, primary: 'rust', ...ARM_OPTIONS[arm], fastDiagnostics: 'trace' });
    assert.deepEqual(calls.map(c => c.stateBudget), expected, arm);
    assert.equal(r.count, 1); verifyRoutingTelemetry(fixture, r, arm, 'trace');
    const t = r.fastTelemetry, primary = t.stages.find(s => s.name === 'primary'), refine = t.stages.find(s => s.name === 'refine');
    assert.equal(refine.passes, 0);
    assert.deepEqual(refine.inputKeys, ['DIRECT', 'PREVIEW_ONLY'].includes(arm) ? primary.keys : ['150']);
    if (arm === 'PREVIEW_ONLY') assert.equal(r.fastDecision, 'preview-only-2x2');
    if (arm === 'DIRECT') assert.equal(r.fastDecision, 'direct-2x2');
    const bad = structuredClone(r); bad.fastTelemetry.appliedBudgets.grace = 1;
    if (arm !== 'BASE100') assert.throws(() => verifyRoutingTelemetry(fixture, bad, arm, 'trace'));
  }
  const exact = await minimumCoverAsync(coverage, { qualityFor, primary: 'rust', fastPolicy: 'PREVIEW_ONLY',
    solver: { minimumCoverAtCount(_c, count, options) { assert(options.dominance); return { count, keys: ['199'], qualityVector: [200], completed: true }; } } });
  assert.equal(exact.fastDecision, 'dominance-preview-exact');
});

test('new routes preserve explicit-budget precedence including zero-to-100K legacy behavior', () => {
  for (const policy of ['DIRECT_2X2', 'PREVIEW_ONLY']) {
    const defaultBudget = resolveFastBudgets({ fastPolicy: policy });
    assert.equal(defaultBudget.integrated, 0); assert.equal(defaultBudget.grace, 0);
    for (const fastStateBudget of [0, 1000]) {
      const b = resolveFastBudgets({ fastPolicy: policy, fastStateBudget });
      assert.equal(selectFastBudget({ keys: [], cases: [] }, 0, b).budget, fastStateBudget || 100000);
    }
  }
});

test('full-population schedule retains every arm and missing capture, bounded reservations and separate phases', () => {
  const scope = JSON.parse(fs.readFileSync(new URL('../tools/fast-routing/SCOPE_20261017.json', import.meta.url)));
  const historical = JSON.parse(fs.readFileSync(new URL('../tools/fast-bench/SCOPE_20261015_v2.json', import.meta.url)));
  const commands = routingCommands(scope, historical);
  const records = commands.captures.map(command => ({ command, status: 'TIMEOUT_CALL', result: null, inputArtifact: null }));
  const plan = routingPlan(scope, commands, records);
  assert.equal(commands.captures.length, 1113);
  assert.equal(plan.schedule.filter(c => c.phase === 'e2e').length, 23373);
  assert.equal(plan.schedule.filter(c => c.phase === 'long-repeat').length, 364);
  assert.equal(plan.schedule.filter(c => c.phase === 'trace').length, 1344);
  assert.equal(new Set(plan.schedule.map(c => c.callId)).size, 25081);
  assert(plan.totalReservedSeconds <= 1200 * 3600);
  assert(plan.chunks.length <= 256);
  for (const task of plan.chunks.flatMap(c => c.tasks)) {
    assert.equal(new Set(task.calls.map(c => c.reservationSeconds)).size, 1);
    for (let r = 0; r < 3; r++) assert.equal(new Set(task.calls.filter(c => c.phase === 'e2e' && c.repeat === r).map(c => c.arm)).size, 7);
  }
  assert.equal(routingPlan(scope, commands, records).scheduleHash, plan.scheduleHash);
});

test('diagnostic variation is an observation, missing/duplicate evidence is invalid', () => {
  const rows = [false, 'timing', 'trace'].map((diagnostics, i) => ({ phase: 'trace', diagnostics,
    commandId: 'tiny', arm: 'DIRECT', repeat: 0, callId: String(i), status: 'RETURNED_APPROX',
    outcomes: { ALL: { K: 1, qualityHash: String(i), keysHash: String(i) } } }));
  const report = routingDiagnosticAudit(rows);
  assert.equal(report.anomalies.length, 0); assert.equal(report.variations.length, 1);
  assert.equal(routingDiagnosticAudit(rows.slice(0, 2)).anomalies.length, 1);
});
