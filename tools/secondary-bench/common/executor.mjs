import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { digest, readJson, writeJson, replaceJson, verifySources, logicalCallId } from './contracts.mjs';
import { PROFILE, validateLock, isTriage } from './manifest.mjs';
import { profileForTriage } from './triage/protocol.mjs';
import { selectedVector } from '../contracts.mjs';
import { admitted, worstCall } from './budget.mjs';
import { requestFor } from './adapters.mjs';
import { isolatedScope } from '../followup-scope.mjs';
import { deliver, deadlineClient } from './evidence.mjs';

const append = (fd, row) => { fs.writeSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); };
export async function executeTask(lock, chunk, task, bundle, directory, quarantine, { scope = isolatedScope, now = Date.now, jobStartedMs, checkpointsRemaining } = {}) {
  const triage=task.adapter==='triage-fixture', j=lock.manifest.budget?.job??lock.manifest.job, seeds=new Map();
  fs.mkdirSync(directory, { recursive: false });
  fs.mkdirSync(path.join(directory, 'fixtures'));
  const raw = fs.openSync(path.join(directory, 'raw.jsonl'), 'wx'), starts = fs.openSync(path.join(directory, 'starts.jsonl'), 'wx');
  const admission = admitted(triage ? { ...lock,endUtc:lock.endUtc??new Date(lock.endMs).toISOString(),manifest:{budget:{job:j}} } : lock,
    jobStartedMs, now(), task.worstMs, checkpointsRemaining);
  const results = [];
  try {
    for (const call of task.calls) {
      if (!triage) assert.equal(call.logicalCallId, logicalCallId(lock, chunk.stage, call.inputId, call.inputHash, call.variant, call.repeat, call.phase, call.limits));
      else if(call.taskId) { const {callId,limits,...identity}=call;assert.equal(callId,digest(identity)); }
      const input=triage?lock.manifest.inputs.find(f=>f.id===call.inputId):null;
      if(triage)assert(input,'unknown original fixture');
      const base = triage ? {schemaVersion:1,campaignId:lock.manifest.campaignId,manifestHash:lock.manifestHash,
        profileHash:lock.profileHash,invocationId:lock.invocationId,phase:task.phase,taskId:task.id,
        runnerId:`${process.env.GITHUB_RUN_ID??'synthetic'}/${process.env.GITHUB_JOB??'local'}/${process.env.INPUT_ARTIFACT_ID??'contract'}`,
        ...call,logicalCallId:call.callId,metadata:input.metadata,condition:profileForTriage(lock.manifest)} :
        { schemaVersion: 1, campaignId: lock.manifest.campaignId, invocationId: lock.invocationId,
        conditionHash: lock.conditionHash, productHash: lock.productHash, harnessHash: lock.harnessHash,
        manifestHash: lock.manifestHash, stagePlanId: chunk.stagePlanId, stage: chunk.stage,
        chunk: chunk.chunk, adapter: task.adapter, ...call, metadata: task.fixture?.metadata ?? null };
      const reason = quarantine.fatal ?? (!admission ? 'BUDGET' : null) ?? (quarantine.oom.includes(call.inputId + '/' + call.variant) ? 'AFTER_OOM' : null)
        ?? (triage&&call.variant==='T_PROBE_SEED'&&!seeds.has(call.trialId)?'PROBE_SEED_UNAVAILABLE':null);
      if (reason) {
        const row = { ...base, recordId: digest({ invocation: lock.invocationId, call: base.logicalCallId, reason }),
          executionAttemptId: null, status: 'NOT_RUN_' + reason, ms: null };
        append(raw, row); results.push(row); continue;
      }
      const attemptId = triage ? digest({invocation:lock.invocationId,call:call.callId}) : digest({ invocationId: lock.invocationId, callId: call.logicalCallId });
      const attempt = { ...base, executionAttemptId: attemptId, startedUtc: new Date(now()).toISOString() };
      append(starts, attempt); // Durable start BEFORE any fixture read or solver invocation.
      const started = performance.now(); let execution;
      try {
        execution = await scope({ callId: attemptId, job: requestFor(call, task, bundle, directory,{input,probeSeed:seeds.get(call.trialId)}), limits: call.limits,
          ...(triage?{contractChildFile:'tools/secondary-bench/common/triage/child.mjs'}:{}),
          phaseLimits: task.adapter.startsWith('capture-') ? lock.manifest.limits.phases
            : task.adapter === 'collector-diagnostic' ? { enumeration: call.limits.callMs - 10000 } : {} }, path.join(directory, attemptId));
      } catch (error) { execution = { status: 'ERROR_SCOPE', reaped: false, result: null, error: error.message }; }
      if(triage&&call.variant==='I100K_SEED_CAPTURE'&&execution.reaped&&['EXACT','PROBE_INCOMPLETE'].includes(execution.status)) {
        try { const seed=execution.result.probeSeed;assert(Array.isArray(seed));selectedVector(readJson(path.resolve(bundle,input.member)),seed);seeds.set(call.trialId,seed); }
        catch(error) {execution.status='MISMATCH';execution.seedError=error.message;}
      }
      const row = { ...attempt, status: execution.status, ms: execution.status === 'EXACT' ? (triage?execution.result.policySettledMs:execution.result.responseMs) : null,
        supervisorWallMs: performance.now() - started, condition: triage?profileForTriage(lock.manifest):PROFILE, execution };
      append(raw, row); results.push(row);
      if (execution.status === 'OOM' && execution.reaped) quarantine.oom.push(call.inputId + '/' + call.variant);
      else if (!execution.reaped || !(triage?['EXACT','INCOMPLETE','PROBE_INCOMPLETE']:['EXACT', 'INCOMPLETE', 'CAPTURED', 'COLLECTOR_MATCH']).includes(execution.status) && !execution.status.startsWith('TIMEOUT_'))
        quarantine.fatal = execution.status === 'CANCELLED' ? 'CANCELLED' : 'UNSAFE_OR_INVALID_RESULT';
    }
  } finally {
    fs.closeSync(starts); fs.closeSync(raw);
    writeJson(path.join(directory, 'TASK_COMPLETE.json'), triage?{taskId:task.id,state:quarantine}:{ taskId: task.id, quarantine, completedUtc: new Date(now()).toISOString() });
  }
  return results;
}
export async function runChunk(bundle, directory, client, { scope = isolatedScope, now = Date.now, jobStartedMs } = {}) {
  assert(Number.isFinite(jobStartedMs)); const lock = validateLock(readJson(path.join(bundle, 'LOCK.json')));
  const triage=isTriage(lock.manifest),j=lock.manifest.budget?.job??lock.manifest.job;
  if(lock.manifest.sourceFiles)verifySources(lock.manifest.sourceFiles); const chunk = readJson(path.join(bundle, 'CHUNK.json'));
  assert.equal(chunk.manifestHash, lock.manifestHash);
  assert.equal(triage?chunk.hash:chunk.callsHash, triage?digest(chunk.tasks):digest(chunk.tasks.flatMap(t => t.calls)));
  assert(chunk.tasks.length <= j.parts);
  for (const task of chunk.tasks)
    assert.equal(task.worstMs, task.calls.reduce((s, c) => s + worstCall(c.limits,j), 0));
  assert(!fs.existsSync(directory), 'chunk output must be new'); fs.mkdirSync(directory);
  const quarantine = { oom: [], fatal: null }, receipts = [], profile = lock.manifest.evidence??{retentionDays:30,retries:2};
  const prefix = triage?`triage-data-${lock.manifest.campaignId}-${chunk.phase}-${chunk.index}`:
    `common-data-${lock.manifest.campaignId}-evidence-${chunk.stage}-${chunk.chunk}-${lock.invocationId}`;
  const identity = part => triage?{campaignId:lock.manifest.campaignId,invocationId:lock.invocationId,phase:chunk.phase,chunk:chunk.index,part}:
    ({ campaignId: lock.manifest.campaignId, invocationId: lock.invocationId, stagePlanId: chunk.stagePlanId, stage: chunk.stage, chunk: chunk.chunk, part });
  try {
    for (const [part, task] of chunk.tasks.entries()) {
      const dir = path.join(directory, 'part-' + part), receipt = path.join(directory, 'transport', 'part-' + part + '.json');
      await executeTask(lock, chunk, triage?{...task,adapter:'triage-fixture'}:task, bundle, dir, quarantine, { scope, now, jobStartedMs, checkpointsRemaining: chunk.tasks.length - part });
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
      receipts, quarantine,...(triage?{state:quarantine}: {}) };
    writeJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'), report);
    await deliver(deadlineClient(client, j.transportAuditMs), path.join(directory, 'transport'), path.join(directory, 'AUDIT_RECEIPT.json'),
      identity('audit'), profile, prefix + '-audit');
  }
  if(lock.manifest.sourceFiles)verifySources(lock.manifest.sourceFiles); return readJson(path.join(directory, 'transport', 'TRANSPORT_COMPLETE.json'));
}
