import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewRootRepeat } from './review-root-repeat.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const report = read('./reports/root-confirm.json'), screen = read('./reports/root-screen.json');
const review = read('./reports/root-repeat-review.json');
test('real repeat archive has800 exact,80 actual timeout,120 unrun calls and no invented samples', () => {
  assert.equal(report.samples.length, 880); assert.equal(report.exact, 800); assert.equal(report.timeout, 80);
  assert.equal(report.skippedSamples, 120); assert.equal(report.requestedSamples, 1000);
  assert.equal(report.perCase.length, 100); assert.equal(report.wasmHashes.experiment, screen.wasmHashes.experiment);
  assert.equal(new Set(report.samples.map(s => `${s.caseId}/${s.pair}/${s.side}`)).size, 880);
  for (const c of report.perCase) {
    const samples = report.samples.filter(s => s.caseId === c.caseId);
    if (c.earlyStop) {
      assert.equal(samples.length, 4); assert.equal(c.executedPairs, 2); assert.equal(c.skippedPairs, 3);
      assert(samples.every(s => s.status === 'TIMEOUT')); assert.equal(c.leftTimeouts, 2); assert.equal(c.rightTimeouts, 2);
    } else {
      assert.equal(samples.length, 10); assert.equal(c.pairedComplete, 5);
      assert(samples.every(s => s.status === 'EXACT'));
    }
    for (const s of samples) {
      assert.equal(s.mask, s.side === 'left' ? 16 : 20);
      if (s.status === 'EXACT') assert.equal(s.witnessHash, report.witnessHashes[c.caseId]);
      else assert.equal(s.nativeMs, undefined);
    }
  }
});
test('repeat review is reproducible and scope does not imply product integration', () => {
  const expected = reviewRootRepeat(report, screen);
  assert.deepEqual(review.summary, expected.summary); assert.deepEqual(review.rows, expected.rows);
  assert.equal(review.summary.fullyPairedCases, 80); assert.equal(review.summary.faster, 65); assert.equal(review.summary.slower, 15);
  assert.equal(review.summary.consistentFaster, 39); assert.equal(review.summary.consistentSlower, 6);
  assert.equal(review.summary.repeatedGains110.length, 15); assert.equal(review.summary.noisy, 57);
  assert.equal(review.summary.directionChanged, 23); assert.equal(review.summary.followup.length, 0);
  assert(review.summary.initialRegressionFollowup.every(c => !c.pairedRegression && !c.sideRegression));
  assert.equal(review.execution.maxSimultaneousBenchmarkSteps, 8);
  assert.equal(review.decision.classification, 'A'); assert.equal(review.decision.integrationApproval, false);
  assert.equal(review.decision.independentDatasetValidation, false);
});
test('boundary completion loss and small but repeat-consistent slowdowns are retained', () => {
  const boundary = report.perCase.find(c => c.caseId === 'cycle1-pcinfo-032-Z');
  assert(boundary.earlyStop); assert.equal(boundary.leftExact, 0); assert.equal(boundary.rightExact, 0);
  assert(screen.perCase.find(c => c.caseId === boundary.caseId && c.comparisonIndex === 1).pairedComplete === 1);
  for (const id of ['cycle1-6p-pco-a-I', 'cycle1-grace-system-a-S']) {
    const c = report.perCase.find(c => c.caseId === id);
    assert(c.pairedSpeedupMedian < 1 / 1.1); assert.equal(c.slowerPairs, 4);
    assert(c.pairedDeltaMs > 0 && c.pairedDeltaMs < 5); assert.equal(c.pairedRegression, false);
  }
  const long = report.perCase.find(c => c.caseId === 'cycle1-pcinfo-030-Z');
  assert.equal(long.slowerPairs, 4); assert(long.pairedDeltaMs > 700 && long.pairedDeltaMs < 800);
  assert(long.pairedSpeedupMedian > 0.99 && long.pairedSpeedupMedian < 1);
});
