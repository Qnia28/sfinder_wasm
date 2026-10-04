import assert from 'node:assert/strict';

export const TIMEOUT_POLICY = 'stop-after-two-timeouts-per-side-without-any-exact-v1';

// Per input AND per comparison. A success on either side permanently prevents
// timeout early stopping. Errors/invalid/setup timeouts do not qualify either.
// Evaluate only after both calls of a pair, never halfway through AB/BA.
export function timeoutStopReason(records, requestedPairs) {
  if (records.some(r => r.status !== 'TIMEOUT')) return null;
  const left = records.filter(r => r.side === 'left').length;
  const right = records.filter(r => r.side === 'right').length;
  if (left < 2 || right < 2 || left !== right || left >= requestedPairs) return null;
  return { policy: TIMEOUT_POLICY, afterPair: left - 1, leftTimeouts: left, rightTimeouts: right };
}

export function repetitionProgress(records, requestedPairs) {
  assert(Number.isInteger(requestedPairs) && requestedPairs >= 1);
  assert(records.length > 0 && records.length % 2 === 0, 'incomplete paired history');
  const executedPairs = records.length / 2;
  assert(executedPairs <= requestedPairs);
  const keys = new Set();
  for (const r of records) {
    assert(Number.isInteger(r.pair) && r.pair >= 0 && r.pair < executedPairs);
    assert(['left', 'right'].includes(r.side));
    const key = `${r.pair}/${r.side}`;
    assert(!keys.has(key), 'duplicate paired sample'); keys.add(key);
  }
  for (let pair = 0; pair < executedPairs; pair++) {
    assert(keys.has(`${pair}/left`) && keys.has(`${pair}/right`), 'missing paired sample');
  }
  const earlyStop = timeoutStopReason(records, requestedPairs);
  const skippedPairs = requestedPairs - executedPairs;
  if (skippedPairs) {
    assert(earlyStop, 'missing repeats without a valid early timeout stop');
    assert.equal(executedPairs, 2, 'timeout stop must occur at the first eligible pair');
  }
  return { requestedPairs, executedPairs, skippedPairs,
    leftTimeouts: records.filter(r => r.side === 'left' && r.status === 'TIMEOUT').length,
    rightTimeouts: records.filter(r => r.side === 'right' && r.status === 'TIMEOUT').length,
    earlyStop };
}

export function auditRepetitionProgress(records, summary, requestedPairs) {
  const progress = repetitionProgress(records, requestedPairs);
  if (summary.requestedPairs === undefined) {
    // Old artifacts predate the policy: they must contain every requested call.
    assert.equal(progress.skippedPairs, 0);
  } else {
    for (const [key, value] of Object.entries(progress)) assert.deepEqual(summary[key], value, `incorrect ${key}`);
  }
  return progress;
}
