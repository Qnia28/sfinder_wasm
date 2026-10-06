// A narrowly bounded repair continuation, not general replay/recovery support.
import assert from 'node:assert/strict';
import { digest, integer } from '../contracts.mjs';

export function continuationContract(m) {
  const c = m.startupContinuation;
  if (!c) return { reservedCalls: 0, reservedRunnerHours: 0, reservedCpSyntheticCalls: 0 };
  assert.equal(c.id, 'canary-witness-serialization-repair-v1');
  assert.equal(c.reservedCalls, 32); // Charge ALL prior planned slots, including NOT_RUN/unknown.
  assert.equal(c.reservedCpSyntheticCalls, 4);
  assert.equal(c.reservedRunnerHours, 14); // Failed activation + all seven prior allocated jobs.
  integer(c.priorRunId); integer(c.priorLock.artifactId); integer(c.priorPlan.artifactId);
  assert(/^sha256:[a-f0-9]{64}$/.test(c.priorLock.digest));
  assert(/^sha256:[a-f0-9]{64}$/.test(c.priorPlan.digest));
  assert.equal(c.originUtc, m.activationRecovery?.originUtc);
  assert.equal(c.priorEvidencePooled, false);
  assert.equal(c.priorEvidenceReclassified, false);
  assert(c.reservedRunnerHours + 13 * 2.5 <= 36 * 2.5, 'prior jobs must fit the original control reserve');
  return c;
}

export function assertStageBudget(m, scheduledCalls, matrixJobs) {
  const c = continuationContract(m);
  assert(scheduledCalls + c.reservedCalls <= m.maxCalls, 'cumulative call reservation exceeded; required confirmations may not be silently dropped');
  assert((matrixJobs + 36) * 2.5 <= m.maxRunnerHours, 'runner-hour reservation exceeded');
}

export function verifyPriorCanary(m, priorLock, plan, compiledCalls) {
  const c = continuationContract(m), old = priorLock.manifest;
  assert(!old.startupContinuation, 'only one canary repair continuation is supported');
  assert.equal(priorLock.invocationId, String(c.priorRunId));
  assert.equal(priorLock.manifestHash, digest(old));
  assert.equal(priorLock.originMs, Date.parse(c.originUtc));
  assert.deepEqual(old.sourceFiles.product, m.sourceFiles.product, 'solver/product source changed');
  assert.deepEqual(old.profileContract, m.profileContract);
  assert.deepEqual(old.baselineFiles, m.baselineFiles);
  assert.equal(old.tasksHash, m.tasksHash);
  assert.equal(old.inputs.length, m.inputs.length);
  for (const ref of m.inputs) {
    const previous = old.inputs.find(f => f.id === ref.id); assert(previous);
    const { expectedWitness: before, ...previousInput } = previous;
    const { expectedWitness: after, ...currentInput } = ref;
    assert.deepEqual(previousInput, currentInput, 'original fixture/seed/metadata changed');
    assert.equal(before?.sha256, after?.sha256, 'original witness hash changed');
    if (before) assert.equal(after.contract, 'INSERTION_SELECTED_QUALITY');
  }
  assert.equal(plan.phase, 'CANARY'); assert.equal(plan.chunks, 3);
  assert.equal(plan.manifestHash, priorLock.manifestHash);
  assert.equal(plan.expectedCalls.length, c.reservedCalls);
  assert.deepEqual(plan.expectedCalls, compiledCalls);
  return { status: 'PASS', reservedCalls: c.reservedCalls, originalOriginMs: priorLock.originMs,
    previousManifestHash: priorLock.manifestHash, priorEvidencePooled: false, priorEvidenceReclassified: false,
    solverCalls: 0 };
}
