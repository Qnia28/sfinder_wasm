import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FOLLOWUP_POLICY, SHAPE, validateFollowup, selectFollowup, retestDecision, makeFollowupTasks, packFollowup,
  runFollowupPart, followupHistory, fixtureMeta, lockedBytes, planFollowup, reportFollowup, taskCapacityMs, activateFollowup } from '../tools/secondary-bench/followup.mjs';
import { hash, identity, writeJson } from '../tools/secondary-bench/contracts.mjs';
import { ORTOOLS_PRIMARY_PARAMETERS } from '../src/ortools-min-cover.mjs';
import { isolatedScope } from '../tools/secondary-bench/followup-scope.mjs';
import { auditAllCollector } from '../tools/secondary-bench/collector-contract.mjs';
import { diskAdmission, requireDisk, materializeFixture } from '../tools/secondary-bench/followup-storage.mjs';
import { execFileSync } from 'node:child_process';
import { checkpoint, flushCheckpoints, transportDeadline } from '../tools/secondary-bench/followup-checkpoint.mjs';

const begin = Date.parse('2026-10-05T00:00:00Z');
const command = () => ({ id: 'synthetic/all/bag', kind: 'minimals', wantedSave: 'ALL', family: 'bag', pattern: '*!',
  sourceFumen: 'v115@9gwhQ4hlFewhR4glFewhg0Q4glFewhi0PeAgH', clear: 4, useHold: true,
  piecesNeeded: 6, queueLength: 7, savedPieceCount: 1, exactHumanQuality: 'true', primary: 'auto' });
const plan = (dataset = 'A') => ({ schema: 3, state: 'ACTIVE', dataset, policy: FOLLOWUP_POLICY[dataset], shape: SHAPE,
  initialRepeats: 2, retestRepeats: 2, retestThreshold: 1.10, exactHumanQuality: 'true', memoryMaxBytes: 3 * 1024 ** 3, swapMaxBytes: 0,
  solverThreads: { rustPrimary: 1, highsPrimary: 1, cpsatPrimary: 2, rustSecondary: 1, cpsatSecondary: 1 },
  campaignId: 'synthetic-followup', runId: '1', originUtc: new Date(begin).toISOString(),
  scheduleSeed: 'frozen', limits: { startupMs: 10000, callMs: FOLLOWUP_POLICY[dataset].callMs, reapMs: 5000 },
  commands: [dataset === 'A' ? command() : { ...command(), kind: 'per-save', wantedSave: undefined }],
  supplementIds: [], recovery: [], reusedBundle: null,
  sourceFiles: { 'tools/secondary-bench/followup.mjs': hash(lockedBytes('tools/secondary-bench/followup.mjs')) } });
const fixture = (id = 'matrix', c = command()) => ({ schema: 1, id, keys: ['a', 'b'], K: 1, seed: [0], rows: [[[0, 1], [1, 2]]],
  cardinalityProof: { status: 'PROVEN', backend: 'ortools', kernelStats: { cases: 200, solutions: 112, entries: 2200, forced: 0 } },
  primaryHard: true, origin: { command: c, filter: 'ALL' }, trivial: null });
const descriptor = f => { const bytes = Buffer.from(JSON.stringify(f)); return { id: f.id, fixture: f, bytes, sha256: hash(bytes), originalFile: 'synthetic' }; };
function temporary() { const root = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(); return fs.mkdtempSync(path.join(root, 'followup-contract-')); }
function removeOwned(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) removeOwned(f); else fs.unlinkSync(f); } fs.rmdirSync(dir); }

