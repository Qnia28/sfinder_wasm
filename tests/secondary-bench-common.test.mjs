import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { canonical, digest, sha256, writeJson, readJson, sourceBytes, STAGES, filesUnder } from '../tools/secondary-bench/common/contracts.mjs';
import { resolveManifest, activate, PROFILE, validateLock, conditionHash } from '../tools/secondary-bench/common/manifest.mjs';
import { FOLLOWUP_JOB, capacity, packTasks, worstCall, admitted, validateLaunchGroup } from '../tools/secondary-bench/common/budget.mjs';
import { selection, engineSchedule, additionalDecision } from '../tools/secondary-bench/common/policies.mjs';
import { describeFixture } from '../tools/secondary-bench/common/adapters.mjs';
import { planStage, buildTasks } from '../tools/secondary-bench/common/planner.mjs';
import { runChunk } from '../tools/secondary-bench/common/executor.mjs';
import { seal, deliver, loadHistory, indexHistory, verifySnapshot, readLegacy } from '../tools/secondary-bench/common/evidence.mjs';
import { audit, verifyArchive } from '../tools/secondary-bench/common/audit.mjs';
import { informationSchedule } from '../tools/secondary-bench/schedule.mjs';
import { makeFollowupTasks, selectFollowup, FOLLOWUP_POLICY, SHAPE } from '../tools/secondary-bench/followup.mjs';
import { convertFollowup } from '../tools/secondary-bench/common/recipes/followup.mjs';
import { validateFixture, verifyResult } from '../tools/secondary-bench/contracts.mjs';
import { runIsolated } from '../tools/secondary-bench/isolation.mjs';

function temporary(t) {
  const root = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(root, 'common-harness-'));
  t.after(() => { for (const f of filesUnder(dir).reverse()) fs.unlinkSync(f);
    const remove = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) remove(path.join(d, e.name)); fs.rmdirSync(d); }; remove(dir); });
  return dir;
}
const command = { id: 'synthetic/all/bag', kind: 'minimals', wantedSave: 'ALL', family: 'bag', pattern: '*!',
  sourceFumen: 'v115@9gwhQ4hlFewhR4glFewhg0Q4glFewhi0PeAgH', clear: 4, useHold: true,
  piecesNeeded: 6, queueLength: 7, savedPieceCount: 1, exactHumanQuality: 'true', primary: 'auto' };
const fixture = id => ({ schema: 1, id, keys: ['a', 'b'], K: 1, seed: [0], rows: [[[0, 1], [1, 2]]],
  cardinalityProof: { status: 'PROVEN', backend: 'ortools', kernelStats: {} }, primaryHard: true,
  origin: { command, filter: 'ALL' }, trivial: null });
const begin = Date.parse('2026-10-05T00:00:00Z');
const limits = { startupMs: 10000, callMs: 300000, reapMs: 5000 };
function manifest(dir, commands = []) {
  const file = path.join(dir, 'input.json'); writeJson(file, fixture('matrix'));
  return resolveManifest({ schemaVersion: 1, campaignId: 'synthetic-campaign', revision: 1, purpose: 'information', approval: 'SYNTHETIC_CONTRACT_ONLY',
    profile: PROFILE.id, inputs: { commands, fixtures: commands.length ? [] : [{ id: 'matrix', file: file.replaceAll('\\', '/'),
      sha256: sha256(fs.readFileSync(file)), acquisition: 'SYNTHETIC', provenance: { role: 'development' } }], diagnostics: [], recovery: [] },
    selection: { id: 'all-nontrivial-v1', supplementIds: [] },
    repeats: { initial: 2, additional: 2, threshold: 1.10, seed: 'frozen', order: 'six-engine-orders-v1' },
    limits: { secondary: limits, capture: limits, phases: { enumeration: 60000, primary: 300000 }, diagnostic: { ...limits, callMs: 120000 } },
    budget: { maxParallel: 2, overallMs: 36 * 3600000, maxCalls: 10000 },
    sourceFiles: { product: { 'src/ortools-min-cover.mjs': sha256(sourceBytes('src/ortools-min-cover.mjs')) },
      harness: { 'tools/secondary-bench/common/contracts.mjs': sha256(sourceBytes('tools/secondary-bench/common/contracts.mjs')) } },
    provenance: { role: 'development', exposures: ['synthetic'] }, analysis: 'INFORMATION_ONLY' });
}
function lock(dir, m, invocationId = 'contract-1', createdUtc = new Date(begin).toISOString()) {
  return activate(m, path.join(dir, invocationId), { invocationId, createdUtc, confirm: true });
}
function client(root) {
  const uploads = [];
  return { uploads, uploadArtifact: async (name, files, source) => {
    const destination = path.join(root, 'uploaded', name); fs.mkdirSync(destination, { recursive: true });
    for (const f of files) {
      const to = path.join(destination, path.relative(source, f)); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(f, to);
    }
    uploads.push({ name, destination }); return { id: uploads.length, digest: 'a'.repeat(64) };
  } };
}
const exactScope = async () => {
  const result = { keys: ['b'], count: 1, qualityVector: [2], completed: true, qualityComplete: true, tieComplete: true };
  return { status: 'EXACT', reaped: true, result: { responseMs: 10, result, verified: verifyResult(fixture('matrix'), result, { engine: 'cpsat' }) } };
};

