import assert from 'node:assert/strict';

export const isRecordedTimeout = status => ['TIMEOUT_STARTUP', 'TIMEOUT_API', 'TIMEOUT_PROCESS', 'TIMEOUT_PROBE', 'TIMEOUT_AUDIT'].includes(status);

export function validateConsumed(schedule, outcomes) {
  assert(outcomes.length <= schedule.length);
  const ids = new Set();
  outcomes.forEach((o, i) => {
    assert(!ids.has(o.runId), 'duplicate consumed request'); ids.add(o.runId);
    for (const [key, value] of Object.entries(schedule[i])) assert.equal(o[key], value, `resume schedule drift: ${key}`);
    assert(o.status === 'VERIFIED' || isRecordedTimeout(o.status), 'cannot resume past an integrity error');
  });
  return ids;
}

export function jobCompletion(expected, attempted, verified, timeouts, stopReason) {
  assert.equal(attempted, verified + timeouts);
  if (attempted === expected) return timeouts ? 'COMPLETE_WITH_TIMEOUTS' : 'COMPLETE';
  if (['PAIR_ADMISSION_DEADLINE', 'COMPUTE_DEADLINE'].includes(stopReason)) return 'BUDGET_EXHAUSTED_WITH_PARTIAL_RESULTS';
  return 'STOPPED_INTEGRITY_ERROR';
}
