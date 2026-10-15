import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { commandPlan, measurementPlan } from '../tools/fast-bench/planner.mjs';
import { collect } from '../tools/fast-bench/capture.mjs';
const scope = JSON.parse(fs.readFileSync(new URL('../tools/fast-bench/SCOPE_20261015_v2.json', import.meta.url)));
const commands = commandPlan(scope);
function records() {
  return commands.captures.map(c => ({ command: c, status: 'CAPTURED', inputArtifact: { id: c.captureIndex + 1 },
    result: { status: 'CAPTURED', filters: (c.kind === 'per-save' ? ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] : [c.wantedSave]).map((f, i) => ({
      id: c.id + '/' + f, filter: f, status: 'CAPTURED', member: i + '.json.gz', sha256: 'a'.repeat(64),
      primaryHard: false, features: { nontrivial: true, d: (c.captureIndex + i) % 30, u: (c.captureIndex * 3 + i) % 1000,
        previewEligible: c.population === 'regression' || (c.captureIndex + i) % 2 === 0 } })) } }));
}
test('exact command denominators and concrete edge queues', () => {
  assert.equal(commands.captures.length, 1113); assert.equal(commands.e2e.length, 273);
  const edge = commands.captures.filter(c => c.population === 'edge' && c.kind === 'per-save');
  assert.equal(edge.length, 8); assert(edge.every(c => /^[IJLOSTZ]+$/.test(c.pattern)));
  assert.equal(commands.captures.at(-1).pattern, '*p7');
});
test('single-queue per-save collector does not require minimals last-bag metadata', () => {
  const command = commands.captures.find(c => c.population === 'edge' && c.kind === 'per-save');
  let calls = 0;
  const result = collect(command, { height: 4, enumeratePc: () => { calls++; return []; } });
  assert.equal(calls, 1); assert.equal(result.cases.length, 1);
  assert.equal(result.groups.size, 7); assert([...result.groups.values()].every(g => g.coverage.size === 0));
});
test('full structural schedule keeps denominators, group caps and whole fixture repeats', () => {
  const plan = measurementPlan(scope, commands, records());
  assert.equal(plan.selection.main.length, 933);
  assert.equal(plan.selection.supplemental.length, 96);
  assert.equal(plan.selection.trace.length, 32);
  assert.equal(plan.schedule.length, 26055 + 4095 + 384);
  assert.equal(new Set(plan.schedule.map(c => c.callId)).size, plan.schedule.length);
  const counts = new Map();
  for (const f of plan.selection.main.filter(f => f.command.population === 'per-save')) counts.set(f.command.mirrorGroup, (counts.get(f.command.mirrorGroup) ?? 0) + 1);
  assert([...counts.values()].every(n => n <= 4));
  assert(plan.chunks.length <= 256); assert(plan.chunks.every(c => c.reservationSeconds <= 18000));
  const owners = new Map();
  for (const chunk of plan.chunks) for (const task of chunk.tasks) for (const call of task.calls) {
    const id = call.fixture?.id ?? task.command.id;
    if (owners.has(id)) assert.equal(owners.get(id), chunk.index); else owners.set(id, chunk.index);
  }
  assert.equal(measurementPlan(scope, commands, records().reverse()).scheduleHash, plan.scheduleHash);
});
test('capture failure removes matrices but preserves all public API slots as missing-input work', () => {
  const rows = records().map(r => ({ ...r, status: 'OOM', result: null, inputArtifact: null }));
  const plan = measurementPlan(scope, commands, rows);
  assert.equal(plan.selection.main.length, 0); assert.equal(plan.schedule.length, 4095);
});
