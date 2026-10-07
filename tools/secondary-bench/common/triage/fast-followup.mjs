// Narrow, approved r6 follow-up contract; execution stays in common/executor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readJson, sha256 } from '../contracts.mjs';

export const FAST_PHASE = 'A_FAST_FACTORIAL';
export const FAST_ARMS = Object.freeze({
  BASE_ON: { policy: 'baseline', trace: true }, A_ON: { policy: 'A', trace: true },
  BASE_OFF: { policy: 'baseline', trace: false }, A_OFF: { policy: 'A', trace: false },
  SHAM_ON_1: { policy: 'baseline', trace: true }, SHAM_ON_2: { policy: 'baseline', trace: true },
  SHAM_OFF_1: { policy: 'baseline', trace: false }, SHAM_OFF_2: { policy: 'baseline', trace: false },
});
export function validateFast(m) {
  const f = m.followup;
  assert.equal(f.id, 'a-fast-trace-factorial-v1'); assert.equal(m.revision, 7);
  assert(!m.continuation && !m.prerequisiteReuse && !m.startupContinuation);
  assert.equal(f.calls, 500); assert.equal(f.chunks, 42);
  assert.equal(f.priorCalls, 7907); assert.equal(f.priorRunnerHours, 1255);
  assert.equal(f.newCpCalls, 1); assert.equal(f.controlHours, 3.5);
  assert(f.priorCalls + f.calls + f.newCpCalls <= m.maxCalls);
  assert(f.priorRunnerHours + f.chunks * 2.5 + f.controlHours <= m.maxRunnerHours);
  assert.equal(f.originMs, 1791287463000); assert.equal(f.endMs, 1791719463000);
  for (const key of ['parentLockSha256', 'accountingSha256', 'designSha256']) assert(/^[a-f0-9]{64}$/.test(f[key]));
  assert.deepEqual(m.measurement.variants, Object.keys(FAST_ARMS));
}
export function fastParent(m) {
  validateFast(m); const f = m.followup;
  const bytes = fs.readFileSync('config/PARENT_LOCK.json'); assert.equal(sha256(bytes), f.parentLockSha256);
  const parent = JSON.parse(bytes);
  assert.equal(parent.invocationId, '37487586383');
  assert.equal(parent.originMs, f.originMs); assert.equal(parent.endMs, f.endMs);
  assert.equal(parent.manifest.campaignId, m.campaignId);
  assert.deepEqual(parent.manifest.sourceFiles.product, m.sourceFiles.product);
  assert.deepEqual(parent.manifest.profileContract, m.profileContract);
  for (const ref of m.inputs) assert.deepEqual(ref, parent.manifest.inputs.find(r => r.id === ref.id));
  assert.equal(sha256(fs.readFileSync('config/PRIOR_ACCOUNTING.json')), f.accountingSha256);
  const a = readJson('config/PRIOR_ACCOUNTING.json');
  assert.equal(a.reservedCalls, f.priorCalls); assert.equal(a.cumulativeReservedRunnerHours, f.priorRunnerHours);
  assert(a.budgetEvidenceComplete && !a.unknownStarts.length);
  assert.equal(a.budget.originMs, f.originMs); assert.equal(a.budget.endMs, f.endMs);
  assert.equal(sha256(fs.readFileSync('config/FOLLOWUP_DESIGN.json')), f.designSha256);
  return parent;
}
