import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seal } from '../tools/secondary-bench/common/evidence.mjs';
import { digest } from '../tools/fast-bench/planner.mjs';

test('continuation reuses complete censored blocks, reruns entire interrupted block and rejects product errors', async t => {
  const temp = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  const root = fs.mkdtempSync(path.join(temp, 'routing-resume-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const control = path.join(root, 'control'), planDir = path.join(control, 'plan'), shard = path.join(control, 'shards', 'summary');
  fs.mkdirSync(planDir, { recursive: true }); fs.mkdirSync(shard, { recursive: true });
  const tasks = ['complete', 'interrupted', 'unstarted'].map(id => ({ command: { id }, calls: ['BASE100', 'DIRECT'].map(arm => ({
    callId: digest([id, arm]), commandId: id, arm, phase: 'e2e', repeat: 0, diagnostics: 'timing', reservationSeconds: 140,
  })) }));
  const schedule = tasks.flatMap(t => t.calls), scheduleHash = digest(schedule);
  const plan = { study: 'fast-routing-e2e-20261017', chunks: [{ index: 0, tasks }], schedule, scheduleHash,
    lock: { runId: '39026013968', commit: 'synthetic', originUtc: new Date().toISOString(), deadlineMs: Date.now() + 3600000 } };
  fs.writeFileSync(path.join(planDir, 'PLAN.json'), JSON.stringify(plan)); await seal(planDir, { phase: 'plan' });
  const records = [...tasks[0].calls.map(c => ({ ...c, reaped: true, status: 'TIMEOUT_CALL' })),
    { ...tasks[1].calls[0], status: 'RETURNED_APPROX', reaped: true }, { ...tasks[1].calls[1], status: 'CANCELLED', reaped: true },
    ...tasks[2].calls.map(c => ({ ...c, status: 'NOT_RUN_INVALIDATED', reaped: true }))];
  const summary = { runId: '39026013968', mode: 'measure', planHash: scheduleHash, records, checkpoints: [], stopped: 'CANCELLED' };
  fs.writeFileSync(path.join(shard, 'SUMMARY.json'), JSON.stringify(summary)); await seal(shard, { shard: 0 });
  fs.writeFileSync(path.join(root, 'inventory.json'), JSON.stringify({ artifacts: [{ name: 'fast-measurement-plan', id: 1, digest: 'synthetic' }] }));
  fs.writeFileSync(path.join(root, 'run.json'), JSON.stringify({ headSha: 'synthetic', jobs: [{ name: 'measure (0)',
    startedAt: new Date(Date.now() - 1000).toISOString(), completedAt: new Date().toISOString(), steps: [{ name: 'Seven routes', conclusion: 'cancelled' }] }] }));
  const script = fileURLToPath(new URL('../tools/fast-routing/freeze-continuation.mjs', import.meta.url));
  const run = output => spawnSync(process.execPath, [script, control, path.join(root, 'inventory.json'), path.join(root, 'run.json'), output], { encoding: 'utf8' });
  const output = path.join(root, 'result'), good = run(output); assert.equal(good.status, 0, good.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'CONTINUATION_39026013968.json')));
  assert.deepEqual(manifest.retainedCommands, ['complete']);
  assert.equal(manifest.resumeCalls, 4); assert.equal(manifest.previousStartedRemeasurements, 2);
  assert.deepEqual(new Set(manifest.chunks[0].callIds), new Set(tasks.slice(1).flatMap(t => t.calls.map(c => c.callId))));
  records[2].status = 'ERROR';
  fs.unlinkSync(path.join(shard, 'SNAPSHOT.json')); fs.writeFileSync(path.join(shard, 'SUMMARY.json'), JSON.stringify(summary)); await seal(shard, { shard: 0 });
  assert.notEqual(run(path.join(root, 'invalid')).status, 0);
});
