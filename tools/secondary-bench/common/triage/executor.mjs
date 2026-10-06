import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { digest, readJson, writeJson, replaceJson, safePath, sha256 } from '../contracts.mjs';
import { admitted } from '../budget.mjs';
import { deliver, deadlineClient } from '../evidence.mjs';
import { isolatedScope } from '../../followup-scope.mjs';
import { selectedVector } from '../../contracts.mjs';
import { validateLock, PROFILE } from './protocol.mjs';

const append = (fd, row) => { fs.writeSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); };
export async function executeTask(lock, task, bundle, directory, state, { scope = isolatedScope, now = Date.now, jobStartedMs, checkpointsRemaining = 1 } = {}) {
  fs.mkdirSync(directory, { recursive: false });
  const raw = fs.openSync(path.join(directory, 'raw.jsonl'), 'wx'), starts = fs.openSync(path.join(directory, 'starts.jsonl'), 'wx');
  const admittedTask = admitted({ ...lock, endUtc: new Date(lock.endMs).toISOString(), manifest: { budget: { job: lock.manifest.job } } },
    jobStartedMs, now(), task.worstMs, checkpointsRemaining);
  const results = [], seeds = new Map();
  try {
    for (const call of task.calls) {
      const input = lock.manifest.inputs.find(f => f.id === call.inputId); assert(input);
      const base = { schemaVersion: 1, campaignId: lock.manifest.campaignId, manifestHash: lock.manifestHash,
        profileHash: lock.profileHash, invocationId: lock.invocationId, phase: task.phase, taskId: task.id,
        runnerId: `${process.env.GITHUB_RUN_ID ?? 'synthetic'}/${process.env.GITHUB_JOB ?? 'local'}/${process.env.INPUT_ARTIFACT_ID ?? 'contract'}`,
        ...call, logicalCallId: call.callId, metadata: input.metadata, condition: PROFILE };
      const reason = state.fatal ?? (!admittedTask ? 'BUDGET' : null)
        ?? (state.oom.includes(call.inputId + '/' + call.variant) ? 'AFTER_OOM' : null)
        ?? (call.variant === 'T_PROBE_SEED' && !seeds.has(call.trialId) ? 'PROBE_SEED_UNAVAILABLE' : null);
      if (reason) {
        const row = { ...base, recordId: digest({ callId: call.callId, reason }), executionAttemptId: null, status: 'NOT_RUN_' + reason, ms: null };
        append(raw, row); results.push(row); continue;
      }
      const attemptId = digest({ invocation: lock.invocationId, call: call.callId });
      const attempt = { ...base, executionAttemptId: attemptId, startedUtc: new Date(now()).toISOString() };
      append(starts, attempt);
      let execution;
      const started = performance.now();
      try {
        const file = safePath(bundle, input.member); assert.equal(sha256(fs.readFileSync(file)), call.inputHash);
        const job = { action: 'triage', variant: call.variant, fixturePath: file, fixtureSha256: call.inputHash,
          exactHumanQuality: 'true', baselineRoot: path.resolve('triage-baseline'),
          expectedWitness: input.expectedWitness ?? null,
          ...(call.variant === 'T_PROBE_SEED' ? { probeSeed: seeds.get(call.trialId) } : {}) };
        execution = await scope({ callId: attemptId, job, limits: call.limits, phaseLimits: {},
          contractChildFile: 'tools/secondary-bench/common/triage/child.mjs' }, path.join(directory, attemptId));
      } catch (error) { execution = { status: 'ERROR_SCOPE', reaped: false, result: null, error: error.message }; }
      const record = execution.result;
      if (call.variant === 'I100K_SEED_CAPTURE' && execution.reaped && ['EXACT', 'PROBE_INCOMPLETE'].includes(execution.status)) {
        try {
          assert(Array.isArray(record.probeSeed));
          selectedVector(readJson(safePath(bundle, input.member)), record.probeSeed);
          seeds.set(call.trialId, record.probeSeed);
        } catch (error) { execution.status = 'MISMATCH'; execution.seedError = error.message; }
      }
      const row = { ...attempt, status: execution.status, ms: execution.status === 'EXACT' ? record.policySettledMs : null,
        supervisorWallMs: performance.now() - started, execution };
      append(raw, row); results.push(row);
      if (execution.status === 'OOM' && execution.reaped) state.oom.push(call.inputId + '/' + call.variant);
      else if (!execution.reaped || !['EXACT', 'INCOMPLETE', 'PROBE_INCOMPLETE'].includes(execution.status) && !execution.status.startsWith('TIMEOUT_'))
        state.fatal = 'UNSAFE_OR_INVALID_RESULT';
    }
  } finally {
    fs.closeSync(raw); fs.closeSync(starts); writeJson(path.join(directory, 'TASK_COMPLETE.json'), { taskId: task.id, state });
  }
  return results;
}
export async function runChunk(bundle, directory, client, { scope = isolatedScope, now = Date.now, jobStartedMs } = {}) {
  const lock = validateLock(readJson(path.join(bundle, 'LOCK.json'))), chunk = readJson(path.join(bundle, 'CHUNK.json'));
  assert.equal(chunk.manifestHash, lock.manifestHash); assert.equal(chunk.hash, digest(chunk.tasks));
  assert(chunk.tasks.length <= 3); fs.mkdirSync(directory);
  const state = { fatal: null, oom: [] }, profile = { retentionDays: 30, retries: 2 }, receipts = [];
  const identity = part => ({ campaignId: lock.manifest.campaignId, invocationId: lock.invocationId,
    phase: chunk.phase, chunk: chunk.index, part });
  const prefix = `triage-data-${lock.manifest.campaignId}-${chunk.phase}-${chunk.index}`;
  try {
    for (const [part, task] of chunk.tasks.entries()) {
      await executeTask(lock, task, bundle, path.join(directory, `part-${part}`), state, { scope, now, jobStartedMs, checkpointsRemaining: chunk.tasks.length - part });
      replaceJson(path.join(directory, 'QUARANTINE.json'), state);
      await deliver(deadlineClient(client, lock.manifest.job.checkpointMs), path.join(directory, `part-${part}`),
        path.join(directory, 'transport', `part-${part}.json`), identity(part), profile, prefix + '-' + part);
    }
  } finally {
    const flushEnd = performance.now() + lock.manifest.job.finalTransportMs;
    for (let part = 0; part < chunk.tasks.length; part++) {
      const dir = path.join(directory, `part-${part}`), receipt = path.join(directory, 'transport', `part-${part}.json`);
      if (!fs.existsSync(dir)) continue;
      for (let n = 0; n < 2 && performance.now() < flushEnd; n++) {
        if (fs.existsSync(receipt) && readJson(receipt).status === 'UPLOADED') break;
        await deliver(deadlineClient(client, Math.max(1, flushEnd - performance.now())), dir, receipt, identity(part), profile, prefix + '-' + part, true);
      }
      receipts.push(readJson(receipt));
    }
    const report = { status: receipts.length === chunk.tasks.length && receipts.every(r => r.status === 'UPLOADED') ? 'ALL_DURABLE' : 'UNDELIVERED',
      receipts, state, solverCallsInTransport: 0 };
    writeJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'), report);
    await deliver(deadlineClient(client, lock.manifest.job.transportAuditMs), path.join(directory, 'transport'),
      path.join(directory, 'AUDIT_RECEIPT.json'), identity('audit'), profile, prefix + '-audit');
  }
  return readJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'));
}
