import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { refinePlan } from '../tools/fast-refine/plan.mjs';
const scope = JSON.parse(fs.readFileSync(new URL('../tools/fast-refine/SCOPE_20261017.json', import.meta.url)));
const historical = JSON.parse(fs.readFileSync(new URL('../tools/fast-bench/SCOPE_20261015_v2.json', import.meta.url)));

test('refine screen pairs only the implementation change under three policies', () => {
  const plan = refinePlan(scope, historical);
  assert.equal(plan.tasks.length, 16); assert.equal(plan.expectedE2E, 480);
  assert.equal(plan.maxReplayCalls, 224);
  assert(plan.totalReservedHours < 48);
  assert.equal(new Set(plan.tasks.flatMap(t => t.calls.map(c => c.callId))).size, 480);
  for (let shard = 0; shard < 8; shard++) assert.equal(plan.tasks.filter(t => t.shard === shard).length, 2);
  for (const task of plan.tasks) for (let repeat = 0; repeat < 5; repeat++) {
    const calls = task.calls.filter(c => c.repeat === repeat);
    assert.equal(calls.length, 6);
    for (const policy of scope.policies) assert.deepEqual(new Set(calls.filter(c => c.policy === policy).map(c => c.implementation)), new Set(['reference', 'candidate']));
  }
  assert(plan.tasks.some(t => t.command.id === 'cycle1-pcinfo-030/all/restricted-split/per-save'));
  assert.equal(refinePlan(scope, historical).scheduleHash, plan.scheduleHash);
});

test('unknown input or exhausted reservation prevents a new plan', () => {
  assert.throws(() => refinePlan({ ...scope, commandIds: ['absent', ...scope.commandIds.slice(1)] }, historical), /unknown command/);
  assert.throws(() => refinePlan({ ...scope, maxRunnerHours: 1 }, historical));
});
