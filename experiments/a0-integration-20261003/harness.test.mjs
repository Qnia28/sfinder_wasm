import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { HERE, read } from './common.mjs';
import { supervised } from './supervisor.mjs';
test('route schedule is complete, paired, balanced and smoke cannot access reserved', () => {
  const runs = read(path.join(HERE, 'SCHEDULE.json')).runs, inputs = read(path.join(HERE, 'INPUTS.json')).entries;
  assert.equal(runs.length, 960); assert.equal(new Set(runs.map(r => r.runId)).size, 960);
  assert.equal(runs.filter(r => r.phase === 'smoke').length, 128); assert.equal(runs.filter(r => r.phase === 'reserved').length, 832);
  const groups = new Map();
  for (const r of runs) { assert.equal(inputs.find(e => e.id === r.matrixId).partition === 'reserved-validation', r.phase === 'reserved'); const key = r.matrixId + r.variant; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }
  for (const a of groups.values()) { assert.equal(a.length, 4); assert.equal(new Set(a.map(r => r.shard)).size, 1); assert.equal(a.reduce((n, r) => n + r.position, 0), 6); }
});
test('synchronous API and startup hangs are killed and reaped; threshold has fresh independent time', async () => {
  const opts = { script: 'watchdog-fixture.mjs', integratedApiMs: 200, thresholdApiMs: 200, startupProcessMs: 1000, thresholdProcessMs: 1000 };
  assert.equal((await supervised(['integrated-hang'], opts)).status, 'TIMEOUT_API');
  assert.equal((await supervised(['threshold-hang'], opts)).status, 'TIMEOUT_API');
  assert.equal((await supervised(['startup-hang'], { ...opts, startupProcessMs: 200 })).status, 'TIMEOUT_PROCESS');
  assert.equal((await supervised(['two-phases'], { ...opts, integratedApiMs: 500, thresholdApiMs: 500 })).status, 'EXACT');
  assert.equal((await supervised(['ok'], opts)).status, 'EXACT');
});
