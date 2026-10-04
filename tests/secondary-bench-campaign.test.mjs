import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { POLICY, DEFAULT_LIMITS, EXTENDED_POLICY, EXTENDED_LIMITS, jobShape, HOUR, validateCampaign, eligiblePair, roundTasks, packTasks, worstCallMs } from '../tools/secondary-bench/campaign.mjs';
import { hash, identity, writeJson, readJson, verifyResult } from '../tools/secondary-bench/contracts.mjs';
import { runChunk } from '../tools/secondary-bench/run-chunk.mjs';
import { loadHistory, chooseFixtures, planWave } from '../tools/secondary-bench/plan-wave.mjs';
import { requireLinuxMemoryScope } from '../tools/secondary-bench/run.mjs';
import { reportCampaign } from '../tools/secondary-bench/report-campaign.mjs';
import { combineReports, combinedMarkdown } from '../tools/secondary-bench/combined-report.mjs';

const command = () => ({ id: 'synthetic/queue', kind: 'per-save', family: 'bag', sourceFumen: 'not-enumerated-in-this-test',
  clear: 4, pattern: '*!', useHold: true, primary: 'auto', piecesNeeded: 6, queueLength: 7, savedPieceCount: 1, exactHumanQuality: 'true' });
const plan = () => ({ schema: 2, state: 'APPROVED', campaignId: 'contract', approvalRecord: 'synthetic-contract-only', purpose: 'information',
  lifecycle: 'fresh-process-cold', exactHumanQuality: 'true', originUtc: '2026-10-05T00:00:00Z', repeatUnit: 'ENGINE_X_FIXTURE',
  scheduleSeed: 'locked', policy: POLICY, commands: [command()], fixtureSelection: 'ONE_PER_COMMAND_HASH',
  sourceFiles: { 'tools/secondary-bench/campaign.mjs': hash(fs.readFileSync('tools/secondary-bench/campaign.mjs')) },
  limits: Object.fromEntries(['integrated', 'threshold', 'cpsat'].map(engine => [engine, DEFAULT_LIMITS])),
  cpLimitMs: 60000, captureLimits: DEFAULT_LIMITS, capturePhaseLimits: { enumeration: 60000, primary: 60000 } });
const start = Date.parse('2026-10-05T00:00:00Z');
const fixtures = [{ id: 'matrix', sha256: 'a'.repeat(64), path: 'fixture.json' }];
const rows = (engine, statuses) => statuses.map((status, i) => ({ inputId: 'matrix', engine, status, repeat: i + 1, execution: { reaped: true } }));
function temporary() {
  const root = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  return fs.mkdtempSync(path.join(root, 'secondary-campaign-contract-'));
}
function removeOwned(directory) {
  // Only this test's freshly-created directory, never a project/broad path.
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) removeOwned(filename); else fs.unlinkSync(filename);
  }
  fs.rmdirSync(directory);
}
const extended = () => ({ ...plan(), campaignVariant: 'extended-5m', campaignId: 'extended-contract', policy: EXTENDED_POLICY,
  limits: Object.fromEntries(['integrated', 'threshold', 'cpsat'].map(engine => [engine, EXTENDED_LIMITS])), cpLimitMs: 300000,
  reuseCaptureRunId: '37222172267', reuseCampaignId: 'original-contract', reuseSourceLock: 'f'.repeat(64),
  reusedFixtureLock: fixtures.map(({ id, sha256 }) => ({ id, sha256 })) });
