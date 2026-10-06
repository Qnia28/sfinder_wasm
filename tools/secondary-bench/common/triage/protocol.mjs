import assert from 'node:assert/strict';
import { digest, integer, strict } from '../contracts.mjs';
import { FOLLOWUP_JOB, worstCall, packTasks, validateBudget } from '../budget.mjs';
import { continuationContract } from './continuation.mjs';
import { evidenceFirst } from './gates.mjs';

export const PROFILE = Object.freeze({ id: 'triage-cold-v1', lifecycle: 'fresh-process-cold',
  exactHumanQuality: 'true', timingContract: 'post-primary-policy-settled-v1',
  memoryScope: 'policy-process-tree', memoryMaxBytes: 3221225472, swapMaxBytes: 0,
  threads: { rustPrimary: 1, highsPrimary: 1, cpsatPrimary: 2, rustSecondary: 1, cpsatSecondary: 1 },
  cpDelayMs: 60000, cpLimitMs: 120000, probeStateBudget: 100000 });
export const PHASES = ['CANARY', 'CALIBRATION', 'ALL_INITIAL', 'PER_SAVE_INITIAL', 'SEED_DIAGNOSTIC', 'TRIVIAL_CONTRACT', 'ALL_CONFIRMATION', 'PER_SAVE_CONFIRMATION'];
export const INITIAL = ['ALL_INITIAL', 'PER_SAVE_INITIAL', 'SEED_DIAGNOSTIC', 'TRIVIAL_CONTRACT'];
export const AUDIT_CONTRACT = Object.freeze({ id: 'independent-python-evidence-v1', runtime: 'Python3-stdlib', solverReplay: false,
  prerequisiteJobs: ['CANARY','CALIBRATION'], finalDedicatedVm: true, performancePass: false, independentOptimality: false });
export const CP_PREFLIGHT_CONTRACT = Object.freeze({ id: 'scoped-cpsat-weighted-tie-v1', activationCalls: 1,
  maxCanaryVmCalls: 3, callMs: 30000, populationCalls: 0 });
export function validateManifest(m) {
  strict(m,['schemaVersion','campaignId','purpose','freshValidation','profile','profileContract','maxParallel','maxCalls',
    'maxRunnerHours','overallMs','job','inputs','baselineFiles','sourceFiles','tasksHash','design','provenance','runtime',
    'auditContract','cpPreflightContract','activationRecovery','startupContinuation','revision','approval','analysis',
    'measurement','budget','evidence','continuation','gateContract','prerequisiteReuse'],'triage manifest');
  if (evidenceFirst(m.gateContract)) {
    integer(m.revision,6,2147483647);
    assert.equal(m.measurement?.adapter,'triage-fixture','new gate contract requires explicit performance manifest');
  }
  if(m.prerequisiteReuse) {
    assert(evidenceFirst(m.gateContract)&&m.continuation,'reuse requires explicit adjudication continuation');
    assert.deepEqual(m.prerequisiteReuse,{id:'adjudication-only-prerequisites-v1',phases:['CANARY','CALIBRATION']});
  }
  assert.equal(m.schemaVersion, 1); assert.equal(m.profile, PROFILE.id);
  assert.equal(m.purpose, 'development-policy-ab'); assert.equal(m.freshValidation, false);
  assert.equal(m.maxParallel, 16); assert.equal(m.maxCalls, 8479);
  integer(m.maxRunnerHours, 1400, 1400); integer(m.overallMs, 120 * 3600000, 120 * 3600000);
  assert.deepEqual(m.profileContract, PROFILE);
  assert.deepEqual(m.auditContract, AUDIT_CONTRACT); assert.deepEqual(m.cpPreflightContract, CP_PREFLIGHT_CONTRACT);
  assert.equal(m.job.jobMinutes, 150); assert.deepEqual(m.job, FOLLOWUP_JOB);
  assert.equal(m.inputs.length, 580); assert.equal(new Set(m.inputs.map(f => f.id)).size, 580);
  for (const f of m.inputs) { assert(/^[a-f0-9]{64}$/.test(f.sha256)); assert.equal(f.member, `fixtures/${f.sha256}.json`); }
  assert.equal(m.design.gates.correctness_disagreements_allowed, 0);
  continuationContract(m);
  if (m.measurement) {
    assert.equal(m.measurement.adapter, 'triage-fixture');
    assert.deepEqual(m.measurement.variants, ['BASELINE','A','B']);
    assert.equal(m.analysis, 'DEVELOPMENT_KEEP_HOLD_REJECT'); integer(m.revision);
    assert(typeof m.approval === 'string' && m.approval.length);
    validateBudget(m.budget);
    assert.deepEqual(m.budget, { maxParallel:m.maxParallel,overallMs:m.overallMs,maxCalls:m.maxCalls,job:m.job });
    assert.equal(m.evidence.retentionDays,30);assert.equal(m.evidence.retries,2);
    assert.equal(m.evidence.diskReserveBytes,4*1024**3);
    strict(m.measurement,['adapter','variants'],'triage measurement');
    strict(m.evidence,['schemaVersion','retentionDays','retries','diskReserveBytes'],'triage evidence');
    assert.equal(m.evidence.schemaVersion,1);
  }
  return m;
}
export function validateLock(lock) {
  validateManifest(lock.manifest); assert.equal(lock.manifestHash, digest(lock.manifest));
  assert.equal(lock.endMs, lock.originMs + lock.manifest.overallMs);
  assert.equal(lock.profileHash, digest(PROFILE));
  assert(/^[a-zA-Z0-9_-]+$/.test(lock.invocationId)); return lock;
}
export function compileTasks(m, templates, phase, selected = null) {
  assert(PHASES.includes(phase));
  const index = new Map(m.inputs.map(f => [f.id, f]));
  return templates.filter(t => t.phase === phase && (!t.conditional || selected?.includes(t.fixture_ids[0]))).map(t => {
    const calls = [];
    const add = (inputId, variant, repeat, extra = {}) => {
      const input = index.get(inputId); assert(input);
      const limits = { startupMs: 10000, callMs: phase === 'TRIVIAL_CONTRACT' ? 30000 : 300000, reapMs: 5000 };
      const identity = { campaignId: m.campaignId, phase, taskId: t.task_id, inputId, inputHash: input.sha256, variant, repeat, ...extra,
        ...(m.continuation ? { measurementEpoch:m.revision } : {}) };
      calls.push({ ...identity, callId: digest(identity), limits });
    };
    if (t.pairs) for (const pair of t.pairs) for (const variant of pair.order)
      add(t.fixture_ids[0], variant === 'BASELINE' && t.baseline_variant ? t.baseline_variant : variant, pair.repeat,
        { pairId: pair.pair_id, comparator: pair.comparator, order: pair.order });
    else if (t.trials) for (const trial of t.trials) for (const variant of trial.order)
      add(t.fixture_ids[0], variant, trial.repeat, { trialId: `${t.task_id}/${trial.repeat}` });
    else for (const id of t.fixture_ids) for (const variant of t.variants) add(id, variant, 1);
    assert.equal(calls.length, t.calls);
    return { id: t.task_id, adapter:'triage-fixture', phase, calls, worstMs: calls.reduce((sum, c) => sum + worstCall(c.limits, m.job), 0) };
  });
}
export function chunksFor(m, templates, phase, selected = null) {
  return packTasks(compileTasks(m, templates, phase, selected), m.job);
}