test('canonical hash recursively sorts keys; rejects non-JSON/nonfinite values', () => {
  assert.equal(digest({ b: 2, a: { z: 3, a: 1 } }), digest({ a: { a: 1, z: 3 }, b: 2 }));
  assert.notEqual(digest([1, 2]), digest([2, 1]));
  for (const value of [undefined, NaN, Infinity, new Date(), { a: undefined }]) assert.throws(() => canonical(value));
});
test('strict resolved manifest rejects unsupported lifecycle, fields, limits and primary-thread override', t => {
  const m = manifest(temporary(t)); assert.equal(capacity(m.budget.job), 104 * 60000);
  for (const change of [{ unknown: true }, { profile: 'warm' }, { analysis: 'PASS' }, { budget: { ...m.budget, maxParallel: 21 } },
    { limits: { ...m.limits, secondary: { ...limits, callMs: 0 } } }, { repeats: { ...m.repeats, initial: 1 } }])
    assert.throws(() => resolveManifest({ ...m, ...change }));
  assert.equal(PROFILE.threads.cpsatPrimary, 2); assert.equal(PROFILE.parameters.cpsat.numWorkers, 1);
});
test('activation needs explicit approval/confirmation and verifies source bytes', t => {
  const dir = temporary(t), m = manifest(dir);
  assert.throws(() => activate(m, path.join(dir, 'no'), { createdUtc: new Date(begin).toISOString(), invocationId: 'x' }));
  assert.throws(() => lock(dir, { ...m, approval: null }));
  const bad = structuredClone(m); bad.sourceFiles.product['src/ortools-min-cover.mjs'] = '0'.repeat(64);
  assert.throws(() => lock(dir, bad));
  const l = lock(dir, m); assert.equal(l.manifest.campaignId, m.campaignId); assert.throws(() => validateLock({ ...l, conditionHash: 'bad' }));
});
test('launch allocation includes all control jobs; rejects aggregate overcommit', t => {
  const m = manifest(temporary(t)); validateLaunchGroup([m, { ...m, campaignId: 'second', budget: { ...m.budget, maxParallel: 12 } }], 20);
  assert.throws(() => validateLaunchGroup([{ ...m, budget: { ...m.budget, maxParallel: 9 } }, { ...m, campaignId: 'second', budget: { ...m.budget, maxParallel: 12 } }], 20));
});
test('engine order exactly reproduces legacy schedule for arbitrary supported repeat counts', () => {
  const fs0 = Array.from({ length: 25 }, (_, i) => ({ id: 'f-' + i }));
  for (const repeats of [2, 4, 8]) assert.deepEqual(engineSchedule(fs0, repeats, 'seed').map(({ index, ...r }) => r),
    informationSchedule(fs0, { repeats, shards: 1, seed: 'seed' }).map(({ callId, fixture, shard, ...r }) => r));
});
test('all nontrivial includes primaryHard; hash one/supplement respects independent measurement semantics', t => {
  const m = manifest(temporary(t), [command]);
  const fs0 = ['one', 'two'].map(id => ({ id, commandId: command.id, trivial: false, sha256: id }));
  assert.equal(selection(m, fs0, []).selected.length, 2);
  assert.equal(selection({ ...m, selection: { ...m.selection, id: 'hash-one-per-command-v1' } }, fs0, []).selected.length, 1);
  const legacy = selectFollowup({ commands: [command], dataset: 'A', scheduleSeed: m.repeats.seed, supplementIds: [] },
    fs0.map(f => ({ ...f, fixture: fixture(f.id) })), []);
  assert.deepEqual(selection(m, fs0, []).selected.map(f => f.id), legacy.selected.map(f => f.id));
});
test('additional selection uses declared exact-repeat count and threshold, never censored samples', () => {
  const r = { initial: 3, additional: 2, threshold: 1.2 };
  const rows = [10, 11, 12].map(ms => ({ inputId: 'x', variant: 'integrated', phase: 'INITIAL', status: 'EXACT', ms }));
  assert(additionalDecision(rows, 'x', 'integrated', r).eligible);
  rows[2].status = 'TIMEOUT_CALL'; assert(!additionalDecision(rows, 'x', 'integrated', r).eligible);
  assert(!additionalDecision(rows, 'x', 'threshold', r).eligible);
});
test('550 fixture tasks preserve legacy calls/positions and pack184 chunks; IDs survive rebatching', t => {
  const dir = temporary(t), m = manifest(dir), l = lock(dir, m);
  const selected = Array.from({ length: 550 }, (_, i) => ({ id: 'f-' + i, commandId: command.id, trivial: false, sha256: 'a'.repeat(64) }));
  const built = buildTasks(l, 'initial', { imported: selected, captured: [] }, { rows: [] });
  const legacyPlan = { dataset: 'A', campaignId: m.campaignId, limits, recovery: [], scheduleSeed: m.repeats.seed };
  const old = makeFollowupTasks(legacyPlan, 'basic', { selected, imported: [] }, []);
  assert.equal(built.tasks.length, 550); assert.equal(built.tasks.flatMap(t => t.calls).length, 3300);
  assert.deepEqual(built.tasks.flatMap(t => t.calls).map(c => [c.inputId, c.variant, c.repeat, c.position, c.blockId]),
    old.tasks.flatMap(t => t.calls).map(c => [c.inputId, c.engine, c.repeat, c.position, c.blockId]));
  assert.equal(packTasks(built.tasks, m.budget.job).length, 184);
  const smaller = { ...m.budget.job, parts: 2 };
  assert.deepEqual(packTasks(built.tasks.slice(0, 100), smaller).flatMap(c => c.tasks).flatMap(t => t.calls).map(c => c.logicalCallId),
    packTasks(built.tasks.slice(0, 100), m.budget.job).flatMap(c => c.tasks).flatMap(t => t.calls).map(c => c.logicalCallId));
});
test('oversize block and matrix overflow fail rather than sample/split comparison blocks', () => {
  assert.throws(() => packTasks([{ worstMs: capacity(FOLLOWUP_JOB) + 1 }], FOLLOWUP_JOB));
  assert.throws(() => packTasks(Array.from({ length: 769 }, () => ({ worstMs: 1 })), FOLLOWUP_JOB));
});
test('admission reserves future checkpoints and final campaign transport, does not reset clock', t => {
  const dir = temporary(t), l = lock(dir, manifest(dir));
  assert(admitted(l, begin, begin + FOLLOWUP_JOB.setupMs, 102 * 60000, 3));
  assert(!admitted(l, begin, begin + 120 * 60000, 10 * 60000, 1));
  assert(!admitted(l, Date.parse(l.endUtc) - 60000, Date.parse(l.endUtc) - 60000, 1, 1));
});
test('F/A immutable templates convert offline without changing original solver/source or clock', t => {
  const dir = temporary(t);
  for (const dataset of ['F', 'A']) {
    const file = `tools/secondary-bench/prepared-20261005-transportfix/${dataset}_TEMPLATE.json`, before = sha256(fs.readFileSync(file));
    const m = convertFollowup(file, path.join(dir, dataset)), old = readJson(file), report = readJson(path.join(dir, dataset, 'EQUIVALENCE.json'));
    assert.equal(sha256(fs.readFileSync(file)), before); assert.deepEqual(m.inputs.commands, old.commands);
    assert(report.commandsIdentical && report.limitsIdentical && report.repeatsIdentical && report.policyIdentical && report.jobShapeIdentical);
    assert.equal(m.budget.maxParallel, FOLLOWUP_POLICY[dataset].maxParallel); assert.equal(m.budget.job.jobMs, SHAPE.jobMs);
    assert.equal(m.inputs.fixtures.length, dataset === 'F' ? 45 : 0); assert.equal(m.inputs.recovery.length, dataset === 'F' ? 191 : 0);
    assert.equal(m.approval, null); assert.equal(m.continuation, null);
    const syntheticCaptured = old.commands.map((c, i) => ({ id: 'capture-' + i, commandId: c.id, sha256: 'a'.repeat(64), trivial: false,
      fixture: { ...fixture('capture-' + i), origin: { command: c, filter: c.kind === 'per-save' ? 'T' : 'ALL' } } }));
    const imported = m.inputs.fixtures.map(f => ({ ...f, commandId: 'historical', trivial: false, fixture: { trivial: null } }));
    const l = { manifest: m, conditionHash: conditionHash(m) }; // Offline task equivalence does not authorize activation.
    const built = buildTasks(l, 'initial', { captured: syntheticCaptured, imported }, { rows: [] });
    const legacySelection = selectFollowup(old, syntheticCaptured, imported);
    const legacyTasks = makeFollowupTasks(old, 'basic', { ...legacySelection, imported }, []).tasks;
    assert.deepEqual(built.tasks.flatMap(t => t.calls).map(c => [c.inputId, c.variant, c.repeat, c.phase, c.limits]),
      legacyTasks.flatMap(t => t.calls).map(c => [c.inputId, c.engine, c.repeat, c.phase, c.limits]));
    assert.equal(built.tasks.flatMap(t => t.calls).length, dataset === 'F' ? 989 : 3300);
  }
});
test('quarantine isolates reaped OOM to one input/engine; unsafe reclamation prevents all later calls', async t => {
  for (const unsafe of [false, true]) {
    const dir = temporary(t), m = manifest(dir), l = lock(dir, m), pdir = path.join(dir, 'plan'), transport = client(dir);
    planStage(l, path.join(dir, 'no-history'), pdir, 'initial');
    let attempts = 0;
    await runChunk(path.join(pdir, 'chunks', '0'), path.join(dir, 'run'), transport, { jobStartedMs: begin, now: () => begin,
      scope: async () => { attempts++; return attempts === 1 ? { status: 'OOM', reaped: !unsafe, result: null } : exactScope(); } });
    const history = loadHistory(path.join(dir, 'uploaded'), m.campaignId);
    assert.equal(history.rows.length, 6); assert.equal(attempts, unsafe ? 1 : 5);
    assert.equal(history.rows.filter(r => r.status === (unsafe ? 'NOT_RUN_UNSAFE_OR_INVALID_RESULT' : 'NOT_RUN_AFTER_OOM')).length, unsafe ? 5 : 1);
  }
});
test('three worst-case tasks survive10min setup plus actual checkpoint clock costs', async t => {
  const dir = temporary(t), m = manifest(dir);
  const original = m.inputs.fixtures[0];
  for (let n = 1; n < 3; n++) {
    const file = path.join(dir, 'fixture-' + n + '.json'); writeJson(file, fixture('matrix-' + n));
    m.inputs.fixtures.push({ ...original, id: 'matrix-' + n, file: file.replaceAll('\\', '/'), sha256: sha256(fs.readFileSync(file)) });
  }
  const l = lock(dir, m), pdir = path.join(dir, 'plan'); planStage(l, path.join(dir, 'history'), pdir, 'initial');
  let elapsed = FOLLOWUP_JOB.setupMs, attempts = 0;
  const c = client(dir), timed = { uploadArtifact: async (...args) => { elapsed += FOLLOWUP_JOB.checkpointMs; return c.uploadArtifact(...args); } };
  await runChunk(path.join(pdir, 'chunks', '0'), path.join(dir, 'run'), timed, { jobStartedMs: begin, now: () => begin + elapsed,
    scope: async request => { attempts++; elapsed += worstCall(request.limits, m.budget.job); return exactScope(); } });
  assert.equal(attempts, 18);
});
test('byte mutation and duplicate distinct executions cannot be hidden by transport aliasing', async t => {
  const dir = temporary(t), part = path.join(dir, 'part'); fs.mkdirSync(part);
  fs.writeFileSync(path.join(part, 'raw.jsonl'), '{"campaignId":"x","executionAttemptId":"one","logicalCallId":"call","status":"OOM"}\n');
  await seal(part, { campaignId: 'x' }); assert(verifySnapshot(part));
  fs.appendFileSync(path.join(part, 'raw.jsonl'), 'x'); assert.throws(() => verifySnapshot(part));
});
test('native chunk checkpoints each task, retransmits bytes only, and independent audit finds no missing calls', async t => {
  const dir = temporary(t), m = manifest(dir), l = lock(dir, m), transport = client(dir), historyDir = path.join(dir, 'uploaded');
  fs.mkdirSync(historyDir); const stageRoot = path.join(dir, 'plans'); fs.mkdirSync(stageRoot);
  for (const stage of STAGES) {
    const dest = path.join(stageRoot, stage), p = planStage(l, historyDir, dest, stage);
    // Keep immutable stage plans in downloaded history, as the actual stage workflow does.
    fs.mkdirSync(path.join(historyDir, stage)); fs.copyFileSync(path.join(dest, 'STAGE_PLAN.json'), path.join(historyDir, stage, 'STAGE_PLAN.json'));
    for (let n = 0; n < p.chunks; n++) await runChunk(path.join(dest, 'chunks', String(n)), path.join(dir, 'run-' + stage + '-' + n), transport,
      { jobStartedMs: begin, now: () => begin, scope: exactScope });
  }
  const result = audit(l, historyDir, path.join(dir, 'audit'));
  assert.equal(result.validity, 'PASS'); assert.equal(result.expectedCalls, 6); assert.equal(result.performance, 'NOT_APPLICABLE');
  assert.equal(loadHistory(historyDir, m.campaignId).rows.length, 6);
  indexHistory(historyDir, m.campaignId);
  const archived = verifyArchive(historyDir, sha256(fs.readFileSync(path.join(historyDir, 'HISTORY_INDEX.json'))), m.campaignId, path.join(dir, 'archive-proof'));
  assert.equal(archived.state, 'ARCHIVE_VERIFIED');
});
test('lost acknowledgement creates alias pointer, immutable retry rejects changed bytes', async t => {
  const dir = temporary(t), part = path.join(dir, 'part'); fs.mkdirSync(part);
  fs.writeFileSync(path.join(part, 'raw.jsonl'), JSON.stringify({ campaignId: 'x', recordId: 'r', executionAttemptId: null, status: 'NOT_RUN_BUDGET' }) + '\n');
  const c = client(dir); let attempts = 0;
  const faulty = { uploadArtifact: async (...args) => { const r = await c.uploadArtifact(...args); if (++attempts === 1) throw Error('ACK_LOST'); return r; } };
  const receipt = path.join(dir, 'receipt.json'), id = { campaignId: 'x' }, profile = { retentionDays: 30 };
  assert.equal((await deliver(faulty, part, receipt, id, profile, 'checkpoint')).status, 'FAILED');
  assert.equal((await deliver(faulty, part, receipt, id, profile, 'checkpoint', true)).status, 'UPLOADED');
  const h = loadHistory(path.join(dir, 'uploaded'), 'x'); assert.equal(h.rows.length, 1); assert.equal(h.aliases.length, 1);
  fs.appendFileSync(path.join(part, 'raw.jsonl'), 'changed'); await assert.rejects(deliver(faulty, part, receipt, id, profile, 'checkpoint', true));
});
test('start without final raw is UNKNOWN; continuation cannot replay uncertain execution', async t => {
  const dir = temporary(t), m = manifest(dir), l = lock(dir, m), history = path.join(dir, 'history'); fs.mkdirSync(history);
  const part = path.join(history, 'part'); fs.mkdirSync(part);
  fs.writeFileSync(path.join(part, 'starts.jsonl'), JSON.stringify({ campaignId: m.campaignId, executionAttemptId: 'attempt', logicalCallId: 'call' }) + '\n');
  assert.equal(loadHistory(history, m.campaignId).unknown.length, 1); indexHistory(history, m.campaignId);
  const c = { ...m, continuation: { parentLock: path.join(dir, 'contract-1', 'LOCK.json'), parentLockSha256: sha256(fs.readFileSync(path.join(dir, 'contract-1', 'LOCK.json'))),
    history, historyIndexSha256: sha256(fs.readFileSync(path.join(history, 'HISTORY_INDEX.json'))) } };
  const next = lock(dir, c, 'contract-2', new Date(begin + 3600000).toISOString());
  assert.equal(next.originUtc, l.originUtc); assert.equal(next.endUtc, l.endUtc);
  assert.throws(() => planStage(next, history, path.join(dir, 'new-plan'), 'initial'), /incomplete history|unknown parent execution/);
});
test('empty/missing plans are different; zero observed calls cannot earn validity', t => {
  const dir = temporary(t), m = manifest(dir), l = lock(dir, m), history = path.join(dir, 'empty'); fs.mkdirSync(history);
  const r = audit(l, history, path.join(dir, 'report')); assert.equal(r.validity, 'FAIL'); assert.equal(r.missingStages.length, 4);
});
test('legacy reader preserves raw/line hash and original NOT_RUN/OOM evidence', t => {
  const dir = temporary(t), file = path.join(dir, 'raw.jsonl');
  const text = '{"callId":"old","sourceLock":"frozen","status":"OOM"}\r\n{"callId":"skipped","status":"NOT_RUN_AFTER_OOM"}\r\n';
  fs.writeFileSync(file, text); const r = readLegacy(dir);
  assert.equal(r[0].original.rawHash, sha256(Buffer.from(text))); assert.equal(r[1].original.line, 2); assert.equal(r[1].record.status, 'NOT_RUN_AFTER_OOM');
  assert.equal(fs.readFileSync(file, 'utf8'), text);
});
test('common adapter executes all three real engines on a tiny synthetic fixture in isolated processes', async t => {
  const dir = temporary(t), m = manifest(dir), l = lock(dir, m), pdir = path.join(dir, 'plan'), c = client(dir);
  planStage(l, path.join(dir, 'empty'), pdir, 'initial');
  await runChunk(path.join(pdir, 'chunks', '0'), path.join(dir, 'run'), c, { jobStartedMs: begin, now: () => begin,
    scope: request => runIsolated({ childFile: new URL('../tools/secondary-bench/child.mjs', import.meta.url), job: request.job,
      limits: request.limits, phaseLimits: request.phaseLimits }) });
  const h = loadHistory(path.join(dir, 'uploaded'), m.campaignId);
  assert.equal(h.rows.length, 6); assert(h.rows.every(r => r.status === 'EXACT'), JSON.stringify(h.rows.map(r => [r.variant, r.status, r.execution?.result?.error])));
  assert(h.rows.every(r => r.execution.reaped));
});
test('Bash clock is tested as executed, and common runtime has no unsupported composite timeout', t => {
  const dir = temporary(t), output = path.join(dir, 'output');
  const bash = process.platform === 'win32' ? path.resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '../../../bin/bash.exe') : '/bin/bash';
  const workflow = fs.readFileSync('.github/workflows/secondary-bench-common-stage.yml', 'utf8');
  const commandLine = workflow.match(/run: (echo "started=.+)/)[1];
  execFileSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', commandLine], { env: { ...process.env, GITHUB_OUTPUT: output.replaceAll('\\', '/') } });
  assert.match(fs.readFileSync(output, 'utf8'), /^started=\d+\s*$/);
  assert(!/^\s+timeout-minutes:/m.test(fs.readFileSync('tools/secondary-bench/common/runtime-action/action.yml', 'utf8')));
});
