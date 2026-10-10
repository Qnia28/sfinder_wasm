import assert from 'node:assert/strict';
import { digest, integer, strict } from '../contracts.mjs';
import { FOLLOWUP_JOB, worstCall, packTasks, validateBudget } from '../budget.mjs';
import { continuationContract } from './continuation.mjs';
import { evidenceFirst } from './gates.mjs';
import { FAST_PHASE, FAST_ARMS, validateFast } from './fast-followup.mjs';
import { LARGE_PHASE, LARGE_ARMS, validateLarge, isMemoryRun, largePhase } from './large-run.mjs';
import { isProbeRun, PROBE_ARMS } from './probe-followup.mjs';

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
export const profileForTriage = m => m.largeRun ? { ...PROFILE, cpLimitMs:null, arms:isProbeRun(m)?PROBE_ARMS:LARGE_ARMS, callTimeoutMs:600000 } : PROFILE;
export const phasesFor = m => m.largeRun ? [largePhase(m)] : m.followup ? [FAST_PHASE] : PHASES;
export function validateManifest(m) {
  strict(m,['schemaVersion','campaignId','purpose','freshValidation','profile','profileContract','maxParallel','maxCalls',
    'maxRunnerHours','overallMs','job','inputs','baselineFiles','sourceFiles','tasksHash','design','provenance','runtime',
    'auditContract','cpPreflightContract','activationRecovery','startupContinuation','revision','approval','analysis',
    'measurement','budget','evidence','continuation','gateContract','prerequisiteReuse','followup','largeRun'],'triage manifest');
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
  assert.equal(m.maxParallel, isMemoryRun(m)?m.revision===12?1:4:16);
  if (m.largeRun) validateLarge(m);
  else { assert.equal(m.maxCalls,8479); integer(m.maxRunnerHours,1400,1400); assert.deepEqual(m.job,FOLLOWUP_JOB); }
  integer(m.overallMs, 120 * 3600000, 120 * 3600000);
  assert.deepEqual(m.profileContract, profileForTriage(m));
  assert.deepEqual(m.auditContract, AUDIT_CONTRACT); assert.deepEqual(m.cpPreflightContract, CP_PREFLIGHT_CONTRACT);
   assert.equal(m.inputs.length, isProbeRun(m)?25:isMemoryRun(m)?m.revision===12?1:4:m.followup ? 25 : 580); assert.equal(new Set(m.inputs.map(f => f.id)).size, m.inputs.length);
  for (const f of m.inputs) { assert(/^[a-f0-9]{64}$/.test(f.sha256)); assert.equal(f.member, `fixtures/${f.sha256}.json`); }
  assert.equal(m.design.gates.correctness_disagreements_allowed, 0);
  continuationContract(m);
  if (m.measurement) {
    assert.equal(m.measurement.adapter, 'triage-fixture');
    if (m.followup) validateFast(m); else if (!m.largeRun) assert.deepEqual(m.measurement.variants, ['BASELINE','A','B']);
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
  assert.equal(lock.profileHash, digest(profileForTriage(lock.manifest)));
  assert(/^[a-zA-Z0-9_-]+$/.test(lock.invocationId)); return lock;
}
export function compileTasks(m, templates, phase, selected = null) {
  assert(phasesFor(m).includes(phase));
  const index = new Map(m.inputs.map(f => [f.id, f]));
  return templates.filter(t => t.phase === phase && (!t.conditional || selected?.includes(t.fixture_ids[0]))).map(t => {
    const calls = [];
    const add = (inputId, variant, repeat, extra = {}) => {
      const input = index.get(inputId); assert(input);
      const limits = { startupMs: 10000, callMs: m.largeRun ? 600000 : phase === 'TRIVIAL_CONTRACT' ? 30000 : 300000, reapMs: 5000 };
      const identity = { campaignId: m.campaignId, phase, taskId: t.task_id, inputId, inputHash: input.sha256, variant, repeat, ...extra,
        ...(m.continuation || m.followup || m.largeRun ? { measurementEpoch:m.revision } : {}) };
      calls.push({ ...identity, callId: digest(identity), limits });
    };
    if (isProbeRun(m)) {
      assert.deepEqual([...t.arms].sort(),Object.keys(PROBE_ARMS).sort());
      assert([1,2].includes(t.block));assert.equal(t.fixture_ids.length,1);
      for(const [position,arm] of t.arms.entries())add(t.fixture_ids[0],arm,t.block,{block:t.block,position,role:t.role});
    } else if (isMemoryRun(m)) {
      assert.deepEqual([...t.arms].sort(),m.revision===12?['CP_OPEN']:['CP_OPEN','H9_OPEN']);
      for (const [position,arm] of t.arms.entries()) add(t.fixture_ids[0],arm,1,{block:1,position,role:t.role});
    } else if (m.largeRun) {
      assert.equal(t.arms.length,8);
      assert.deepEqual([...t.arms.slice(0,4)].reverse(),t.arms.slice(4));
      assert.deepEqual([...t.arms.slice(0,4)].sort(),Object.keys(LARGE_ARMS).sort());
      for (const [i,arm] of t.arms.entries()) add(t.fixture_ids[0],arm,Math.floor(i/4)+1,
        { block:Math.floor(i/4)+1, position:i%4, role:t.role });
    } else if (m.followup) {
      assert.equal(t.arms.length, 4);
      for (const [position, arm] of t.arms.entries()) {
        assert(FAST_ARMS[arm]);
        add(t.fixture_ids[0], arm, t.block, { block:t.block, position, role:t.role });
      }
    } else if (t.pairs) for (const pair of t.pairs) for (const variant of pair.order)
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
  if(isProbeRun(m)) {
    const ts=compileTasks(m,templates,phase,selected);
    return [1,2].flatMap(b=>packTasks(ts.filter(t=>t.calls[0].block===b),m.job));
  }
  return packTasks(compileTasks(m, templates, phase, selected), m.job);
}
