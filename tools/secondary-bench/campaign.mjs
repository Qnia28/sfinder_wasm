// One immutable wall-clock origin for capture, all rounds, retries and uploads.
import assert from 'node:assert/strict';
import { ENGINES, hash, validateLimits, assertExact, positiveMs } from './contracts.mjs';
import { informationSchedule } from './schedule.mjs';

export const HOUR = 3600000;
export const POLICY = Object.freeze({ initialRepeats: 2, repeatStep: 2, maxRepeats: 10,
  extraAdmissionMs: 6 * HOUR, overallMs: 8 * HOUR, jobSoftMs: 40 * 60000,
  jobHardMinutes: 60, finishReserveMs: 5 * 60000, maxParallel: 16 });
export const DEFAULT_LIMITS = Object.freeze({ startupMs: 10000, callMs: 60000, reapMs: 5000 });
export const isTimeout = status => typeof status === 'string' && status.startsWith('TIMEOUT_');
export const isAttempt = row => row.execution !== undefined;
export const unsafeStatus = status => !['EXACT', 'INCOMPLETE', 'CAPTURED', 'CANCELLED'].includes(status) && !isTimeout(status);
export const worstCallMs = limits => limits.startupMs + limits.callMs + 2 * limits.reapMs;
export function validateCampaign(plan) {
  assert.equal(plan.schema, 2); assert.equal(plan.state, 'APPROVED', 'campaign is not approved/frozen');
  assert.equal(plan.purpose, 'information'); assert.equal(plan.lifecycle, 'fresh-process-cold'); assertExact(plan.exactHumanQuality);
  assert(typeof plan.campaignId === 'string' && /^[a-zA-Z0-9_-]+$/.test(plan.campaignId));
  assert(typeof plan.approvalRecord === 'string' && plan.approvalRecord.length);
  assert(typeof plan.scheduleSeed === 'string' && plan.scheduleSeed.length);
  assert(Number.isFinite(Date.parse(plan.originUtc)), 'shared campaign origin required');
  for (const [name, value] of Object.entries(POLICY)) assert.equal(plan.policy?.[name], value, 'policy.' + name);
  assert.equal(plan.repeatUnit, 'ENGINE_X_FIXTURE');
  assert(Object.keys(plan.sourceFiles ?? {}).length > 0, 'source lock required');
  assert(Array.isArray(plan.commands) && plan.commands.length > 0);
  const ids = new Set();
  for (const command of plan.commands) {
    assert(command.id && !ids.has(command.id), 'duplicate command'); ids.add(command.id);
    assert(['bag', 'bag-plus-next-draw', 'restricted-split'].includes(command.family));
    assert.equal(command.savedPieceCount, 1); assert.equal(command.queueLength, command.piecesNeeded + 1);
    assert.equal(command.kind, 'per-save'); assertExact(command.exactHumanQuality);
  }
  validateLimits(plan.captureLimits);
  assert.equal(plan.captureLimits.callMs, 60000);
  for (const ms of Object.values(plan.capturePhaseLimits ?? {})) positiveMs(ms, 'capture phase');
  assert(plan.capturePhaseLimits?.enumeration && plan.capturePhaseLimits?.primary);
  for (const engine of ENGINES) { validateLimits(plan.limits?.[engine]); assert.equal(plan.limits[engine].callMs, 60000); }
  positiveMs(plan.cpLimitMs, 'CP limit'); assert.equal(plan.cpLimitMs, 60000);
  assert(['ALL_NONTRIVIAL', 'ONE_PER_COMMAND_HASH'].includes(plan.fixtureSelection));
  return plan;
}
export function campaignTimes(plan, now = Date.now()) {
  const origin = Date.parse(plan.originUtc);
  assert(Number.isFinite(origin) && now >= origin, 'invalid/future campaign origin');
  return { elapsedMs: now - origin, extraEnd: origin + POLICY.extraAdmissionMs, end: origin + POLICY.overallMs };
}
export function eligiblePair(plan, fixture, engine, round, history, now) {
  assert([2, 4, 6, 8, 10].includes(round));
  const times = campaignTimes(plan, now);
  if (now >= times.end) return { eligible: false, reason: 'CAMPAIGN_8H' };
  if (round > 2 && now >= times.extraEnd) return { eligible: false, reason: 'EXTRA_ADMISSION_6H' };
  const rows = history.filter(row => row.inputId === fixture.id && row.engine === engine);
  if (rows.some(row => isAttempt(row) && unsafeStatus(row.status))) return { eligible: false, reason: 'UNRESOLVED_ERROR' };
  const attempts = rows.filter(isAttempt).sort((a, b) => a.repeat - b.repeat);
  const repeats = new Set(attempts.map(row => row.repeat));
  assert.equal(repeats.size, attempts.length, 'duplicate engine/fixture repetition');
  if (attempts.some(row => row.repeat >= round - 1)) return { eligible: false, reason: 'PAIR_ALREADY_ATTEMPTED_OR_INTERRUPTED' };
  if (round > 2) {
    // Never fill a missing attempt as a successful repeat or restart the clock.
    if (attempts.length !== round - 2 || attempts.some((row, i) => row.repeat !== i + 1)) return { eligible: false, reason: 'PRIOR_PAIR_INCOMPLETE' };
    if (attempts.slice(-2).every(row => isTimeout(row.status))) return { eligible: false, reason: 'PREVIOUS_TWO_TIMEOUTS' };
  }
  return { eligible: true, reason: round === 2 ? 'BASIC_TWO' : 'USER_ADAPTIVE_PAIR', repeats: [round - 1, round] };
}
export function roundTasks(plan, fixtures, history, round, now = Date.now()) {
  const schedule = informationSchedule(fixtures, { repeats: 10, shards: 1, seed: plan.scheduleSeed });
  const tasks = [], decisions = [];
  for (const fixture of fixtures) {
    const engines = ENGINES.filter(engine => {
      const decision = eligiblePair(plan, fixture, engine, round, history, now);
      decisions.push({ inputId: fixture.id, engine, round, ...decision }); return decision.eligible;
    });
    if (!engines.length) continue;
    const calls = schedule.filter(call => call.inputId === fixture.id && engines.includes(call.engine) && [round - 1, round].includes(call.repeat));
    tasks.push({ id: hash(`${plan.campaignId}/${fixture.id}/${round}`).slice(0, 20), action: 'secondary', round,
      inputId: fixture.id, fixture, calls, decisions: decisions.filter(d => d.inputId === fixture.id),
      worstMs: calls.reduce((sum, call) => sum + worstCallMs(plan.limits[call.engine]), 0) });
  }
  return { tasks, decisions };
}
// Hash order is fixed before any measurements. No runtime-based selection.
export function packTasks(tasks, maximumMs = POLICY.jobSoftMs - POLICY.finishReserveMs, maximumTasks = 4) {
  const chunks = []; let chunk = [], total = 0;
  for (const task of tasks) {
    assert(task.worstMs > 0 && task.worstMs <= maximumMs, 'task cannot fit one finite job chunk');
    if (chunk.length && (total + task.worstMs > maximumMs || chunk.length >= maximumTasks)) { chunks.push({ id: chunks.length, tasks: chunk, worstMs: total }); chunk = []; total = 0; }
    chunk.push(task); total += task.worstMs;
  }
  if (chunk.length) chunks.push({ id: chunks.length, tasks: chunk, worstMs: total });
  assert(chunks.length <= 256, 'GitHub matrix limit; split into further waves');
  return chunks;
}
