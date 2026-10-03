import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sha256 } from './engine.mjs';
const bytes = readFileSync(new URL('./reports/root-screen-interrupted.json', import.meta.url));
const report = JSON.parse(bytes);
const selection = JSON.parse(readFileSync(new URL('./root-resume-selection.json', import.meta.url)));
test('resume selects exactly the42 incomplete cases, not slow cases or completed timeout cases', () => {
  assert.equal(selection.sourceReportHash, sha256(bytes));
  assert.equal(selection.manifestHash, report.manifestHash);
  assert.equal(selection.wasmHash, report.wasmHashes.experiment);
  assert.deepEqual(selection.cases.map(c => c.caseId), report.perCase.filter(c => c.recordedCalls < 12).map(c => c.caseId));
  assert.deepEqual(selection.reuseCompleteCases, report.perCase.filter(c => c.recordedCalls === 12).map(c => c.caseId));
  assert.equal(selection.cases.length, 42); assert.equal(selection.reuseCompleteCases.length, 58);
  assert.equal(new Set([...selection.cases.map(c => c.caseId), ...selection.reuseCompleteCases]).size, 100);
  assert(selection.cases.some(c => c.caseId === 'cycle1-pcinfo-032-Z'));
});
test('resume workflow preserves six comparisons/one pair/300sec and caps concurrency12', () => {
  const p = spawnSync(process.execPath, ['bench/threshold/workflow-plan.mjs'], { encoding: 'utf8',
    env: { ...process.env, THRESHOLD_RUN_CONFIG: 'bench/threshold/root-resume-run.json', GITHUB_EVENT_NAME: '' } });
  assert.equal(p.status, 0, p.stderr);
  const plan = JSON.parse(p.stdout);
  assert.equal(plan.profile, 'root-screen'); assert.equal(plan.mask, 4);
  assert.equal(plan.pairs, 1); assert.equal(plan.seconds, 300);
  assert.equal(plan.maxParallel, 12); assert.equal(plan.jobMinutes, 80);
  assert.deepEqual(plan.matrix.case, selection.cases.map(c => c.caseId));
});
