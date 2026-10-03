import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRootRepeat } from './review-root-repeat.mjs';
function fixture() {
  const ids = Array.from({ length: 100 }, (_, i) => `case-${i}`);
  const rows = ids.map((caseId, i) => ({ caseId, pairedComplete: i < 81 ? 5 : 0,
    pairedSpeedupMedian: i < 81 ? 1.05 : null, fasterPairs: i < 81 ? 5 : 0, slowerPairs: 0,
    offSpread: i < 81 ? 0.05 : null, onSpread: i < 81 ? 0.05 : null, ratioSpread: i < 81 ? 0.02 : null,
    sideRegression: false, pairedRegression: false, pairedDeltaMs: i < 81 ? -2 : null,
    earlyStop: i < 81 ? null : { afterPair: 1 }, leftOnlyExact: 0, rightOnlyExact: 0, memoryReview: false }));
  const report = { profile: 'root-confirm', runId: 'repeat', pairs: 5, cases: 100,
    manifestHash: 'm', wasmHashes: { experiment: 'w' }, comparisons: [{ leftMask: 16, rightMask: 20 }],
    samples: Array(886).fill({}), skippedSamples: 114, exact: 810, timeout: 76, perCase: rows };
  const screen = { manifestHash: 'm', wasmHashes: { experiment: 'w' }, perCase: ids.map((caseId, i) => ({
    caseId, comparisonIndex: 1, pairedSpeedupMedian: i < 81 ? 1.03 : null, pairedRegression: i < 4 })) };
  return { report, screen };
}
test('repeat review separates observed timeouts and unrun calls without selecting range-only noise', () => {
  const { report, screen } = fixture(); report.perCase[5].ratioSpread = 0.5;
  const r = reviewRootRepeat(report, screen);
  assert.equal(r.summary.actualCalls, 886); assert.equal(r.summary.skippedCalls, 114);
  assert.equal(r.summary.fullyPairedCases, 81); assert.equal(r.summary.earlyStoppedCases.length, 19);
  assert.equal(r.summary.initialRegressionFollowup.length, 4);
  assert.equal(r.summary.noisy, 1); assert.equal(r.summary.followup.length, 0);
});
test('follow-up flags only material repeat-consistent regression or completion/memory problems', () => {
  const { report, screen } = fixture();
  Object.assign(report.perCase[0], { pairedRegression: true, sideRegression: true, slowerPairs: 4, fasterPairs: 1, pairedSpeedupMedian: 0.8, pairedDeltaMs: 10 });
  Object.assign(report.perCase[1], { pairedRegression: true, slowerPairs: 3 });
  Object.assign(report.perCase[2], { leftOnlyExact: 1 });
  Object.assign(report.perCase[3], { memoryReview: true });
  const r = reviewRootRepeat(report, screen);
  assert.deepEqual(r.summary.followup.map(c => c.caseId), ['case-0', 'case-2', 'case-3']);
  assert(r.summary.followup[0].reasons.includes('repeat-consistent-regression'));
});
test('review blocks changed engines and inconsistent count claims', () => {
  const { report, screen } = fixture();
  assert.throws(() => reviewRootRepeat({ ...report, wasmHashes: { experiment: 'other' } }, screen));
  assert.throws(() => reviewRootRepeat({ ...report, skippedSamples: 0 }, screen));
  assert.throws(() => reviewRootRepeat({ ...report, timeout: 195 }, screen));
});
