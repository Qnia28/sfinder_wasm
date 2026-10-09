import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateFixture, verifyResult } from '../contracts.mjs';
import { originalStructure } from '../export-classifier-raw.mjs';
import { sha256, digest, readJson, safePath } from './contracts.mjs';

export const ADAPTERS = Object.freeze({
  'capture-per-save': { version: 1, action: 'capture', success: 'CAPTURED' },
  'capture-minimals': { version: 1, action: 'capture', success: 'CAPTURED' },
  'collector-diagnostic': { version: 1, action: 'collector-preflight', success: 'COLLECTOR_MATCH' },
  'secondary-fixture': { version: 1, action: 'secondary', success: 'EXACT' },
  'triage-fixture': { version: 1, action: 'triage', success: 'EXACT' },
});
export const captureAdapter = c => c.kind === 'per-save' ? 'capture-per-save' : 'capture-minimals';
export function fixtureMetadata(fixture) {
  const c = fixture.origin.command;
  return { fumen: c.sourceFumen, pattern: c.pattern, family: c.family, mirrorGroup: c.mirrorGroup ?? null, commandId: c.id,
    commandKind: c.kind, wantedSave: c.wantedSave ?? null, save: fixture.origin.filter,
    filterSemantics: c.kind === 'per-save' ? 'QUEUE_REMAINDER_ONE_PIECE' : 'LAST_BAG_EXACT_MULTIPLICITY_EXPRESSION',
    primaryHard: fixture.primaryHard, primaryBackend: fixture.cardinalityProof.backend,
    primaryKernelStats: fixture.cardinalityProof.kernelStats,
    primaryThreads: fixture.cardinalityProof.backend === 'ortools' ? 2 : fixture.cardinalityProof.backend === 'kernel' ? 0 : 1,
    tinyEligible: fixture.keys.length <= 48, ...originalStructure(fixture) };
}
export function describeFixture(file, reference = {}) {
  const bytes = fs.readFileSync(file), sha = sha256(bytes), fixture = validateFixture(JSON.parse(bytes));
  if (reference.sha256) assert.equal(sha, reference.sha256, 'fixture bytes changed');
  if (reference.id) assert.equal(fixture.id, reference.id);
  return { id: fixture.id, file: path.resolve(file), sha256: sha, byteLength: bytes.length,
    commandId: fixture.origin.command.id, commandHash: digest(fixture.origin.command), trivial: Boolean(fixture.trivial),
    acquisition: reference.acquisition ?? 'NEW_CAPTURE', provenance: reference.provenance ?? { file }, metadata: JSON.parse(JSON.stringify(fixtureMetadata(fixture))) };
}
export function requestFor(call, task, bundle, outputDir, { input = null, probeSeed = null } = {}) {
  assert(ADAPTERS[task.adapter], 'unsupported adapter');
  if (task.adapter === 'triage-fixture') {
    assert(input && input.id===call.inputId);
    const file=safePath(bundle,input.member);assert.equal(sha256(fs.readFileSync(file)),call.inputHash);
    return { action:'triage',variant:call.variant,fixturePath:file,fixtureSha256:call.inputHash,
      exactHumanQuality:'true',baselineRoot:path.resolve('triage-baseline'),expectedWitness:input.expectedWitness??null,
      ...(['CP_MEMORY_R9','CP_COMPACT_R11','CP_FAILURE_R12'].includes(call.phase)?{memoryDiagnostic:'cp-memory-v1'}:{}),
      ...(call.phase==='CP_FAILURE_R12'?{nativeFailureDiagnostic:true}:{}),
      ...(call.variant==='T_PROBE_SEED'?{probeSeed}: {}) };
  }
  if (task.adapter === 'secondary-fixture') {
    const file = safePath(bundle, task.fixture.path); assert.equal(sha256(fs.readFileSync(file)), task.fixture.sha256);
    validateFixture(readJson(file));
    return { action: 'secondary', engine: call.variant, fixturePath: file, fixtureSha256: task.fixture.sha256,
      cpLimitMs: call.limits.callMs, exactHumanQuality: 'true' };
  }
  return { action: ADAPTERS[task.adapter].action, command: task.command,
    outputDir: path.resolve(outputDir, 'fixtures'), fixturePrefix: call.logicalCallId + '-', exactHumanQuality: 'true' };
}
export function verifyExecution(row, fixtureFile) {
  if (row.status !== 'EXACT') { assert(row.ms === null, 'censored time imputation'); return null; }
  assert.equal(row.adapter, 'secondary-fixture');
  assert(Number.isFinite(row.ms) && row.ms > 0); assert.equal(row.ms, row.execution.result.responseMs);
  assert.equal(sha256(fs.readFileSync(fixtureFile)), row.inputHash);
  const verified = verifyResult(validateFixture(readJson(fixtureFile)), row.execution.result.result, { engine: row.variant });
  assert(verified.completed); assert.deepEqual(row.execution.result.verified.selected, verified.selected);
  return digest({ selected: verified.selected, quality: verified.qualityVector });
}
