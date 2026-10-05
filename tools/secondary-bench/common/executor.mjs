import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { digest, readJson, writeJson, replaceJson, verifySources, logicalCallId } from './contracts.mjs';
import { PROFILE, validateLock } from './manifest.mjs';
import { admitted, worstCall } from './budget.mjs';
import { requestFor } from './adapters.mjs';
import { isolatedScope } from '../followup-scope.mjs';
import { deliver, deadlineClient } from './evidence.mjs';

const append = (fd, row) => { fs.writeSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); };
export async function executeTask(lock, chunk, task, bundle, directory, quarantine, { scope = isolatedScope, now = Date.now, jobStartedMs, checkpointsRemaining } = {}) {
  fs.mkdirSync(directory, { recursive: false });
  fs.mkdirSync(path.join(directory, 'fixtures'));
  const raw = fs.openSync(path.join(directory, 'raw.jsonl'), 'wx'), starts = fs.openSync(path.join(directory, 'starts.jsonl'), 'wx');
  const admission = admitted(lock, jobStartedMs, now(), task.worstMs, checkpointsRemaining);
  const results = [];
  try {
    for (const call of task.calls) {
      assert.equal(call.logicalCallId, logicalCallId(lock, chunk.stage, call.inputId, call.inputHash, call.variant, call.repeat, call.phase, call.limits));
      const base = { schemaVersion: 1, campaignId: lock.manifest.campaignId, invocationId: lock.invocationId,
        conditionHash: lock.conditionHash, productHash: lock.productHash, harnessHash: lock.harnessHash,
        manifestHash: lock.manifestHash, stagePlanId: chunk.stagePlanId, stage: chunk.stage,
        chunk: chunk.chunk, adapter: task.adapter, ...call, metadata: task.fixture?.metadata ?? null };
      const reason = quarantine.fatal ?? (!admission ? 'BUDGET' : null) ?? (quarantine.oom.includes(call.inputId + '/' + call.variant) ? 'AFTER_OOM' : null);
      if (reason) {
        const row = { ...base, recordId: digest({ invocation: lock.invocationId, call: call.logicalCallId, reason }),
          executionAttemptId: null, status: 'NOT_RUN_' + reason, ms: null };
        append(raw, row); results.push(row); continue;
      }
      const attemptId = digest({ invocationId: lock.invocationId, callId: call.logicalCallId });
      const attempt = { ...base, executionAttemptId: attemptId, startedUtc: new Date(now()).toISOString() };
      append(starts, attempt); // Durable start BEFORE any fixture read or solver invocation.
      const started = performance.now(); let execution;
      try {
        execution = await scope({ callId: attemptId, job: requestFor(call, task, bundle, directory), limits: call.limits,
          phaseLimits: task.adapter.startsWith('capture-') ? lock.manifest.limits.phases
            : task.adapter === 'collector-diagnostic' ? { enumeration: call.limits.callMs - 10000 } : {} }, path.join(directory, attemptId));
      } catch (error) { execution = { status: 'ERROR_SCOPE', reaped: false, result: null, error: error.message }; }
      const row = { ...attempt, status: execution.status, ms: execution.status === 'EXACT' ? execution.result.responseMs : null,
        supervisorWallMs: performance.now() - started, condition: PROFILE, execution };
      append(raw, row); results.push(row);
      if (execution.status === 'OOM' && execution.reaped) quarantine.oom.push(call.inputId + '/' + call.variant);
      else if (!execution.reaped || !['EXACT', 'INCOMPLETE', 'CAPTURED', 'COLLECTOR_MATCH'].includes(execution.status) && !execution.status.startsWith('TIMEOUT_'))
        quarantine.fatal = execution.status === 'CANCELLED' ? 'CANCELLED' : 'UNSAFE_OR_INVALID_RESULT';
    }
  } finally {
    fs.closeSync(starts); fs.closeSync(raw);
    writeJson(path.join(directory, 'TASK_COMPLETE.json'), { taskId: task.id, quarantine, completedUtc: new Date(now()).toISOString() });
  }
  return results;
}
export async function runChunk(bundle, directory, client, { scope = isolatedScope, now = Date.now, jobStartedMs } = {}) {
  assert(Number.isFinite(jobStartedMs)); const lock = validateLock(readJson(path.join(bundle, 'LOCK.json')));
  verifySources(lock.manifest.sourceFiles); const chunk = readJson(path.join(bundle, 'CHUNK.json'));
  assert.equal(chunk.manifestHash, lock.manifestHash); assert.equal(chunk.callsHash, digest(chunk.tasks.flatMap(t => t.calls)));
  assert(chunk.tasks.length <= lock.manifest.budget.job.parts);
  for (const task of chunk.tasks)
    assert.equal(task.worstMs, task.calls.reduce((s, c) => s + worstCall(c.limits, lock.manifest.budget.job), 0));
  assert(!fs.existsSync(directory), 'chunk output must be new'); fs.mkdirSync(directory);
  const quarantine = { oom: [], fatal: null }, receipts = [], j = lock.manifest.budget.job, profile = lock.manifest.evidence;
  const prefix = `common-data-${lock.manifest.campaignId}-evidence-${chunk.stage}-${chunk.chunk}-${lock.invocationId}`;
  const identity = part => ({ campaignId: lock.manifest.campaignId, invocationId: lock.invocationId, stagePlanId: chunk.stagePlanId, stage: chunk.stage, chunk: chunk.chunk, part });
  try {
    for (const [part, task] of chunk.tasks.entries()) {
      const dir = path.join(directory, 'part-' + part), receipt = path.join(directory, 'transport', 'part-' + part + '.json');
      await executeTask(lock, chunk, task, bundle, dir, quarantine, { scope, now, jobStartedMs, checkpointsRemaining: chunk.tasks.length - part });
      replaceJson(path.join(directory, 'QUARANTINE.json'), quarantine);
      await deliver(deadlineClient(client, j.checkpointMs), dir, receipt, identity(part), profile, prefix + '-' + part);
    }
  } finally {
    // Frozen bytes only. A bounded shared flush deadline, not retries*parts fresh budgets.
    const flushEnd = performance.now() + j.finalTransportMs;
    for (let part = 0; part < chunk.tasks.length; part++) {
      const dir = path.join(directory, 'part-' + part), receipt = path.join(directory, 'transport', 'part-' + part + '.json');
      if (!fs.existsSync(dir)) continue;
      for (let n = 0; n < profile.retries && performance.now() < flushEnd; n++) {
        if (fs.existsSync(receipt) && readJson(receipt).status === 'UPLOADED') break;
        await deliver(deadlineClient(client, Math.max(1, flushEnd - performance.now())), dir, receipt, identity(part), profile, prefix + '-' + part, true);
      }
      receipts.push(readJson(receipt));
    }
    const report = { schemaVersion: 1, ...identity(null), solverCallsInTransport: 0,
      status: receipts.length === chunk.tasks.length && receipts.every(r => r.status === 'UPLOADED') ? 'ALL_DURABLE' : 'UNDELIVERED',
      receipts, quarantine };
    writeJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'), report);
    await deliver(deadlineClient(client, j.transportAuditMs), path.join(directory, 'transport'), path.join(directory, 'AUDIT_RECEIPT.json'),
      identity('audit'), profile, prefix + '-audit');
  }
  verifySources(lock.manifest.sourceFiles); return readJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'));
}
