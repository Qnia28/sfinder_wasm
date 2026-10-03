import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const initial = JSON.parse(readFileSync(new URL('./reports/expanded100.json', import.meta.url)));
const retest = JSON.parse(readFileSync(new URL('./reports/retest10.json', import.meta.url)));
const review = JSON.parse(readFileSync(new URL('./reports/expanded-final-review.json', import.meta.url)));
const selection = JSON.parse(readFileSync(new URL('./retest-selection.json', import.meta.url)));
const median = values => {
  const a = [...values].sort((a, b) => a - b), at = Math.floor(a.length / 2);
  return a.length % 2 ? a[at] : (a[at - 1] + a[at]) / 2;
};
test('archived 10-pair retest uses the identical engine/manifest and matches every initial witness', () => {
  assert.equal(retest.wasmHashes.experiment, initial.wasmHashes.experiment);
  assert.equal(retest.manifestHash, initial.manifestHash);
  assert.equal(retest.samples.length, 1320);
  assert.equal(retest.perCase.length, 66);
  assert.equal(new Set(retest.samples.map(s => `${s.caseId}/${s.pair}/${s.side}`)).size, 1320);
  assert(retest.samples.every(s => s.status === 'EXACT'));
  for (const row of retest.perCase) {
    const samples = retest.samples.filter(s => s.caseId === row.caseId);
    assert.equal(samples.length, 20);
    const ratios = [];
    for (let pair = 0; pair < 10; pair++) {
      const off = samples.find(s => s.pair === pair && s.side === 'left');
      const on = samples.find(s => s.pair === pair && s.side === 'right');
      assert.equal(off.mask, 0); assert.equal(on.mask, 16);
      assert.equal(off.witnessHash, initial.witnessHashes[row.caseId]);
      assert.equal(on.witnessHash, off.witnessHash);
      ratios.push(off.nativeMs / on.nativeMs);
    }
    assert.equal(row.pairedSpeedupMedian, median(ratios));
    assert.equal(row.fasterPairs, ratios.filter(r => r > 1).length);
    assert.equal(row.leftExact, 10); assert.equal(row.rightExact, 10);
  }
});
test('final counts retain all initial100 separately from outcome-selected retest66', () => {
  assert.equal(initial.stats.matrices, 100); assert.equal(initial.stats.exact, 805);
  assert.equal(initial.stats.fasterMatrices, 57); assert.equal(initial.stats.slowerMatrices, 23);
  assert.equal(retest.stats.fasterMatrices, 45); assert.equal(retest.stats.slowerMatrices, 21);
  assert.equal(review.summary.stillNoisy, 61); assert.equal(review.summary.directionChanges.length, 19);
  assert.equal(review.summary.repeatedGains.length, 10);
  assert.deepEqual(review.rows.map(r => r.caseId).sort(), selection.cases.map(r => r.caseId).sort());
  assert.equal(review.summary.initialRegressionFollowup.length, 3);
  assert(review.summary.initialRegressionFollowup.every(r => !r.sideMedianFlag && !r.pairedRegression));
  assert.equal(review.summary.retestPairedRegressions.length, 0);
  const delta = review.rows.find(r => r.caseId === 'cycle1-big-jaws-a-S').pairedDeltaMs;
  assert(delta > 0 && delta < 5, 'minor residual slowdown must not be called absent');
});
