import assert from 'node:assert/strict';
import { integer, strict } from './contracts.mjs';

export const FOLLOWUP_JOB = Object.freeze({ parts: 3, jobMs: 125 * 60000, reserveMs: 5 * 60000,
  setupMs: 10 * 60000, checkpointMs: 2 * 60000, finalTransportMs: 15 * 60000,
  transportAuditMs: 3 * 60000, jobMinutes: 150, scopeOverheadMs: 20000 });
export function validateLimits(limits) {
  strict(limits, ['startupMs', 'callMs', 'reapMs'], 'limits');
  for (const key of ['startupMs', 'callMs', 'reapMs']) integer(limits[key], 1, 2147483647);
  return limits;
}
export function validateBudget(budget) {
  strict(budget, ['maxParallel', 'overallMs', 'maxCalls', 'job'], 'budget');
  integer(budget.maxParallel, 1, 20); integer(budget.overallMs); integer(budget.maxCalls);
  const job = budget.job; strict(job, Object.keys(FOLLOWUP_JOB), 'job');
  for (const k of Object.keys(FOLLOWUP_JOB)) integer(job[k]);
  integer(job.parts, 1, 256); integer(job.jobMinutes, 1, 359);
  assert(job.scopeOverheadMs >= FOLLOWUP_JOB.scopeOverheadMs, 'scope overhead may not be underreserved');
  assert(job.jobMs + job.finalTransportMs + job.transportAuditMs < job.jobMinutes * 60000, 'no hard-timeout transport headroom');
  assert(capacity(job) > 0, 'no task capacity'); return budget;
}
export const capacity = job => job.jobMs - job.reserveMs - job.setupMs - job.parts * job.checkpointMs;
export const worstCall = (limits, job) => limits.startupMs + limits.callMs + 2 * limits.reapMs + job.scopeOverheadMs;
export function packTasks(tasks, job) {
  const chunks = []; let block = [], cost = 0;
  for (const task of tasks) {
    assert(task.worstMs <= capacity(job), 'comparison task exceeds job capacity');
    if (block.length && (block.length === job.parts || cost + task.worstMs > capacity(job))) {
      chunks.push({ tasks: block, worstMs: cost }); block = []; cost = 0;
    }
    block.push(task); cost += task.worstMs;
  }
  if (block.length) chunks.push({ tasks: block, worstMs: cost });
  assert(chunks.length <= 256, 'matrix limit exceeded; sampling forbidden'); return chunks;
}
export function admitted(lock, jobStartedMs, now, cost, checkpointsRemaining) {
  const j = lock.manifest.budget.job;
  const campaignEnd = Date.parse(lock.endUtc) - j.finalTransportMs - j.transportAuditMs - j.reserveMs;
  const jobEnd = jobStartedMs + j.jobMs - j.reserveMs;
  return now + cost + checkpointsRemaining * j.checkpointMs <= Math.min(campaignEnd, jobEnd);
}
export function validateLaunchGroup(manifests, vmCap) {
  integer(vmCap, 1, 20); assert(manifests.length && new Set(manifests.map(m => m.campaignId)).size === manifests.length);
  assert(manifests.reduce((s, m) => s + m.budget.maxParallel, 0) <= vmCap, 'launch VM allocation exceeds cap');
}
