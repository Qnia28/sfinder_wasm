// Explicit, pinned external reservations. No cancellation or legacy clock changes.
import assert from 'node:assert/strict';
import { strict, integer, sha256, sourceBytes, readJson } from './contracts.mjs';

export function checkAllocation(manifest, activeRuns, ownRunId, { readTemplate = readJson, bytes = sourceBytes } = {}) {
  const reservation = manifest.provenance.concurrentAllocation;
  const reserved = new Map();
  let allocated = manifest.budget.maxParallel;
  if (reservation) {
    strict(reservation, ['vmCap', 'reservations'], 'concurrent allocation'); integer(reservation.vmCap, 1, 20);
    assert(Array.isArray(reservation.reservations));
    for (const r of reservation.reservations) {
      strict(r, ['runId', 'headSha', 'workflowPath', 'maxParallel', 'templateFile', 'templateSha256'], 'external reservation');
      assert(/^[0-9]+$/.test(r.runId) && /^[a-f0-9]{40}$/.test(r.headSha)); integer(r.maxParallel, 1, 20);
      assert(r.runId !== String(ownRunId) && !reserved.has(r.runId));
      // An allocation is valid only against a frozen legacy template AND its
      // locked workflow bytes (which enforce matrix parallelism).
      assert.equal(sha256(bytes(r.templateFile)), r.templateSha256, 'external template changed');
      const template = readTemplate(r.templateFile);
      assert.equal(template.policy.maxParallel, r.maxParallel, 'external allocation disagrees with frozen template');
      assert.equal(sha256(bytes(r.workflowPath)), template.sourceFiles[r.workflowPath], 'external workflow changed');
      reserved.set(r.runId, r); allocated += r.maxParallel;
    }
    assert(allocated <= reservation.vmCap, 'concurrent VM allocation exceeds cap');
  }
  for (const run of activeRuns) {
    if (String(run.id) === String(ownRunId) || !/Secondary/.test(run.name) || run.status === 'completed') continue;
    const allowed = reserved.get(String(run.id));
    assert(allowed, 'conflicting benchmark workflow active or queued: ' + run.id);
    assert.equal(run.head_sha, allowed.headSha, 'reserved run source changed');
    assert.equal(run.path, allowed.workflowPath, 'reserved run workflow changed');
  }
  return { schemaVersion: 1, allocatedVm: allocated, vmCap: reservation?.vmCap ?? 20,
    ownVm: manifest.budget.maxParallel, reservations: [...reserved.values()],
    observedRuns: activeRuns.filter(r => /Secondary/.test(r.name)).map(r => ({ id: r.id, name: r.name, status: r.status, path: r.path, headSha: r.head_sha })) };
}
