import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sha256 } from './engine.mjs';
const reportBytes = readFileSync(new URL('./reports/expanded100.json', import.meta.url));
const report = JSON.parse(reportBytes);
const selection = JSON.parse(readFileSync(new URL('./retest-selection.json', import.meta.url)));

test('retest selection is exactly the frozen percentile/spread union without timeout substitution', () => {
  assert.equal(selection.sourceReportHash, sha256(reportBytes));
  assert.equal(selection.cases.length, 66);
  assert.equal(selection.pairs, 10); assert.equal(selection.timeoutSeconds, 300);
  const spread = values => {
    if (values.length < 2) return null;
    const a = [...values].sort((a, b) => a - b);
    const median = a.length % 2 ? a[Math.floor(a.length / 2)] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
    return (a.at(-1) - a[0]) / median;
  };
  const ids = [];
  for (const c of report.perCase) {
    const samples = report.samples.filter(s => s.caseId === c.caseId);
    const off = spread(samples.filter(s => s.side === 'left' && s.status === 'EXACT').map(s => s.nativeMs));
    const on = spread(samples.filter(s => s.side === 'right' && s.status === 'EXACT').map(s => s.nativeMs));
    const ratio = spread(c.paired.filter(p => p.speedup !== null).map(p => p.speedup));
    if ((c.pairedComplete === 5 && (c.pairedSpeedupMedian >= selection.cutoff.p90Speedup
      || c.pairedSpeedupMedian <= selection.cutoff.p10Speedup)) || [off, on, ratio].some(s => s !== null && s >= 0.1)) ids.push(c.caseId);
  }
  assert.deepEqual([...ids].sort(), selection.cases.map(c => c.caseId).sort());
  assert.equal(selection.cases.filter(c => c.reasons.includes('p90-fast')).length, 8);
  assert.equal(selection.cases.filter(c => c.reasons.includes('p90-slow')).length, 8);
  assert(report.stats.regressionReview.every(id => ids.includes(id)));
});
test('retest workflow keeps 66 input jobs, ten serial pairs, 300 second calls and enough job time', () => {
  const r = spawnSync(process.execPath, ['bench/threshold/workflow-plan.mjs'], { encoding: 'utf8',
    env: { ...process.env, THRESHOLD_RUN_CONFIG: 'bench/threshold/retest-run.json', GITHUB_EVENT_NAME: '' } });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.deepEqual(p.matrix.case, selection.cases.map(c => c.caseId));
  assert.equal(p.pairs, 10); assert.equal(p.seconds, 300); assert.equal(p.maxParallel, 20);
  assert.equal(p.jobMinutes, 115);
});
