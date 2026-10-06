import assert from 'node:assert/strict';
import { digest, integer } from '../contracts.mjs';
import { FOLLOWUP_JOB, worstCall, packTasks } from '../budget.mjs';
import { continuationContract } from './continuation.mjs';

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
      const identity = { campaignId: m.campaignId, phase, taskId: t.task_id, inputId, inputHash: input.sha256, variant, repeat, ...extra };
      calls.push({ ...identity, callId: digest(identity), limits });
    };
    if (t.pairs) for (const pair of t.pairs) for (const variant of pair.order)
      add(t.fixture_ids[0], variant === 'BASELINE' && t.baseline_variant ? t.baseline_variant : variant, pair.repeat,
        { pairId: pair.pair_id, comparator: pair.comparator, order: pair.order });
    else if (t.trials) for (const trial of t.trials) for (const variant of trial.order)
      add(t.fixture_ids[0], variant, trial.repeat, { trialId: `${t.task_id}/${trial.repeat}` });
    else for (const id of t.fixture_ids) for (const variant of t.variants) add(id, variant, 1);
    assert.equal(calls.length, t.calls);
    return { id: t.task_id, phase, calls, worstMs: calls.reduce((sum, c) => sum + worstCall(c.limits, m.job), 0) };
  });
}
export function chunksFor(m, templates, phase, selected = null) {
  return packTasks(compileTasks(m, templates, phase, selected), m.job);
}
