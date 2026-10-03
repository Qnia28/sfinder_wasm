import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('planner rejects parallelism17 rather than silently launching more than16 VMs', () => {
  const results = resolve('bench/threshold/results'); mkdirSync(results, { recursive: true });
  const dir = mkdtempSync(join(results, 'resource-test-')), file = join(dir, 'run.json');
  try {
    const config = JSON.parse(readFileSync(new URL('./root-screen-run.json', import.meta.url)));
    writeFileSync(file, JSON.stringify({ ...config, maxParallel: 17 }));
    const r = spawnSync(process.execPath, ['bench/threshold/workflow-plan.mjs'], { encoding: 'utf8',
      env: { ...process.env, THRESHOLD_RUN_CONFIG: file, GITHUB_EVENT_NAME: '' } });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /maxParallel.*16/);
  } finally { unlinkSync(file); rmdirSync(dir); }
});
test('cancelled screening preserves actual successes and does not invent missing timeouts', () => {
  const report = JSON.parse(readFileSync(new URL('./reports/root-screen-interrupted.json', import.meta.url)));
  assert.equal(report.conclusion, 'cancelled'); assert.equal(report.campaignComplete, false);
  assert.equal(report.activeJobsAfterCancellation, 0);
  assert.equal(report.perCase.length, 100); assert.equal(report.samples.length, 816);
  assert.equal(report.stats.exact, 621); assert.equal(report.stats.timeout, 195);
  assert.equal(report.stats.completeDataCases, 58); assert.equal(report.stats.partialDataCases, 12);
  assert.equal(report.stats.noArtifactCases, 30); assert.equal(report.stats.noExactWithTimeout.length, 18);
  assert.equal(report.perCase.reduce((s, c) => s + c.unrecordedCalls, 0), 384);
  assert(report.samples.every(s => ['EXACT', 'TIMEOUT'].includes(s.status)));
  const success = report.perCase.find(c => c.caseId === 'cycle1-pcinfo-032-Z');
  assert.equal(success.exact, 9); assert.equal(success.timeout, 0);
  assert(!report.stats.noExactWithTimeout.includes(success.caseId));
});
