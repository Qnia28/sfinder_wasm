import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { VARIANTS, runIdFor, validateSchedule, validateIncumbent, validateLedger, qualityForKeys } from './a0-contracts.mjs';
import { analyzeRecords, median, nearestRankP95 } from './a0-analysis.mjs';
import { collectWorker } from './a0-worker-lifecycle.mjs';

// Synthetic records and fake isolates only: no import of WASM or A0 search code.
const matrix = { keys: ['a', 'b', 'c'], K: 2, seedKeys: ['a', 'b'],
  rows: [[[0, 2], [2, 1]], [[1, 3]], [[0, 2], [2, 1]]] };
const result = { count: 2, keys: ['a', 'b'], qualityVector: [2, 2, 3], searchedStates: 10, completed: true };
const copy = value => structuredClone(value);
function makePlan(n = 1, repetitions = 2) {
  const cases = Array.from({ length: n }, (_, i) => ({ caseId: `case-${i}`, identitySha256: `identity-${i}` }));
  const runSchedule = [];
  for (const [index, row] of cases.entries()) for (let repetition = 1; repetition <= repetitions; repetition++) {
    const orderIndex = (index + repetition - 1) % 2;
    for (let pos = 0; pos < 2; pos++) runSchedule.push({ caseId: row.caseId, repetition,
      variant: VARIANTS[(orderIndex + pos) % 2], sequence: runSchedule.length + 1, orderIndex, maxWallMs: 60_000 });
  }
  return { variants: VARIANTS, cases, uniqueMatrixCount: n, selectedUniqueMatrixCount: n,
    selectedCaseIds: cases.map(row => row.caseId), repetitionsPerVariant: repetitions, plannedRuns: runSchedule.length, runSchedule };
}
const campaign = { binarySha256: 'binary', stateBudget: 100_000, scheduleSha256: 'schedule' };
function makeRecords(plan) {
  return plan.runSchedule.flatMap(job => {
    const base = { runId: runIdFor(job), caseId: job.caseId, repetition: job.repetition, variant: job.variant };
    return [{ ...base, event: 'start' }, { ...base, event: 'result', status: 'EXACT', completed: true,
      binarySha256: campaign.binarySha256, stateBudget: campaign.stateBudget,
      input: { identitySha256: plan.cases.find(row => row.caseId === job.caseId).identitySha256 },
      integratedProbeAttempted: true, incumbentValidation: 'PASS',
      incumbent: { count: result.count, keys: result.keys, qualityVector: result.qualityVector },
      searchedStates: job.variant === VARIANTS[0] ? 12 : 10,
      solverCallWallMs: job.variant === VARIANTS[0] ? 10 : 9 }];
  });
}