test('F8/A12 are independent VM caps, with unchanged primary2/secondary1 threads', () => {
  assert.equal(FOLLOWUP_POLICY.F.maxParallel + FOLLOWUP_POLICY.A.maxParallel, 20);
  assert.equal(ORTOOLS_PRIMARY_PARAMETERS.numWorkers, 2);
  assert.equal(validateFollowup(plan(), true).solverThreads.cpsatSecondary, 1);
  assert.throws(() => validateFollowup({ ...plan(), solverThreads: { cpsatPrimary: 1, cpsatSecondary: 1 } }, true));
  assert.throws(() => validateFollowup({ ...plan(), policy: { ...FOLLOWUP_POLICY.A, maxParallel: 16 } }, true));
  assert.throws(() => validateFollowup({ ...plan(), commands: [{ ...command(), wantedSave: 'T' }] }, true));
  assert(fs.readFileSync('src/ortools-min-cover.mjs', 'utf8').includes('await worker.terminate()'));
  assert(fs.readFileSync('src/cpsat-secondary-model.mjs', 'utf8').includes('numWorkers: 1'));
});
test('ALL selection includes all nontrivial matrices, including primaryHard; F chooses one per command', () => {
  const all = plan(), items = [descriptor(fixture('hard')), descriptor({ ...fixture('soft'), primaryHard: false }), descriptor({ ...fixture('trivial'), trivial: 'proof' })];
  assert.equal(selectFollowup(all, items, []).selected.length, 2);
  const f = plan('F'); const fitems = items.map(x => descriptor({ ...x.fixture, origin: { command: f.commands[0], filter: 'T' } }));
  assert.equal(selectFollowup(f, fitems, []).selected.length, 1);
  assert.equal(fixtureMeta(items[0].fixture).primaryThreads, 2); assert.equal(fixtureMeta(items[0].fixture).F, 0);
});
test('550 ALL blocks fit finite jobs and the256 matrix limit without dropping hard cases', () => {
  const p = plan(), fs0 = Array.from({ length: 550 }, (_, i) => descriptor(fixture('matrix-' + i)));
  const { tasks } = makeFollowupTasks(p, 'basic', { selected: fs0, imported: [] }, []);
  assert.equal(tasks.length, 550); assert.equal(tasks.reduce((s, t) => s + t.calls.length, 0), 3300);
  const chunks = packFollowup(tasks); assert.equal(chunks.length, 184);
  assert(chunks.every(c => c.tasks.length <= 3 && c.worstMs <= taskCapacityMs()));
  assert(chunks.every(c => c.worstMs + SHAPE.setupMs + c.tasks.length * SHAPE.checkpointMs + SHAPE.reserveMs <= SHAPE.jobMs));
  assert(SHAPE.jobMs < SHAPE.jobMinutes * 60000);
  assert(SHAPE.jobMs + SHAPE.finalTransportMs + SHAPE.transportAuditMs < SHAPE.jobMinutes * 60000);
  assert(SHAPE.jobMinutes < 360); assert(tasks.every(t => t.calls.every(c => c.limits.callMs === 300000)));
});
test('final flush retries failed checkpoints only, records backend receipts and never repeats a solver call', async () => {
  const dir = temporary(), results = path.join(dir, 'results'), states = path.join(dir, 'transport'), names = [];
  fs.mkdirSync(results);
  const client = { uploadArtifact: async name => { names.push(name); if (name === 'followup-results-basic-0-1-1') throw Error('network failure');
    return { id: names.length, digest: 'a'.repeat(64) }; } };
  try {
    for (let part = 0; part < 3; part++) {
      const p = path.join(results, 'part-' + part); fs.mkdirSync(p); fs.writeFileSync(path.join(p, 'raw.jsonl'), '{"part":' + part + '}\n');
      await checkpoint(client, p, `followup-results-basic-0-${part}-1`, path.join(states, `part-${part}.json`));
    }
    const report = await flushCheckpoints(client, results, states, 'followup-results-basic-0', { stage: 'basic', chunk: 0 });
    assert.equal(report.status, 'ALL_DURABLE'); assert.equal(report.solverCalls, 0);
    assert.deepEqual(names.slice(3), ['followup-results-basic-0-1-1-retry-1']);
    assert(report.parts.every(p => p.status === 'UPLOADED'));
    assert.equal(report.parts[1].attempts[1].artifactId, 4);
    assert.equal(report.parts[0].attempts.length, 1);
  } finally { removeOwned(dir); }
});
test('composite steps use native transport deadlines instead of unsupported timeout-minutes', () => {
  const text = fs.readFileSync('tools/secondary-bench/followup-run-action/action.yml', 'utf8');
  assert(!/^\s+timeout-minutes:/m.test(text));
  assert.equal([...text.matchAll(/timeout-seconds: '120'/g)].length, 3);
  assert(text.includes("timeout-seconds: '900'")); assert(text.includes("timeout-seconds: '180'"));
  for (const seconds of [120, 180, 900]) {
    let callback, ms, unref = false, exitCode;
    transportDeadline(seconds, { schedule: (fn, value) => { callback = fn; ms = value; return { unref: () => { unref = true; } }; }, exit: value => { exitCode = value; } });
    assert.equal(ms, seconds * 1000); assert(unref); callback(); assert.equal(exitCode, 1);
  }
  assert.throws(() => transportDeadline(0));
});
test('identical acknowledged-late upload copies retain alias pointers but do not duplicate measured calls', async () => {
  const dir = temporary(), p = plan(), source = path.join(dir, 'first'), retry = path.join(dir, 'retry'); fs.mkdirSync(source);
  const row = { campaignId: p.campaignId, sourceLock: identity(p.sourceFiles), callId: 'one-execution', status: 'TIMEOUT_CALL' };
  fs.writeFileSync(path.join(source, 'raw.jsonl'), JSON.stringify(row) + '\n');
  try {
    await checkpoint({ uploadArtifact: async () => { throw Error('acknowledgement lost'); } }, source, 'followup-results-basic-0-0-1', path.join(dir, 'state.json'));
    fs.mkdirSync(retry);
    for (const file of ['raw.jsonl', 'TRANSPORT_SNAPSHOT.json']) fs.copyFileSync(path.join(source, file), path.join(retry, file));
    const history = followupHistory(dir, p); assert.equal(history.rows.length, 1);
    assert.equal(history.warnings.length, 1); assert.equal(history.warnings[0].status, 'IDENTICAL_TRANSPORT_RETRY');
    fs.writeFileSync(path.join(retry, 'raw.jsonl'), JSON.stringify({ ...row, status: 'EXACT', ms: 12 }) + '\n');
    assert.throws(() => followupHistory(dir, p));
  } finally { removeOwned(dir); }
});
test('transport refuses changed checkpoint bytes and reports terminal unavailability without claiming durability', async () => {
  const dir = temporary(), results = path.join(dir, 'results'), part = path.join(results, 'part-0'), states = path.join(dir, 'transport');
  fs.mkdirSync(part, { recursive: true }); fs.writeFileSync(path.join(part, 'raw.jsonl'), 'original\n');
  const client = { uploadArtifact: async () => { throw Error('offline'); } };
  try {
    await checkpoint(client, part, 'followup-results-basic-0-0-1', path.join(states, 'part-0.json'));
    const r = await flushCheckpoints(client, results, states, 'followup-results-basic-0', { stage: 'basic', chunk: 0 });
    assert.equal(r.status, 'UNDELIVERED'); assert.equal(r.parts[0].attempts.length, 3);
    assert.equal(r.solverCalls, 0);
    fs.writeFileSync(path.join(part, 'raw.jsonl'), 'changed\n');
    await assert.rejects(flushCheckpoints(client, results, states, 'followup-results-basic-0', { stage: 'basic', chunk: 0 }), /checkpoint bytes changed/);
  } finally { removeOwned(dir); }
});
test('all three worst-case ALL tasks execute with10min setup and2min uploads, rather than losing task3', async () => {
  const dir = temporary(), bundle = path.join(dir, 'bundle'), p = plan(); fs.mkdirSync(bundle);
  const selected = ['one', 'two', 'three'].map(id => descriptor(fixture(id)));
  const tasks = makeFollowupTasks(p, 'basic', { selected, imported: [] }, []).tasks;
  const chunks = packFollowup(tasks); assert.equal(chunks.length, 1); assert.equal(chunks[0].worstMs, 102 * 60000);
  const descriptors = tasks.map(t => { fs.writeFileSync(path.join(bundle, t.fixture.id + '.json'), t.fixture.bytes);
    return { ...t, fixture: { path: t.fixture.id + '.json', sha256: t.fixture.sha256, metadata: fixtureMeta(t.fixture.fixture) } }; });
  writeJson(path.join(bundle, 'campaign.json'), p);
  writeJson(path.join(bundle, 'chunk.json'), { id: 0, stage: 'basic', sourceLock: identity(p.sourceFiles), tasks: descriptors });
  let elapsed = SHAPE.setupMs, calls = 0;
  const scope = async r => { calls++; elapsed += r.limits.startupMs + r.limits.callMs + 2 * r.limits.reapMs + SHAPE.scopeOverheadMs;
    return { status: 'TIMEOUT_CALL', reaped: true, result: null }; };
  try {
    for (let part = 0; part < 3; part++) {
      await runFollowupPart(bundle, path.join(dir, 'results', 'part-' + part), part, begin, { now: () => begin + elapsed, scope });
      elapsed += SHAPE.checkpointMs;
    }
    const { rows } = followupHistory(path.join(dir, 'results'), p);
    assert.equal(calls, 18); assert.equal(rows.length, 18); assert(rows.every(r => r.status === 'TIMEOUT_CALL'));
    assert(elapsed + SHAPE.reserveMs <= SHAPE.jobMs);
  } finally { removeOwned(dir); }
});
test('disk admission rejects insufficient space; same-volume payloads are hardlinks and cross-volume copies are checked', () => {
  assert(!diskAdmission(100, 90, 20).admitted); assert(diskAdmission(100, 80, 20).admitted);
  const dir = temporary();
  try {
    const source = path.join(dir, 'source'), target = path.join(dir, 'target'); fs.writeFileSync(source, 'fixture');
    const linked = materializeFixture(source, target, { bytes: () => { throw Error('must not read/copy'); }, size: 7 });
    assert.equal(linked.kind, 'HARDLINK'); assert.equal(fs.statSync(source).ino, fs.statSync(target).ino);
    assert.throws(() => materializeFixture(source, path.join(dir, 'blocked'), { bytes: () => { throw Error('must not copy'); }, size: 7,
      link: () => { const e = new Error('cross-volume'); e.code = 'EXDEV'; throw e; },
      storage: (directory, size) => requireDisk(directory, size, { available: () => 1, reserveBytes: 0 }) }), /INSUFFICIENT_DISK_SPACE/);
    assert(!fs.existsSync(path.join(dir, 'blocked')));
    assert.equal(materializeFixture(source, path.join(dir, 'copy'), { bytes: () => fs.readFileSync(source), size: 7,
      link: () => { const e = new Error('cross-volume'); e.code = 'EXDEV'; throw e; }, storage: () => {} }).kind, 'CHECKED_COPY');
  } finally { removeOwned(dir); }
});
test('ZIP guard rejects insufficient space and traversal before extraction, with real Python ZIP inspection', () => {
  const dir = temporary(), good = path.join(dir, 'good.zip'), bad = path.join(dir, 'bad.zip');
  try {
    execFileSync('python', ['-c', 'import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w") as z:z.writestr("fixtures/a.json","{}")\nwith zipfile.ZipFile(sys.argv[2],"w") as z:z.writestr("../escape","bad")', good, bad]);
    const extract = (archive, target, reserve) => execFileSync('python', ['tools/secondary-bench/followup-extract.py', archive, target, String(reserve)], { stdio: 'pipe' });
    assert.throws(() => extract(good, path.join(dir, 'no-space'), Number.MAX_SAFE_INTEGER), /INSUFFICIENT_DISK_SPACE/);
    assert(!fs.existsSync(path.join(dir, 'no-space')));
    assert.throws(() => extract(bad, path.join(dir, 'unsafe'), 0), /unsafe artifact member/);
    assert(!fs.existsSync(path.join(dir, 'unsafe')));
    const result = JSON.parse(extract(good, path.join(dir, 'valid'), 0)); assert(result.admitted && result.neededBytes >= 8192);
    assert.equal(fs.readFileSync(path.join(dir, 'valid', 'fixtures', 'a.json'), 'utf8'), '{}');
  } finally { removeOwned(dir); }
});
test('variance retest uses only two exact initial calls of that engine; never timeout/recovery imputation', () => {
  const rows = [10, 11].map((ms, i) => ({ inputId: 'x', engine: 'integrated', phase: 'INITIAL', repeat: i + 1, ms, status: 'EXACT' }));
  assert(retestDecision(rows, 'x', 'integrated').eligible); assert(!retestDecision(rows, 'x', 'threshold').eligible);
  assert(!retestDecision([...rows, { ...rows[0], phase: 'RECOVERY', ms: 10000 }], 'x', 'threshold').eligible);
  assert(!retestDecision([{ ...rows[0], status: 'TIMEOUT_CALL', ms: null }, rows[1]], 'x', 'integrated').eligible);
  assert.equal(retestDecision([{ ...rows[0], status: 'OOM', ms: null }, rows[1]], 'x', 'integrated').reason, 'OOM_QUARANTINE');
});
test('retest is engine-specific, repeats3/4, with a distinct phase and call IDs', () => {
  const p = plan(), selected = [descriptor(fixture())];
  const rows = [10, 12].map(ms => ({ inputId: 'matrix', engine: 'cpsat', phase: 'INITIAL', ms, status: 'EXACT' }));
  const { tasks, decisions } = makeFollowupTasks(p, 'retest', { selected, imported: [] }, rows);
  assert.equal(decisions.length, 3); assert.equal(tasks[0].calls.length, 2);
  assert(tasks[0].calls.every(c => c.engine === 'cpsat' && c.phase === 'VARIABILITY_RETEST'));
  assert.deepEqual(tasks[0].calls.map(c => c.repeat), [3, 4]);
});
test('an I OOM skips only its remaining repeat, not T/CP or a neighboring fixture', async () => {
  const dir = temporary(), bundle = path.join(dir, 'bundle'); fs.mkdirSync(bundle); const p = plan();
  const f = descriptor(fixture()); fs.writeFileSync(path.join(bundle, 'f.json'), f.bytes);
  const { tasks } = makeFollowupTasks(p, 'basic', { selected: [f], imported: [] }, []);
  const t = { ...tasks[0], fixture: { id: f.id, sha256: f.sha256, path: 'f.json', metadata: fixtureMeta(f.fixture) } };
  const neighbor = descriptor(fixture('neighbor')); fs.writeFileSync(path.join(bundle, 'neighbor.json'), neighbor.bytes);
  const other = makeFollowupTasks(p, 'basic', { selected: [neighbor], imported: [] }, []).tasks[0];
  const t2 = { ...other, fixture: { id: neighbor.id, sha256: neighbor.sha256, path: 'neighbor.json', metadata: fixtureMeta(neighbor.fixture) } };
  writeJson(path.join(bundle, 'campaign.json'), p); writeJson(path.join(bundle, 'chunk.json'), { id: 0, stage: 'basic', sourceLock: identity(p.sourceFiles), tasks: [t, t2] });
  let iCalls = 0, good = 0;
  const scope = async r => r.job.engine === 'integrated' && r.job.fixturePath.endsWith('f.json') ? (++iCalls, { status: 'OOM', reaped: true, result: null })
    : (++good, { status: 'EXACT', reaped: true, result: { responseMs: 20 } });
  try {
    await runFollowupPart(bundle, path.join(dir, 'results', 'part-0'), 0, begin, { now: () => begin, scope });
    const rows = fs.readFileSync(path.join(dir, 'results', 'part-0', 'raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(iCalls, 1); assert.equal(good, 4); assert.equal(rows.filter(r => r.status === 'NOT_RUN_AFTER_OOM').length, 1);
    assert(rows.filter(r => r.engine !== 'integrated').every(r => r.status === 'EXACT'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'results', 'CALL_QUARANTINE.json'))).fatal, null);
    await runFollowupPart(bundle, path.join(dir, 'results', 'part-1'), 1, begin, { now: () => begin, scope });
    assert.equal(iCalls, 1); assert.equal(good, 10);
  } finally { removeOwned(dir); }
});
test('whole block admission retains NOT_RUN_BUDGET records and never calls a scope after deadline', async () => {
  const dir = temporary(), p = plan(), bundle = path.join(dir, 'bundle'); fs.mkdirSync(bundle);
  const f = descriptor(fixture()), { tasks } = makeFollowupTasks(p, 'basic', { selected: [f], imported: [] }, []);
  writeJson(path.join(bundle, 'campaign.json'), p); writeJson(path.join(bundle, 'chunk.json'), { id: 0, stage: 'basic', sourceLock: identity(p.sourceFiles), tasks });
  try {
    await runFollowupPart(bundle, path.join(dir, 'results', 'part-0'), 0, begin, { now: () => begin + p.policy.overallMs, scope: async () => { throw new Error('must not execute'); } });
    const { rows } = followupHistory(path.join(dir, 'results'), p); assert.equal(rows.length, 6);
    assert(rows.every(r => r.status === 'NOT_RUN_BUDGET' && r.ms === null && r.rawLine > 0));
  } finally { removeOwned(dir); }
});
test('ordinary ALL adapter matches the production compact collector with synthetic geometry', () => {
  const geometry = new Uint32Array(17); for (let i = 0; i < 6; i++) geometry[i * 2] = 15; geometry[14] = 1;
  const solver = { height: 4, enumeratePcPattern: () => { throw new Error('compact path expected'); },
    enumeratePcPatternCompact: () => ({ count: 1, geometry, stride: 17, offsets: new Uint32Array([0, 1]), caseIds: new Uint32Array([0]), qualities: new Uint32Array([1]) }) };
  assert.equal(auditAllCollector(command(), solver).status, 'COLLECTOR_MATCH');
});
test('two separate workflows support dispatch or dedicated absent start markers, with8/12 maximums', () => {
  for (const [file, vm, group] of [['secondary-bench-followup-f.yml', 8, 'F'], ['secondary-bench-all-a.yml', 12, 'A']]) {
    const text = fs.readFileSync('.github/workflows/' + file, 'utf8');
    assert(text.includes('workflow_dispatch:'));
    assert(text.includes('paths: [.github/secondary-followup/' + group + '_START.json]'));
    const markerFile = '.github/secondary-followup/' + group + '_START.json';
    if (fs.existsSync(markerFile)) {
      const marker = JSON.parse(fs.readFileSync(markerFile)); assert.equal(marker.dataset, group);
      assert.equal(marker.confirm, 'RUN_APPROVED_FOLLOWUP'); assert(/^[a-f0-9]{64}$/.test(marker.templateSha256));
    }
    assert(text.includes('group: secondary-followup-' + group));
    const caps = [...text.matchAll(/max-parallel: (\d+)/g)].map(m => Number(m[1])); assert(caps.length >= 3); assert(caps.every(n => n === vm));
    assert(text.includes('github.run_attempt == 1'));
    assert(/if: always\(\)[\s\S]*name: followup-activation-diagnostics/.test(text));
    assert(text.includes('tee activation-diagnostics/contracts.log'));
    assert(text.includes('FOLLOWUP_SCOPE_DIAGNOSTICS: activation-diagnostics/scopes'));
    assert([...text.matchAll(/timeout-minutes: (\d+)/g)].some(m => Number(m[1]) === SHAPE.jobMinutes));
  }
});
test('every matrix job clock executes in real Bash; unquoted Date.now() regression is rejected', () => {
  const bash = process.platform === 'win32' ? path.resolve(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), '../../../bin/bash.exe') : '/bin/bash';
  assert(fs.existsSync(bash), 'real Bash is required for workflow clock contracts');
  const dir = temporary(), output = path.join(dir, 'GITHUB_OUTPUT');
  const run = line => {
    fs.writeFileSync(output, '');
    execFileSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', line],
      { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GITHUB_OUTPUT: output.replaceAll('\\', '/') } });
    return fs.readFileSync(output, 'utf8');
  };
  try {
    assert.throws(() => run('echo "started=$(node -p Date.now())" >> "$GITHUB_OUTPUT"'), /syntax error/);
    let count = 0;
    for (const file of ['secondary-bench-followup-f.yml', 'secondary-bench-all-a.yml']) {
      const text = fs.readFileSync('.github/workflows/' + file, 'utf8');
      for (const match of text.matchAll(/run: (echo "started=.+)/g)) {
        assert.match(run(match[1]), /^started=\d+\s*$/); count++;
      }
    }
    assert.equal(count, 7);
  } finally { removeOwned(dir); }
});
test('clock correction uses a new run without resetting the first invocation origin or budget', () => {
  const dir = temporary(), template = { ...plan(), state: 'PREPARED_NOT_DISPATCHED',
    continuation: { originalRunId: '37277545174', originalOriginUtc: '2026-10-05T07:24:17Z', executedDatasetCalls: 0 } };
  const filename = path.join(dir, 'template.json'); writeJson(filename, template);
  const event = process.env.GITHUB_EVENT_NAME; delete process.env.GITHUB_EVENT_NAME;
  try {
    const active = activateFollowup(filename, '2026-10-05T08:24:17Z', '9999', path.join(dir, 'active'));
    assert.equal(active.originUtc, template.continuation.originalOriginUtc);
    assert.equal(active.invocationCreatedUtc, '2026-10-05T08:24:17Z');
    assert.equal(active.policy.overallMs, template.policy.overallMs);
  } finally { if (event === undefined) delete process.env.GITHUB_EVENT_NAME; else process.env.GITHUB_EVENT_NAME = event; removeOwned(dir); }
});
test('planner payloads round-trip to calls and original-weighted witness report without ALL graph retention', async () => {
  const dir = temporary(), p = plan(), history = path.join(dir, 'history'), plans = path.join(dir, 'plans');
  fs.mkdirSync(path.join(history, 'capture', 'fixtures'), { recursive: true }); fs.mkdirSync(plans);
  const f = fixture(); writeJson(path.join(history, 'capture', 'fixtures', 'f.json'), f);
  const sourceLock = identity(p.sourceFiles);
  const diagnostic = ['one', 'two'].map(callId => ({ campaignId: p.campaignId, sourceLock, callId, action: 'collector-preflight', status: 'COLLECTOR_MATCH' }));
  const capture = { campaignId: p.campaignId, sourceLock, callId: 'capture-one', inputId: p.commands[0].id, action: 'capture', status: 'CAPTURED' };
  fs.writeFileSync(path.join(history, 'capture', 'raw.jsonl'), [...diagnostic, capture].map(JSON.stringify).join('\n') + '\n');
  const planFile = path.join(dir, 'campaign.json'); writeJson(planFile, p);
  try {
    const basic = path.join(plans, 'basic'), wave = planFollowup(planFile, history, basic, 'basic');
    assert.equal(wave.calls, 6); assert.equal(wave.decisions.length, 3);
    const stored = JSON.parse(fs.readFileSync(path.join(basic, 'STORAGE_COMPLETE.json')));
    assert.equal(stored.fixturesLinked, 1); assert.equal(stored.copiedBytes, 0);
    const scope = async () => ({ status: 'EXACT', reaped: true, result: { responseMs: 12,
      result: { keys: ['b'], qualityVector: [2], count: 1, completed: true, qualityComplete: true, tieComplete: true }, verified: { selected: [1] } } });
    await runFollowupPart(path.join(basic, 'chunks', '0'), path.join(history, 'basic', 'part-0'), 0, begin, { now: () => begin, scope });
    for (const [stage, expectedCalls] of [['preflight', diagnostic], ['capture', [capture]], ['retest', []]]) {
      const out = path.join(plans, stage); fs.mkdirSync(out);
      writeJson(path.join(out, 'WAVE_PLAN.json'), { campaignId: p.campaignId, sourceLock, stage, expectedCalls });
    }
    const r = reportFollowup(planFile, history, plans, path.join(dir, 'report'));
    assert.equal(r.witnessErrors.length, 0); assert.equal(r.plannedMissing.length, 0); assert.equal(r.missingStagePlans.length, 0);
    assert.equal(r.statuses.EXACT, 6); assert.equal(r.provenFixtures, 1);
    assert.equal(r.performancePass, 'NOT_APPLICABLE_INFORMATION_COLLECTION');
    assert.equal(r.auditStatus, 'INCOMPLETE'); // Mock history intentionally has no transport audit receipt.
    const record = fs.readFileSync(path.join(history, 'basic', 'part-0', 'raw.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    record[0].execution.result.result.qualityVector = [1];
    fs.writeFileSync(path.join(history, 'basic', 'part-0', 'raw.jsonl'), record.map(JSON.stringify).join('\n') + '\n');
    assert.equal(reportFollowup(planFile, history, plans, path.join(dir, 'bad-report')).auditStatus, 'FAIL');
  } finally { removeOwned(dir); }
});
test('failed planner retains machine-readable diagnostics even before a wave plan exists', () => {
  const dir = temporary(), p = plan(), history = path.join(dir, 'history'), output = path.join(dir, 'failed-plan');
  fs.mkdirSync(history); writeJson(path.join(dir, 'campaign.json'), p);
  try {
    assert.throws(() => execFileSync(process.execPath, ['tools/secondary-bench/followup.mjs', 'plan',
      path.join(dir, 'campaign.json'), history, output, 'basic'], { stdio: 'pipe' }), /BOX collector preflight missing/);
    const failure = JSON.parse(fs.readFileSync(path.join(output, 'FOLLOWUP_FAILURE.json')));
    assert.equal(failure.mode, 'plan'); assert.match(failure.error, /BOX collector preflight missing/);
    assert(!fs.existsSync(path.join(output, 'WAVE_PLAN.json')));
  } finally { removeOwned(dir); }
});
if (process.env.FOLLOWUP_LINUX_SCOPE_EXPECTED === '1') {
  test('real per-call OOM is contained; next independent scope still reaps normally', { timeout: 120000 }, async () => {
    let dir;
    if (process.env.FOLLOWUP_SCOPE_DIAGNOSTICS) {
      fs.mkdirSync(process.env.FOLLOWUP_SCOPE_DIAGNOSTICS, { recursive: true });
      dir = fs.mkdtempSync(path.join(path.resolve(process.env.FOLLOWUP_SCOPE_DIAGNOSTICS), 'linux-contract-'));
    } else dir = temporary();
    const request = (callId, file) => ({ callId, contractChildFile: file, job: {}, limits: { startupMs: 10000, callMs: 30000, reapMs: 5000 }, phaseLimits: {} });
    try {
      const oom = await isolatedScope(request('contract-oom', 'tests/helpers/secondary-bench-oom.mjs'), path.join(dir, 'oom'));
      assert.equal(oom.status, 'OOM'); assert(oom.reaped); assert.equal(oom.memoryScope.memoryMax, 3 * 1024 ** 3);
      const next = await isolatedScope({ ...request('contract-next', 'tests/helpers/secondary-bench-stall.mjs'), job: { mode: 'busy' },
        limits: { startupMs: 10000, callMs: 200, reapMs: 5000 } }, path.join(dir, 'next'));
      assert.equal(next.status, 'TIMEOUT_CALL'); assert(next.reaped);
    } finally { if (!process.env.FOLLOWUP_SCOPE_DIAGNOSTICS) removeOwned(dir); }
  });
}
