// One immutable wall-clock origin for capture, all rounds, retries and uploads.
import assert from 'node:assert/strict';
import { ENGINES, hash, validateLimits, assertExact, positiveMs } from './contracts.mjs';
import { informationSchedule } from './schedule.mjs';

export const HOUR = 3600000;
export const POLICY = Object.freeze({ initialRepeats: 2, repeatStep: 2, maxRepeats: 10,
  extraAdmissionMs: 6 * HOUR, overallMs: 8 * HOUR, jobSoftMs: 40 * 60000,
  jobHardMinutes: 60, finishReserveMs: 5 * 60000, maxParallel: 16 });
export const DEFAULT_LIMITS = Object.freeze({ startupMs: 10000, callMs: 60000, reapMs: 5000 });
export const EXTENDED_POLICY = Object.freeze({ initialRepeats: 4, repeatStep: 4, maxRepeats: 20,
  extraAdmissionMs: 5 * HOUR, overallMs: 6 * HOUR, jobSoftMs: 140 * 60000,
  jobHardMinutes: 160, finishReserveMs: 5 * 60000, maxParallel: 16 });
export const EXTENDED_LIMITS = Object.freeze({ startupMs: 10000, callMs: 300000, reapMs: 5000 });
export const policyFor = plan => plan.campaignVariant === 'extended-5m' ? EXTENDED_POLICY : POLICY;
export const jobShape = plan => plan.campaignVariant === 'extended-5m'
  ? { maximumTasks: 2, taskScopeSeconds: 4200, taskStepMinutes: 71, checkpointMinutes: 3 }
  : { maximumTasks: 4, taskScopeSeconds: 600, taskStepMinutes: 11, checkpointMinutes: 2 };
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
  assert(['initial-1m', 'extended-5m', undefined].includes(plan.campaignVariant));
  const policy = policyFor(plan), callMs = plan.campaignVariant === 'extended-5m' ? 300000 : 60000;
  for (const [name, value] of Object.entries(policy)) assert.equal(plan.policy?.[name], value, 'policy.' + name);
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
  assert.equal(plan.captureLimits.callMs, 60000); // Capture is reused in extended run.
  for (const ms of Object.values(plan.capturePhaseLimits ?? {})) positiveMs(ms, 'capture phase');
  assert(plan.capturePhaseLimits?.enumeration && plan.capturePhaseLimits?.primary);
  for (const engine of ENGINES) { validateLimits(plan.limits?.[engine]); assert.equal(plan.limits[engine].callMs, callMs); }
  positiveMs(plan.cpLimitMs, 'CP limit'); assert.equal(plan.cpLimitMs, callMs);
  if (plan.campaignVariant === 'extended-5m') {
    assert(/^[0-9]+$/.test(String(plan.reuseCaptureRunId)), 'extended run reuses frozen first-run fixtures');
    assert(typeof plan.reuseCampaignId === 'string' && plan.reuseCampaignId.length);
    assert(/^[a-f0-9]{64}$/.test(plan.reuseSourceLock), 'original capture source lock required');
    assert(Array.isArray(plan.reusedFixtureLock) && plan.reusedFixtureLock.length > 0);
    for (const fixture of plan.reusedFixtureLock) assert(fixture.id && /^[a-f0-9]{64}$/.test(fixture.sha256));
  }
  assert(['ALL_NONTRIVIAL', 'ONE_PER_COMMAND_HASH'].includes(plan.fixtureSelection));
  return plan;
}
export function campaignTimes(plan, now = Date.now()) {
  const origin = Date.parse(plan.originUtc);
  assert(Number.isFinite(origin) && now >= origin, 'invalid/future campaign origin');
  const policy = policyFor(plan);
  return { elapsedMs: now - origin, extraEnd: origin + policy.extraAdmissionMs, end: origin + policy.overallMs };
}
export function eligiblePair(plan, fixture, engine, round, history, now) {
  const policy = policyFor(plan), step = policy.repeatStep;
  assert(Number.isInteger(round) && round >= step && round <= policy.maxRepeats && round % step === 0);
  const times = campaignTimes(plan, now);
  if (now >= times.end) return { eligible: false, reason: `CAMPAIGN_${policy.overallMs / HOUR}H` };
  if (round > policy.initialRepeats && now >= times.extraEnd) return { eligible: false, reason: `EXTRA_ADMISSION_${policy.extraAdmissionMs / HOUR}H` };
  const rows = history.filter(row => row.inputId === fixture.id && row.engine === engine);
  if (rows.some(row => isAttempt(row) && unsafeStatus(row.status))) return { eligible: false, reason: 'UNRESOLVED_ERROR' };
  const attempts = rows.filter(isAttempt).sort((a, b) => a.repeat - b.repeat);
  const repeats = new Set(attempts.map(row => row.repeat));
  assert.equal(repeats.size, attempts.length, 'duplicate engine/fixture repetition');
  if (attempts.some(row => row.repeat > round - step)) return { eligible: false, reason: 'PAIR_ALREADY_ATTEMPTED_OR_INTERRUPTED' };
  if (round > policy.initialRepeats) {
    // Never fill a missing attempt as a successful repeat or restart the clock.
    if (attempts.length !== round - step || attempts.some((row, i) => row.repeat !== i + 1)) return { eligible: false, reason: 'PRIOR_PAIR_INCOMPLETE' };
    if (attempts.slice(-2).every(row => isTimeout(row.status))) return { eligible: false, reason: 'PREVIOUS_TWO_TIMEOUTS' };
  }
  return { eligible: true, reason: round === policy.initialRepeats ? (policy.initialRepeats === 2 ? 'BASIC_TWO' : 'BASIC_FOUR')
    : (policy.repeatStep === 2 ? 'USER_ADAPTIVE_PAIR' : 'USER_ADAPTIVE_BLOCK'),
    repeats: Array.from({ length: step }, (_, i) => round - step + 1 + i) };
}
export function roundTasks(plan, fixtures, history, round, now = Date.now()) {
  const policy = policyFor(plan);
  const schedule = informationSchedule(fixtures, { repeats: policy.maxRepeats, shards: 1, seed: plan.scheduleSeed });
  const tasks = [], decisions = [];
  for (const fixture of fixtures) {
    const engines = ENGINES.filter(engine => {
      const decision = eligiblePair(plan, fixture, engine, round, history, now);
      decisions.push({ inputId: fixture.id, engine, round, ...decision }); return decision.eligible;
    });
    if (!engines.length) continue;
    const calls = schedule.filter(call => call.inputId === fixture.id && engines.includes(call.engine) && call.repeat > round - policy.repeatStep && call.repeat <= round);
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
