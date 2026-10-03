import test from 'node:test';
import assert from 'node:assert/strict';
import { timeoutStopReason, repetitionProgress, auditRepetitionProgress } from './timeout-policy.mjs';

function records(pairs) {
  return pairs.flatMap(([left, right], pair) => [{ pair, side: 'left', status: left }, { pair, side: 'right', status: right }]);
}
function run(statuses, requestedPairs) {
  const executed = [];
  for (const pair of records(statuses).reduce((p, r, i) => {
    if (!(i % 2)) p.push([]); p.at(-1).push(r); return p;
  }, [])) {
    executed.push(...pair);
    if (timeoutStopReason(executed, requestedPairs)) break;
  }
  return { executed, progress: repetitionProgress(executed, requestedPairs) };
}
test('10 planned pairs: two solver timeouts on each side stop after four actual calls', () => {
  const { executed, progress } = run(Array.from({ length: 10 }, () => ['TIMEOUT', 'TIMEOUT']), 10);
  assert.equal(executed.length, 4); assert.equal(progress.executedPairs, 2);
  assert.equal(progress.skippedPairs, 8); assert.equal(progress.leftTimeouts, 2); assert.equal(progress.rightTimeouts, 2);
  assert.equal(progress.earlyStop.afterPair, 1);
  assert.deepEqual(auditRepetitionProgress(executed, progress, 10), progress);
});
test('one exact plus two timeouts: an observed success on either side prevents stopping', () => {
  for (const position of [0, 1]) for (const side of [0, 1]) {
    const statuses = Array.from({ length: 3 }, () => ['TIMEOUT', 'TIMEOUT']);
    statuses[position][side] = 'EXACT';
    const { executed, progress } = run(statuses, 3);
    assert.equal(executed.length, 6); assert.equal(progress.skippedPairs, 0); assert.equal(progress.earlyStop, null);
    assert.equal(timeoutStopReason(records(statuses), 10), null);
  }
  // Batch history must also protect successes anywhere in the recorded history.
  assert.equal(timeoutStopReason(records([['TIMEOUT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT'], ['EXACT', 'EXACT']]), 10), null);
});
test('a success permanently protects all ten repeats, even with later repeated timeouts', () => {
  const statuses = Array.from({ length: 10 }, () => ['TIMEOUT', 'TIMEOUT']);
  statuses[0] = ['TIMEOUT', 'EXACT'];
  const { progress } = run(statuses, 10);
  assert.equal(progress.executedPairs, 10); assert.equal(progress.skippedPairs, 0);
  assert.equal(progress.rightTimeouts, 9); assert.equal(progress.leftTimeouts, 10);
});
test('one pair, partial pair, unrelated errors and different comparisons cannot trigger stopping', () => {
  assert.equal(timeoutStopReason(records([['TIMEOUT', 'TIMEOUT']]), 10), null);
  const partial = records([['TIMEOUT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT']]).slice(0, 3);
  assert.equal(timeoutStopReason(partial, 10), null);
  for (const status of ['ERROR', 'INVALID', 'SETUP_TIMEOUT', 'VALIDATION_TIMEOUT', 'CLEANUP_TIMEOUT']) {
    assert.equal(timeoutStopReason(records([[status, 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT']]), 10), null);
  }
  const stopped = run(Array.from({ length: 10 }, () => ['TIMEOUT', 'TIMEOUT']), 10);
  const successful = run(Array.from({ length: 10 }, () => ['EXACT', 'EXACT']), 10);
  assert.equal(stopped.progress.executedPairs, 2); assert.equal(successful.progress.executedPairs, 10);
  assert.equal(repetitionProgress(records([['TIMEOUT', 'TIMEOUT']]), 1).skippedPairs, 0);
  assert.equal(repetitionProgress(records([['TIMEOUT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT']]), 2).earlyStop, null);
});
test('audit rejects fake/missing samples, invented timeouts and undocumented early stops', () => {
  const two = records([['TIMEOUT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT']]);
  assert.throws(() => auditRepetitionProgress(two, {}, 10)); // old format needs all requested calls
  const progress = repetitionProgress(two, 10);
  assert.throws(() => auditRepetitionProgress(two, { ...progress, skippedPairs: 0 }, 10));
  assert.throws(() => repetitionProgress(records([['EXACT', 'TIMEOUT'], ['TIMEOUT', 'TIMEOUT']]), 10));
  assert.throws(() => repetitionProgress([...two, ...two], 10));
  assert.throws(() => repetitionProgress(records(Array.from({ length: 3 }, () => ['TIMEOUT', 'TIMEOUT'])), 10));
  const full = records(Array.from({ length: 3 }, () => ['TIMEOUT', 'TIMEOUT']));
  assert.equal(auditRepetitionProgress(full, {}, 3).skippedPairs, 0); // historic artifact
});
