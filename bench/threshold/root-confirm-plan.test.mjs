import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { settings } from './profiles.mjs';
test('root repeat confirmation freezes100 inputs, mask16/20, five pairs,300sec, eight concurrent shards', () => {
  const r = spawnSync(process.execPath, ['bench/threshold/workflow-plan.mjs'], { encoding: 'utf8',
    env: { ...process.env, THRESHOLD_RUN_CONFIG: 'bench/threshold/root-confirm-run.json', GITHUB_EVENT_NAME: '' } });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.equal(p.profile, 'root-confirm'); assert.equal(p.mask, 4); assert.equal(p.pairs, 5);
  assert.equal(p.seconds, 300); assert.equal(p.maxParallel, 8); assert.equal(p.jobMinutes, 65);
  assert.equal(p.matrix.case.length, 100);
  assert.deepEqual(settings(p.profile, p.mask).map(c => [c.left.mask, c.right.mask]), [[16, 20]]);
  const workflow = readFileSync(new URL('../../.github/workflows/threshold-performance.yml', import.meta.url), 'utf8');
  assert.match(workflow, /max-parallel:.*> 8 && 8/);
  const config = JSON.parse(readFileSync(new URL('./root-confirm-run.json', import.meta.url)));
  assert.equal(config.identityReport, 'reports/root-screen.json');
});
