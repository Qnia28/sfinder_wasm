import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalsReview } from './qb-execution.mjs';
const interval = (from, to) => ({ startedAt: `2026-10-04T00:00:${String(from).padStart(2, '0')}Z`, completedAt: `2026-10-04T00:00:${String(to).padStart(2, '0')}Z` });
test('actual overlap honors simultaneous end/start boundaries and refuses more than10', () => {
  assert.equal(intervalsReview([interval(0, 2), interval(2, 4)]).maxOverlap, 1);
  assert.equal(intervalsReview([interval(0, 3), interval(2, 4)]).maxOverlap, 2);
  assert.equal(intervalsReview(Array.from({ length: 10 }, () => interval(0, 2))).maxOverlap, 10);
  assert.throws(() => intervalsReview(Array.from({ length: 11 }, () => interval(0, 2))));
  assert.equal(intervalsReview([interval(2, 2)]).zeroSecondIntervals, 1);
  assert.throws(() => intervalsReview([interval(2, 1)]));
  assert.equal(intervalsReview([]).maxOverlap, 0);
});
