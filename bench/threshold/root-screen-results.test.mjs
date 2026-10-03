import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeRootScreening } from './merge-root-screening.mjs';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const retained = read('./reports/root-retained.json'), resumed = read('./reports/root-resumed.json');
const selection = read('./root-resume-selection.json'), report = read('./reports/root-screen.json');
test('real composite report matches old58 plus new42 without any old partial sample', () => {
  const expected = mergeRootScreening(retained, resumed, selection);
  for (const key of ['samples', 'perCase', 'comparisons', 'witnessHashes', 'diagnostics']) {
    assert.deepEqual(report[key], expected[key]);
  }
  assert.equal(report.samples.length, 1200); assert.equal(report.exact, 964); assert.equal(report.timeout, 236);
  assert.equal(retained.exact, 612); assert.equal(resumed.exact, 352);
  assert.equal(report.omittedOldPartialCalls, 120); assert.equal(report.campaignComplete, true);
  assert.equal(report.execution.runs[1].maxSimultaneousBenchmarkSteps, 12);
  assert.equal(report.execution.runs[1].conclusion, 'success');
});
test('all recorded pairs independently reproduce ratios, regression alerts and completion counts', () => {
  for (const c of report.perCase) {
    const raw = report.samples.filter(s => s.caseId === c.caseId && s.comparisonIndex === c.comparisonIndex);
    assert.equal(raw.length, 2);
    const left = raw.find(s => s.side === 'left'), right = raw.find(s => s.side === 'right');
    assert.equal(left.mask, c.left.mask); assert.equal(right.mask, c.right.mask);
    assert.equal(left.sourceRunId, right.sourceRunId);
    const complete = left.status === 'EXACT' && right.status === 'EXACT';
    assert.equal(c.pairedComplete, complete ? 1 : 0);
    assert.equal(c.pairedSpeedupMedian, complete ? left.nativeMs / right.nativeMs : null);
    assert.equal(c.pairedRegression, complete && left.nativeMs / right.nativeMs <= 1 / 1.1 && right.nativeMs - left.nativeMs >= 5);
    for (const s of raw) if (s.status === 'EXACT') assert.equal(s.witnessHash, report.witnessHashes[c.caseId]);
    else assert.equal(s.nativeMs, undefined);
  }
  assert.deepEqual(report.comparisons.map(c => c.pairedCompleteMatrices), [80, 81, 80, 80, 80, 81]);
  assert.deepEqual(report.comparisons.map(c => c.faster), [62, 54, 36, 44, 28, 62]);
  assert.deepEqual(report.comparisons.map(c => c.pairedRegressions.length), [3, 4, 14, 7, 16, 6]);
  assert(report.comparisons.every(c => !c.exactToTimeout.length && !c.onOnlyPairs && !c.memoryAlerts.length));
});
test('bounded diagnostics have identical root-refinement traversal and report only common-complete work', () => {
  assert.equal(report.diagnostics.length, 100);
  for (const d of report.diagnostics) {
    assert.equal(d.stateBudget, 1000);
    for (const [a, b] of [[4, 36], [4, 68], [4, 100], [20, 116]]) {
      const old = d.results.find(r => r.mask === a), refined = d.results.find(r => r.mask === b);
      for (const key of ['completed', 'count', 'searchedStates', 'provenPrefix', 'witnessHash']) {
        assert.deepEqual(old[key], refined[key]);
      }
      assert.equal(old.diagnostics.dfsEntries, refined.diagnostics.dfsEntries);
    }
  }
  const complete = report.diagnostics.filter(d => d.results.every(r => r.completed));
  assert.equal(complete.length, 36); assert.equal(report.traceWork.commonCompleteCases, 36);
  for (const sum of report.traceWork.sums) {
    const results = complete.map(d => d.results.find(r => r.mask === sum.mask));
    assert.equal(sum.dfsEntries, results.reduce((s, r) => s + r.diagnostics.dfsEntries, 0));
    assert.equal(sum.qualityGroupUpdates, results.reduce((s, r) => s + r.diagnostics.qualityGroupUpdates, 0));
  }
});