test('full schedule and subset schedules keep adjacent AB/BA pairs', () => {
  assert.equal(validateSchedule(makePlan(3, 3)).size, 18);
  const plan = makePlan(3, 3);
  plan.selectedCaseIds = ['case-1']; plan.selectedUniqueMatrixCount = 1;
  plan.runSchedule = plan.runSchedule.filter(job => job.caseId === 'case-1').map((job, i) => ({ ...job, sequence: i + 1 }));
  plan.plannedRuns = 6;
  assert.equal(validateSchedule(plan).size, 6);
});
for (const [label, mutate] of [
  ['duplicate selected case', p => p.selectedCaseIds.push(p.selectedCaseIds[0])],
  ['unknown variant', p => p.runSchedule[0].variant = 'OTHER'],
  ['duplicate job', p => p.runSchedule[1] = { ...p.runSchedule[0], sequence: 2 }],
  ['wrong sequence', p => p.runSchedule[0].sequence = 9],
  ['wrong order', p => p.runSchedule[0].orderIndex = 1],
  ['nonpositive repetitions', p => p.repetitionsPerVariant = 0],
  ['foreign selected matrix', p => p.selectedCaseIds[0] = 'foreign'],
]) test(`schedule rejects ${label}`, () => {
  const plan = makePlan(); mutate(plan); assert.throws(() => validateSchedule(plan));
});
test('original row multiplicity is preserved in quality vector', () => {
  assert.deepEqual(qualityForKeys(matrix, result.keys), [2, 2, 3]);
  assert.deepEqual(validateIncumbent(matrix, result, 100_000).qualityVector, [2, 2, 3]);
});
for (const [label, mutate] of [
  ['duplicate keys', r => r.keys = ['a', 'a']],
  ['unknown key', r => r.keys = ['a', 'foreign']],
  ['wrong K', r => r.count = 1],
  ['wrong vector', r => r.qualityVector = [2, 3, 3]],
  ['missing vector row', r => r.qualityVector = [2, 3]],
  ['invalid completion flag', r => r.completed = 'true'],
  ['over-budget states', r => r.searchedStates = 100_001],
  ['non-integer states', r => r.searchedStates = 1.5],
  ['unsorted stable IDs', r => r.keys = ['b', 'a']],
  ['seed regression', r => { r.keys = ['b', 'c']; r.qualityVector = [1, 1, 3]; }],
]) test(`incumbent rejects ${label}`, () => {
  const value = copy(result); mutate(value); assert.throws(() => validateIncumbent(matrix, value, 100_000));
});
test('ledger accepts serial results but rejects duplicates, foreign and dangling starts', () => {
  const plan = makePlan(); const records = makeRecords(plan);
  assert.equal(validateLedger(records, plan, campaign).size, 4);
  assert.throws(() => validateLedger([...records, records[1]], plan, campaign), /terminal/);
  assert.throws(() => validateLedger([{ ...records[0], runId: 'foreign' }], plan, campaign), /unscheduled/);
  assert.throws(() => validateLedger(records.slice(0, -1), plan, campaign), /dangling/);
  assert.throws(() => validateLedger(records.slice(1), plan, campaign), /without matching start/);
});
test('ledger rejects binary provenance mismatch', () => {
  const plan = makePlan(); const records = makeRecords(plan); records[1].binarySha256 = 'other';
  assert.throws(() => validateLedger(records, plan, campaign), /provenance/);
});
test('aborted attempt is preserved without counting it as terminal completion', () => {
  const plan = makePlan(); const records = makeRecords(plan);
  records.unshift({ ...records[0] }, { ...records[0], event: 'aborted' });
  assert.equal(validateLedger(records, plan, campaign).size, 4);
});
test('analysis independently rejects a fabricated PASS witness', () => {
  const plan = makePlan(); const records = makeRecords(plan);
  records[1].incumbent = { count: 2, keys: ['a', 'a'], qualityVector: [2, 2, 3] };
  const report = analyzeRecords(plan, campaign, records, () => matrix);
  assert.equal(report.validationFailures.length, 1);
  assert.equal(report.allGatesPass, false);
});
test('timeout is uncomparable, never a zero-regression pass', () => {
  const plan = makePlan(); const records = makeRecords(plan);
  records[1] = { ...records[1], status: 'TIMEOUT', completed: false, incumbent: null };
  const report = analyzeRecords(plan, campaign, records, () => matrix);
  assert.equal(report.missingComparisons.length, 1);
  assert.equal(report.gates.allQualityAndStatePairsComparable, false);
  assert.equal(report.exactBothMatrices, 0);
});
test('capped runs have valid quality comparisons but no exact latency contribution', () => {
  const plan = makePlan(); const records = makeRecords(plan);
  records[1] = { ...records[1], status: 'BUDGET_CAPPED', completed: false };
  const report = analyzeRecords(plan, campaign, records, () => matrix);
  assert.equal(report.missingComparisons.length, 0);
  assert.equal(report.exactBothMatrices, 0);
  assert.equal(report.deterministicMismatches.length, 1);
});
test('gate arithmetic uses unique matrices, not repetitions as extra samples', () => {
  const plan = makePlan(20, 2);
  const report = analyzeRecords(plan, campaign, makeRecords(plan), () => matrix);
  assert.equal(report.exactBothMatrices, 20);
  assert.equal(report.exactSubsetRatio, 0.9);
  assert.equal(report.matrixRatioP95, 0.9);
  assert.equal(report.allGatesPass, true);
  assert.equal(report.promotionDecision, 'REQUIRES_SEPARATE_APPROVAL');
});
test('median and explicitly nearest-rank p95 are deterministic', () => {
  assert.equal(median([10, 4]), 7); assert.equal(median([]), null);
  assert.equal(nearestRankP95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
});

class FakeWorker extends EventEmitter {
  constructor(exitDelay = 5) { super(); this.exitDelay = exitDelay; this.exited = false; }
  terminate() {
    if (!this.termination) this.termination = new Promise(resolve => setTimeout(() => {
      this.exited = true; this.emit('exit', 1); resolve(1);
    }, this.exitDelay));
    return this.termination;
  }
}
test('result waits for worker shutdown before returning to next job', async () => {
  const worker = new FakeWorker();
  const pending = collectWorker(worker, { maxWallMs: 100 });
  worker.emit('message', { event: 'probe-started' });
  worker.emit('message', { event: 'result', status: 'EXACT' });
  assert.equal(worker.exited, false);
  const value = await pending;
  assert.equal(worker.exited, true); assert.equal(value.status, 'EXACT');
  assert.equal(value.integratedProbeAttempted, true);
});
test('timeout before probe differs from timeout during probe and waits for exit', async () => {
  for (const attempts of [false, true]) {
    const worker = new FakeWorker();
    const pending = collectWorker(worker, { maxWallMs: 5 });
    if (attempts) worker.emit('message', { event: 'probe-started' });
    const value = await pending;
    assert.equal(worker.exited, true); assert.equal(value.status, 'TIMEOUT');
    assert.equal(value.integratedProbeAttempted, attempts); assert.equal(value.partialIncumbent, null);
  }
});
test('late result cannot overwrite a timeout', async () => {
  const worker = new FakeWorker(15);
  const pending = collectWorker(worker, { maxWallMs: 5 });
  setTimeout(() => worker.emit('message', { event: 'result', status: 'EXACT' }), 10);
  assert.equal((await pending).status, 'TIMEOUT');
});
test('worker error is terminal and still shuts down', async () => {
  const worker = new FakeWorker(); const pending = collectWorker(worker, { maxWallMs: 100 });
  worker.emit('error', new Error('synthetic failure'));
  const value = await pending;
  assert.equal(value.status, 'ERROR'); assert.equal(worker.exited, true);
});