test('extended campaign locks 300s / four-repeat blocks / max20 / 5h admission / 6h wall', () => {
  const p = validateCampaign(extended()), basic = roundTasks(p, fixtures, [], 4, start);
  assert.equal(basic.tasks[0].calls.length, 12); assert.equal(basic.tasks[0].worstMs, 64 * 60000);
  assert.deepEqual(new Set(basic.tasks[0].calls.map(c => c.repeat)), new Set([1, 2, 3, 4]));
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 8, rows('integrated', Array(4).fill('EXACT')), start + 5 * HOUR).reason, 'EXTRA_ADMISSION_5H');
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 4, [], start + 6 * HOUR).reason, 'CAMPAIGN_6H');
  assert.throws(() => eligiblePair(p, fixtures[0], 'integrated', 24, [], start));
  assert.throws(() => eligiblePair(p, fixtures[0], 'integrated', 6, [], start));
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 8, rows('integrated', ['EXACT', 'EXACT', 'TIMEOUT_CALL', 'TIMEOUT_CALL']), start).reason, 'PREVIOUS_TWO_TIMEOUTS');
  const shape = jobShape(p), tasks = Array.from({ length: 309 }, (_, i) => ({ ...basic.tasks[0], id: String(i) }));
  const chunks = packTasks(tasks, p.policy.jobSoftMs - p.policy.finishReserveMs, shape.maximumTasks);
  assert.equal(chunks.length, 155); assert(chunks.every(c => c.tasks.length <= 2 && c.worstMs <= 128 * 60000));
  assert(p.policy.jobHardMinutes < 360); assert(shape.taskScopeSeconds * 1000 > basic.tasks[0].worstMs);
});
test('extended round20 reserves repeats17-20 and excludes an incomplete earlier four-call block', () => {
  const p = extended(), attempts = rows('integrated', Array(16).fill('EXACT'));
  const schedule = roundTasks(p, fixtures, attempts, 20, start);
  assert.equal(schedule.tasks[0].calls.length, 4);
  assert.deepEqual(schedule.tasks[0].calls.map(c => c.repeat), [17, 18, 19, 20]);
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 8, rows('integrated', Array(3).fill('EXACT')), start).reason, 'PRIOR_PAIR_INCOMPLETE');
});
test('campaign locks 60s, initial2 / +2 / max10, 6h admission and 8h wall without runner-hour budget', () => {
  const p = validateCampaign(plan());
  assert.equal(p.budget, undefined);
  assert.throws(() => validateCampaign({ ...p, policy: { ...POLICY, overallMs: 9 * HOUR } }));
  assert.throws(() => validateCampaign({ ...p, commands: [{ ...command(), family: 'independent-split' }] }));
  assert.throws(() => validateCampaign({ ...p, commands: [{ ...command(), savedPieceCount: 2 }] }));
  assert.throws(() => validateCampaign({ ...p, limits: { ...p.limits, integrated: { ...DEFAULT_LIMITS, callMs: 30000 } } }));
});
test('only the engine whose previous two calls timed out is excluded; both repeats must exist', () => {
  const p = plan(), history = [...rows('integrated', ['EXACT', 'EXACT']), ...rows('threshold', ['TIMEOUT_CALL', 'EXACT']), ...rows('cpsat', ['TIMEOUT_CALL', 'TIMEOUT_CALL'])];
  const tasks = roundTasks(p, fixtures, history, 4, start + HOUR);
  assert.equal(tasks.tasks.length, 1); assert.equal(tasks.tasks[0].calls.length, 4);
  assert.deepEqual(new Set(tasks.tasks[0].calls.map(c => c.engine)), new Set(['integrated', 'threshold']));
  assert.equal(tasks.decisions.find(d => d.engine === 'cpsat').reason, 'PREVIOUS_TWO_TIMEOUTS');
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 4, rows('integrated', ['EXACT']), start).reason, 'PRIOR_PAIR_INCOMPLETE');
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 4, rows('integrated', ['ERROR', 'EXACT']), start).reason, 'UNRESOLVED_ERROR');
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 4, rows('integrated', ['EXACT', 'TIMEOUT_CALL', 'EXACT']), start).reason, 'PAIR_ALREADY_ATTEMPTED_OR_INTERRUPTED');
});
test('additional rounds stop at6h; basic still admits before8h; max10 is hard', () => {
  const p = plan(), history = rows('integrated', ['EXACT', 'EXACT']);
  assert(eligiblePair(p, fixtures[0], 'integrated', 4, history, start + 6 * HOUR - 1).eligible);
  assert.equal(eligiblePair(p, fixtures[0], 'integrated', 4, history, start + 6 * HOUR).reason, 'EXTRA_ADMISSION_6H');
  assert(eligiblePair(p, fixtures[0], 'threshold', 2, [], start + 7 * HOUR).eligible);
  assert.equal(eligiblePair(p, fixtures[0], 'threshold', 2, [], start + 8 * HOUR).reason, 'CAMPAIGN_8H');
  assert.throws(() => eligiblePair(p, fixtures[0], 'threshold', 12, [], start));
  assert.equal(roundTasks(p, fixtures, rows('integrated', Array(8).fill('EXACT')), 10, start).tasks[0].calls.length, 2);
});
test('chunk packing reserves whole two-repeat/three-engine blocks and remains below a 1h job', () => {
  const p = plan(), fs = Array.from({ length: 440 }, (_, i) => ({ id: 'matrix-' + i }));
  const tasks = roundTasks(p, fs, [], 2, start).tasks, chunks = packTasks(tasks);
  assert.equal(tasks.length, 440); assert.equal(chunks.length, 110);
  assert(chunks.every(c => c.tasks.length === 4 && c.worstMs === 32 * 60000));
  assert.equal(worstCallMs(DEFAULT_LIMITS), 80000);
  assert.equal(POLICY.maxParallel, 16);
  assert.deepEqual(chunks.flatMap(c => c.tasks.map(t => t.id)), tasks.map(t => t.id));
});
test('chunk persists timeout raw, continues next engine and exits normally; errors quarantine later calls', async () => {
  const root = temporary(), bundle = path.join(root, 'bundle'), output = path.join(root, 'output');
  fs.mkdirSync(bundle); const p = plan(); writeJson(path.join(bundle, 'campaign.json'), p);
  const bytes = Buffer.from('{}'); fs.writeFileSync(path.join(bundle, 'fixture.json'), bytes);
  const f = [{ ...fixtures[0], sha256: hash(bytes) }];
  const task = roundTasks(p, f, [], 2, start).tasks[0];
  writeJson(path.join(bundle, 'chunk-0.json'), { campaignId: p.campaignId, sourceLock: identity(p.sourceFiles), stage: '2', tasks: [task] });
  let calls = 0;
  try {
    await runChunk(bundle, 0, output, { now: () => start, memoryCheck: () => ({ scope: 'synthetic-contract' }),
      isolate: async () => { calls++; return { status: calls === 1 ? 'TIMEOUT_CALL' : 'EXACT', reaped: true, result: { responseMs: 1 } }; } });
    const raw = fs.readFileSync(path.join(output, 'raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls, 6); assert.equal(raw[0].ms, null); assert.equal(raw[0].status, 'TIMEOUT_CALL');
    assert.equal(raw[5].status, 'EXACT'); assert.equal(readJson(path.join(output, 'COMPLETE.json')).halted, null);
    const second = path.join(root, 'error-output'); calls = 0;
    await runChunk(bundle, 0, second, { now: () => start, memoryCheck: () => ({}),
      isolate: async () => { calls++; return { status: 'MISMATCH', reaped: true, result: null }; } });
    assert.equal(calls, 1); assert.equal(readJson(path.join(second, 'COMPLETE.json')).halted, 'UNSAFE_OR_INVALID_RESULT');
    const errorRows = fs.readFileSync(path.join(second, 'raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(errorRows.length, 6); assert.equal(errorRows[5].status, 'NOT_RUN_UNSAFE_OR_INVALID_RESULT');
  } finally { removeOwned(root); }
});
test('queued extra task rechecks6h in its own job, not just the wave planner', async () => {
  const root = temporary(), bundle = path.join(root, 'bundle'); fs.mkdirSync(bundle); const p = plan();
  writeJson(path.join(bundle, 'campaign.json'), p);
  const task = roundTasks(p, fixtures, rows('integrated', ['EXACT', 'EXACT']), 4, start + HOUR).tasks[0];
  writeJson(path.join(bundle, 'chunk-0.json'), { campaignId: p.campaignId, sourceLock: identity(p.sourceFiles), stage: '4', tasks: [task] });
  try {
    await runChunk(bundle, 0, path.join(root, 'result'), { now: () => start + 6 * HOUR, memoryCheck: () => ({}), isolate: () => { throw new Error('must not launch'); } });
    const lines = fs.readFileSync(path.join(root, 'result/raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 2); assert(lines.every(r => r.status === 'NOT_RUN_EXTRA_ADMISSION_6H'));
  } finally { removeOwned(root); }
});
test('capture partial files remain eligible provenance but do not claim command completion', () => {
  const root = temporary(), directory = path.join(root, 'fixtures'); fs.mkdirSync(directory); const p = plan();
  try {
    const f = { schema: 1, id: command().id + '/T', keys: ['a', 'b'], rows: [[[0, 1], [1, 2]]], K: 1, seed: [0],
      cardinalityProof: { status: 'PROVEN', backend: 'synthetic' }, origin: { command: command(), filter: 'T' }, trivial: null };
    const filename = path.join(directory, 'saved-before-timeout.json'); writeJson(filename, f);
    const selection = chooseFixtures(p, [filename]); assert.equal(selection.selected.length, 1);
    assert.equal(selection.ledger[0].captureComplete, 'SEE_CAPTURE_RAW_NOT_INFERRED_FROM_FIXTURE_PRESENCE');
    fs.writeFileSync(path.join(root, 'raw.jsonl'), JSON.stringify({ action: 'capture', campaignId: p.campaignId,
      sourceLock: identity(p.sourceFiles), inputId: command().id, status: 'TIMEOUT_CALL', execution: { reaped: true } }) + '\n');
    assert.equal(loadHistory(root, p).rows.length, 1);
  } finally { removeOwned(root); }
});
test('lost VM torn final append is preserved as a warning, not an exact result or missing earlier raw rows', () => {
  const root = temporary(), p = plan();
  const good = { action: 'capture', campaignId: p.campaignId, sourceLock: identity(p.sourceFiles), inputId: command().id,
    status: 'TIMEOUT_CALL', execution: { reaped: true } };
  try {
    const bytes = JSON.stringify(good) + '\n{"action":"secondary","status":"EX';
    fs.writeFileSync(path.join(root, 'raw.jsonl'), bytes);
    const history = loadHistory(root, p);
    assert.equal(history.rows.length, 1); assert.equal(history.ledgerWarnings.length, 1);
    assert.equal(history.ledgerWarnings[0].kind, 'INTERRUPTED_FINAL_RAW_APPEND');
    assert.equal(fs.readFileSync(path.join(root, 'raw.jsonl'), 'utf8'), bytes);
  } finally { removeOwned(root); }
});
test('a cgroup oom_kill increment is preserved as OOM and stops later calls', async () => {
  const root = temporary(), bundle = path.join(root, 'bundle'); fs.mkdirSync(bundle); const p = plan();
  writeJson(path.join(bundle, 'campaign.json'), p); const bytes = Buffer.from('{}'); fs.writeFileSync(path.join(bundle, 'fixture.json'), bytes);
  const task = roundTasks(p, [{ ...fixtures[0], sha256: hash(bytes) }], [], 2, start).tasks[0];
  writeJson(path.join(bundle, 'chunk-0.json'), { campaignId: p.campaignId, sourceLock: identity(p.sourceFiles), stage: '2', tasks: [task] });
  const events = path.join(root, 'memory.events'); fs.writeFileSync(events, 'oom_kill 0\n');
  try {
    await runChunk(bundle, 0, path.join(root, 'result'), { now: () => start, memoryCheck: () => ({ memoryEventsPath: events, scope: 'synthetic-cgroup-counter' }),
      isolate: async () => { fs.writeFileSync(events, 'oom_kill 1\n'); return { status: 'ERROR_EXIT', reaped: true, result: null }; } });
    const raw = fs.readFileSync(path.join(root, 'result/raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(raw[0].status, 'OOM'); assert.equal(raw[0].ms, null); assert.equal(raw[0].execution.originalStatus, 'ERROR_EXIT');
    assert(raw.slice(1).every(r => r.status === 'NOT_RUN_UNSAFE_OR_INVALID_RESULT'));
  } finally { removeOwned(root); }
});
test('final campaign report preserves missing repetitions and never upgrades partial capture to complete', () => {
  const root = temporary(), directory = path.join(root, 'fixtures'); fs.mkdirSync(directory); const p = plan();
  try {
    const f = { schema: 1, id: command().id + '/T', keys: ['a', 'b'], rows: [[[0, 1], [1, 2]]], K: 1, seed: [0],
      cardinalityProof: { status: 'PROVEN', backend: 'synthetic' }, origin: { command: command(), filter: 'T' }, trivial: null };
    writeJson(path.join(directory, 'fixture.json'), f);
    fs.writeFileSync(path.join(root, 'raw.jsonl'), JSON.stringify({ action: 'capture', campaignId: p.campaignId,
      sourceLock: identity(p.sourceFiles), inputId: command().id, status: 'TIMEOUT_CALL', execution: { reaped: true } }) + '\n');
    const report = reportCampaign(p, root);
    assert.equal(report.selectedFixtures, 1); assert.equal(report.collectionState, 'PARTIAL_OR_REVIEW_REQUIRED');
    assert.equal(report.captureIncomplete.length, 1); assert.equal(report.missingInitial.length, 6);
    assert.equal(report.maximumCalls, 30); assert.equal(report.actionsSuccessIsNotCorrectnessPass, true);
  } finally { removeOwned(root); }
});
test('combined report audits both runs with identical fixtures and NEVER pools60s/300s timing samples', () => {
  const root = temporary(), firstDir = path.join(root, 'first'), secondDir = path.join(root, 'second');
  fs.mkdirSync(firstDir); fs.mkdirSync(secondDir);
  const firstHistory = path.join(firstDir, 'history'), secondHistory = path.join(secondDir, 'history');
  fs.mkdirSync(firstHistory); fs.mkdirSync(secondHistory);
  fs.mkdirSync(path.join(firstHistory, 'fixtures'));
  const f = { schema: 1, id: command().id + '/T', keys: ['a', 'b'], rows: [[[0, 1], [1, 2]]], K: 1, seed: [0],
    cardinalityProof: { status: 'PROVEN', backend: 'synthetic' }, origin: { command: command(), filter: 'T' }, trivial: null };
  const bytes = Buffer.from(JSON.stringify(f)), fixture = { id: f.id, sha256: hash(bytes), path: 'fixture.json' };
  fs.writeFileSync(path.join(firstHistory, 'fixtures', 'fixture.json'), bytes);
  const p = plan(), q = { ...extended(), reuseCampaignId: p.campaignId, reuseSourceLock: identity(p.sourceFiles),
    reusedFixtureLock: [{ id: f.id, sha256: hash(bytes) }] };
  const capture = { action: 'capture', campaignId: p.campaignId, sourceLock: identity(p.sourceFiles),
    inputId: command().id, status: 'CAPTURED', ms: null, execution: { reaped: true } };
  const calls = (campaign, repeats, ms) => roundTasks(campaign, [fixture], [], repeats, start).tasks[0].calls.map(call => {
    const result = { count: 1, keys: ['b'], qualityVector: [2], completed: true, qualityComplete: true, tieComplete: true };
    return { ...call, action: 'secondary', campaignId: campaign.campaignId, sourceLock: identity(campaign.sourceFiles),
      status: 'EXACT', ms, runnerId: campaign.campaignId,
      condition: { sourceLock: identity(campaign.sourceFiles), fixtureSha256: hash(bytes), exactHumanQuality: 'true' },
      execution: { reaped: true, code: 0, status: 'EXACT', result: { result, responseMs: ms,
        verified: verifyResult(f, result, { engine: call.engine }), stateBudget: null, qualityResolved: 'true' } } };
  });
  fs.writeFileSync(path.join(firstHistory, 'raw.jsonl'), [capture, ...calls(p, 2, 10)].map(JSON.stringify).join('\n') + '\n');
  fs.writeFileSync(path.join(secondHistory, 'raw.jsonl'), calls(q, 4, 20).map(JSON.stringify).join('\n') + '\n');
  const reused = path.join(secondDir, 'reused-capture'); fs.mkdirSync(reused); fs.mkdirSync(path.join(reused, 'fixtures'));
  fs.writeFileSync(path.join(reused, 'fixtures', 'fixture.json'), bytes);
  fs.writeFileSync(path.join(reused, 'raw.jsonl'), JSON.stringify(capture) + '\n');
  writeJson(path.join(firstDir, 'campaign.json'), p); writeJson(path.join(secondDir, 'campaign.json'), q);
  try {
    const report = combineReports(path.join(firstDir, 'campaign.json'), firstHistory, path.join(secondDir, 'campaign.json'), secondHistory);
    assert.equal(report.totalAttempts, 18); assert.equal(report.combinedExactCalls, 18);
    assert.equal(report.first.engines[0].medianOfConditionMediansMs, 10);
    assert.equal(report.second.engines[0].medianOfConditionMediansMs, 20);
    assert.equal(report.audit.first.witnessAudit, 'PASS_FOR_RECORDED_EXACT_RESULTS');
    assert.equal(report.audit.second.witnessAudit, 'PASS_FOR_RECORDED_EXACT_RESULTS');
    assert.equal(report.audit.crossRunWitness, 'AGREEMENT_FOR_RECORDED_EXACT_WITNESSES');
    assert.equal(report.audit.second.missingInitial.length, 0);
    assert(combinedMarkdown(report).includes('서로 다른 timeout의 시간 표본은 합쳐서'));
  } finally { removeOwned(root); }
});
test('extended offline wave reuses only hash-locked first-run fixtures and schedules4/8/12/16/20', () => {
  const root = temporary(), history = path.join(root, 'history'), reused = path.join(root, 'reused-capture');
  fs.mkdirSync(history); fs.mkdirSync(reused); fs.mkdirSync(path.join(reused, 'fixtures'));
  const f = { schema: 1, id: command().id + '/T', keys: ['a', 'b'], rows: [[[0, 1], [1, 2]]], K: 1, seed: [0],
    cardinalityProof: { status: 'PROVEN', backend: 'synthetic' }, origin: { command: command(), filter: 'T' }, trivial: null };
  const bytes = Buffer.from(JSON.stringify(f)); fs.writeFileSync(path.join(reused, 'fixtures', 'first.json'), bytes);
  const p = { ...extended(), reusedFixtureLock: [{ id: f.id, sha256: hash(bytes) }] };
  const planFile = path.join(root, 'campaign.json'); writeJson(planFile, p);
  try {
    const result = planWave(planFile, history, path.join(root, 'bundle'), '4', start);
    assert.equal(result.tasks, 1); assert.equal(result.calls, 12); assert.equal(result.chunks, 1);
    const chunk = readJson(path.join(root, 'bundle', 'chunk-0.json'));
    assert.equal(chunk.tasks[0].fixture.sha256, hash(bytes)); assert.equal(chunk.tasks[0].worstMs, 64 * 60000);
    const invalid = { ...p, reusedFixtureLock: [{ id: f.id, sha256: 'a'.repeat(64) }] };
    writeJson(path.join(root, 'invalid.json'), invalid);
    assert.throws(() => planWave(path.join(root, 'invalid.json'), history, path.join(root, 'invalid-bundle'), '4', start), /exactly the first-run frozen matrices/);
    assert.throws(() => planWave(planFile, history, path.join(root, 'wrong-round'), '6', start));
  } finally { removeOwned(root); }
});
if (process.env.SECONDARY_LINUX_SCOPE_EXPECTED === '1') test('real public Linux process-tree cgroup is finite and swap-free', () => {
  const scope = requireLinuxMemoryScope();
  assert.equal(scope.scope, 'shard-process-tree'); assert(scope.memoryMax > 0 && scope.memoryMax <= 3 * 1024 ** 3); assert.equal(scope.swapMax, 0);
  assert(fs.existsSync(scope.memoryEventsPath));
});
