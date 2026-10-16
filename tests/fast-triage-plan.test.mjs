import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { triageCommands, triagePlan, triageTraceAudit } from '../tools/fast-triage/planner.mjs';
import { digest } from '../tools/fast-bench/planner.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';
const scope = JSON.parse(fs.readFileSync(new URL('../tools/fast-triage/SCOPE_20261017.json', import.meta.url)));
const historical = JSON.parse(fs.readFileSync(scope.sourceScope));

test('frozen E2E population retains boundaries, named failures and balanced full denominator', () => {
  assert.equal(hash(fs.readFileSync(scope.sourceScope, 'utf8').replace(/\r\n/g, '\n')), scope.sourceScopeSha256);
  const commands = triageCommands(scope, historical);
  assert.equal(commands.captures.length, 359);
  for (const id of [...scope.requiredCommandIds, ...scope.boundaryCommandIds]) assert(commands.captures.some(c => c.id === id));
  const records = commands.captures.map(command => ({ command, status: 'TIMEOUT_CALL' }));
  const plan = triagePlan(scope, commands, records);
  assert.equal(plan.schedule.length, 359 * 6 * 3 + 12 * 6 * 3 * 2);
  assert.equal(plan.scheduleHash, digest(plan.schedule));
  assert.equal(plan.selection.trace.length, 12);
  assert(plan.totalReservedSeconds / 3600 <= 1200);
  assert.equal(new Set(plan.schedule.map(c => c.callId)).size, plan.schedule.length);
  assert(plan.chunks.every(c => c.reservationSeconds <= 18000));
  assert.equal(plan.chunks.flatMap(c => c.tasks.flatMap(t => t.calls)).length, plan.schedule.length);
  for (const command of commands.captures) {
    const calls = plan.schedule.filter(c => c.commandId === command.id && c.phase === 'e2e');
    assert.equal(calls.length, 18);
    for (const arm of scope.arms) {
      const repeats = calls.filter(c => c.arm === arm);
      assert.deepEqual(repeats.map(c => c.repeat), [0, 1, 2]);
      assert.equal(new Set(repeats.map(c => c.order)).size, 3);
    }
  }
});

test('diagnostic audit compares per-filter witnesses and proof, not just outer status', () => {
  const rows = [false, 'timing', 'trace'].map(diagnostics => ({ commandId: 'x', arm: 'U192', repeat: 0,
    phase: 'trace', diagnostics, status: 'RETURNED_APPROX', outcomes: { L: { K: 1, qualityExact: false, qualityHash: 'q', keysHash: 'k' } } }));
  assert.deepEqual(triageTraceAudit(rows), []);
  rows[2].outcomes.L.qualityHash = 'wrong';
  assert.equal(triageTraceAudit(rows)[0].error, 'diagnostics changed result');
  rows[2].status = 'TIMEOUT_CALL'; // Normal censoring is not a false proof/witness failure.
  assert.deepEqual(triageTraceAudit(rows), []);
  assert.equal(triageTraceAudit(rows.slice(0, 2))[0].error, 'missing/duplicate diagnostic mode');
});
