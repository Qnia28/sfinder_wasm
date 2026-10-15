import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { commandPlan, measurementPlan, digest } from '../planner.mjs';
import { isolatedScope } from '../../secondary-bench/followup-scope.mjs';
import { seal, verifySnapshot } from '../../secondary-bench/common/evidence.mjs';
import { hash } from '../../secondary-bench/contracts.mjs';
const client = (await import('../../secondary-bench/artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode = process.env.INPUT_MODE, shard = Number(process.env.INPUT_SHARD ?? 0);
const runId = process.env.GITHUB_RUN_ID;
assert(runId && process.platform === 'linux');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v) + '\n', { flag: 'wx' }); };
const summary = text => { console.log(text); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n'); };
const output = (key, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
const root = path.resolve('fast-work'); fs.mkdirSync(root, { recursive: true });
const scope = read('tools/fast-bench/SCOPE_20261015_v2.json');
const transport = [];
async function fetchArtifacts() {
  const pattern = process.env['INPUT_ARTIFACT-PREFIX'], destination = process.env.INPUT_DESTINATION;
  assert(pattern && destination);
  const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
    `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2, timeout: 120000 }));
  const wildcard = pattern.endsWith('*');
  const matches = pages.flatMap(p => p.artifacts).filter(a => wildcard ? a.name.startsWith(pattern.slice(0, -1)) : a.name === pattern);
  assert(matches.length && (wildcard || matches.length === 1), 'required artifact missing/ambiguous: ' + pattern);
  assert(matches.every(a => !a.expired));
  // Summary/plan downloads are intentionally small; no whole-history raw transfer.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, matches.length) }, async () => {
    while (next < matches.length) {
      const a = matches[next++], dir = wildcard ? path.join(destination, a.name) : destination;
      assert(!fs.existsSync(dir));
      await client.downloadArtifact(a.id, { path: dir }); verifySnapshot(dir);
    }
  }));
  summary(`Downloaded ${matches.length} indexed artifact(s) for ${pattern}; all REST pages enumerated, members verified.`);
}
async function upload(name, directory, compressed = false) {
  const start = performance.now();
  const snapshot = await seal(directory, { runId, name });
  const files = [path.join(directory, 'SNAPSHOT.json'), ...snapshot.members.map(m => path.join(directory, m.path))];
  const r = await client.uploadArtifact(name, files, directory, { compressionLevel: compressed ? 0 : 1, retentionDays: 30 });
  assert(r.id > 0 && /^[a-f0-9]{64}$/.test(r.digest), 'invalid upload receipt');
  const ref = { id: r.id, digest: r.digest, checkpointId: snapshot.checkpointId, name };
  transport.push({ ...ref, direction: 'upload', ms: performance.now() - start, bytes: snapshot.members.reduce((s, m) => s + m.bytes, 0) });
  return ref;
}
async function download(ref, destination) {
  const start = performance.now();
  assert(!fs.existsSync(destination));
  await client.downloadArtifact(ref.id, { path: destination });
  assert.equal(verifySnapshot(destination).checkpointId, ref.checkpointId);
  transport.push({ id: ref.id, direction: 'download', ms: performance.now() - start });
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? files(path.join(directory, e.name)) : [path.join(directory, e.name)]);
}
function loadSummaries(directory) { return files(directory).filter(f => path.basename(f) === 'SUMMARY.json').map(f => {
  verifySnapshot(path.dirname(f)); return read(f);
}); }
function sourceLock() {
  const names = execFileSync('git', ['ls-files', 'src', 'wasm', 'tools/fast-bench', 'tools/secondary-bench'], { encoding: 'utf8' }).trim().split('\n');
  return Object.fromEntries(names.map(p => [p, hash(fs.readFileSync(p))]));
}
function verifyLock(lock) {
  assert.equal(lock.runId, runId); assert.equal(lock.node, process.version);
  assert.equal(lock.scopeSha256, hash(fs.readFileSync('tools/fast-bench/SCOPE_20261015_v2.json')));
  for (const [p, h] of Object.entries(lock.sources)) assert.equal(hash(fs.readFileSync(p)), h, 'changed source ' + p);
  assert(Date.now() < lock.deadlineMs, '96-hour campaign deadline');
}
async function boot() {
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'do not rerun campaign; explicit continuation required');
  const commands = commandPlan(scope), now = Date.now();
  const lock = { schema: 1, study: scope.study, runId, originUtc: new Date(now).toISOString(), deadlineMs: now + 96 * 3600000,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version, sources: sourceLock(), scopeSha256: hash(fs.readFileSync('tools/fast-bench/SCOPE_20261015_v2.json')),
    runner: { os: os.release(), cpu: os.cpus()[0].model }, commandPlanHash: digest(commands),
    approval: 'User: 본 벤치 실행까지 완료하라; separate branch; maximum16VM',
    resourceCaps: scope.resourceCaps, preflight: { runId: '38755030086', units: 30, recoveryRunId: '38755431827', runnerSeconds: 62,
      currentCollectorUnits: 12, totalPreflightUnits: 42 },
    reservedHours: scope.totalReservationHours, maxCaptureChunks: 32,
    semantics: { staticEquivalentSkipping: false, sameVMWholeFixtureRepeats: true,
      inputEncoding: 'gzip original rows with duplicates; representation retained',
      e2eInternalTrace: 'OFF; unavailable public metadata recorded UNOBSERVED',
      audit: 'worker original-row verification plus global schedule/receipts; raw retained in delta artifacts' } };
  assert(lock.reservedHours <= 1200);
  const dir = path.join(root, 'bootstrap'); write(path.join(dir, 'LOCK.json'), lock); write(path.join(dir, 'COMMANDS.json'), commands);
  // Real collector/public-API compatibility: this prevents a synthetic-only gate.
  // Twelve calls use the already reserved preflight64 allowance, not population repeats.
  const grace = commands.captures.find(c => c.population === 'regression');
  const perSave = commands.captures.find(c => c.population === 'per-save' && c.mirrorGroup === grace.mirrorGroup && c.family === 'bag');
  const edge = commands.captures.find(c => c.population === 'edge' && c.kind === 'per-save');
  assert(grace && perSave && edge);
  let calls = 0;
  async function check(job, seconds) {
    const callId = 'collector-contract-' + calls++;
    const r = await isolatedScope({ callId, contractChildFile: 'tools/fast-bench/child.mjs', job,
      limits: { startupMs: 30000, callMs: (seconds - 40) * 1000, reapMs: 5000 },
      ...(job.mode === 'capture' ? { phaseLimits: { enumeration: 60000 } } : {}) }, path.join(root, callId));
    assert(r.reaped && ['CAPTURED', 'RETURNED_EMPTY', 'RETURNED_EXACT', 'RETURNED_APPROX'].includes(r.status),
      `${callId}: ${r.status}; ${r.result?.error ?? ''}`);
    return r.result;
  }
  for (const command of [grace, perSave, edge]) {
    const inputRoot = path.join(root, 'preflight-input-' + command.captureIndex);
    const captured = await check({ mode: 'capture', command, fixtureDir: inputRoot }, 340);
    if (command === grace) {
      assert.equal(captured.filters[0].K, 45, 'GRACE historical primary regression');
      for (const arm of ['BASE100', 'B40', 'DIRECT']) await check({ mode: 'matrix', inputRoot, fixture: captured.filters[0], arm, trace: true }, 100);
    }
    const arms = command === grace ? ['BASE100', 'B40', 'DIRECT'] : command === perSave ? ['BASE100', 'DIRECT'] : ['BASE100'];
    for (const arm of arms) await check({ mode: 'e2e', command, inputRoot, filters: captured.filters, arm, trace: false }, 220);
  }
  assert.equal(calls, 12);
  write(path.join(dir, 'COLLECTOR_CONTRACTS.json'), { status: 'PASS', units: calls });
  await upload('fast-bootstrap', dir);
  summary(`## Fast main campaign authorized\n1113 captures, <=16 concurrent VMs, <=1200 runner-hours, origin ${lock.originUtc}.\nPreflight42 units charged (30 previous +12 collector/API); no automatic reruns.`);
}

function scalar(call, result) {
  const r = result.result;
  return { callId: call.callId, phase: call.phase, fixtureId: call.fixture?.id, arm: call.arm, repeat: call.repeat, trace: call.trace,
    status: result.status, reaped: result.reaped, wallMs: result.wallMs, memoryScope: result.memoryScope,
    policyMs: r?.policyMs, qualityExact: r?.qualityExact,
    qualityHash: r?.qualityVector ? digest(r.qualityVector) : null, keysHash: r?.keys ? digest([...r.keys].sort()) : null,
    states: r?.searchedStates, decision: r?.decision,
    outcomes: r?.outcomes ? Object.fromEntries(Object.entries(r.outcomes).map(([f, o]) => [f, {
      ...o, keys: undefined, selected: undefined, qualityVector: undefined,
      qualityHash: o.qualityVector ? digest(o.qualityVector) : null, keysHash: o.keys ? digest([...o.keys].sort()) : null }])) : null };
}
async function worker(lock, commands, chunk) {
  verifyLock(lock);
  const isCapture = mode === 'capture', records = [], checkpoints = [], started = Date.now();
  const workReservation = isCapture ? commands.captures.filter(c => c.captureIndex % 32 === shard).length * 340 : chunk.reservationSeconds;
  // Reserved control allowance: capture300s/chunk, measure900s/chunk.
  const end = Math.min(lock.deadlineMs, started + (workReservation + (isCapture ? 300 : 900)) * 1000);
  let deltaIndex = 0, delta, lastFlush = Date.now(), localBytes = 0, stopped = null;
  const newDelta = () => { delta = path.join(root, `delta-${deltaIndex}`); fs.mkdirSync(delta); };
  newDelta();
  const append = (name, value) => {
    const line = JSON.stringify(value) + '\n', fd = fs.openSync(path.join(delta, name), 'a');
    try { fs.writeSync(fd, line); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    localBytes += Buffer.byteLength(line);
  };
  async function flush(force = false) {
    if (!force && Date.now() - lastFlush < 600000 && localBytes < 16 * 1024 ** 2) return;
    if (!fs.readdirSync(delta).length) return;
    const ref = await upload(`fast-${mode}-${shard}-delta-${deltaIndex}`, delta);
    checkpoints.push(ref); fs.rmSync(delta, { recursive: true }); deltaIndex++; lastFlush = Date.now(); localBytes = 0; newDelta();
  }
  const environment = { node: process.version, cpu: os.cpus()[0].model, cores: os.cpus().length,
    release: os.release(), runId, shard, mode, commit: lock.commit, startedUtc: new Date().toISOString() };
  append('environment.jsonl', environment);
  const admissible = seconds => !stopped && Date.now() + seconds * 1000 + 120000 < end;
  async function run(call, job, seconds) {
    if (!admissible(seconds)) return { status: stopped ? 'NOT_RUN_INVALIDATED' : 'NOT_RUN_BUDGET', reaped: true };
    const disk = fs.statfsSync(root); assert(disk.bavail * disk.bsize >= 1024 ** 3, 'disk reserve exhausted');
    append('starts.jsonl', { callId: call.callId, job, atUtc: new Date().toISOString() });
    const result = await isolatedScope({ callId: call.callId, contractChildFile: 'tools/fast-bench/child.mjs', job,
      limits: { startupMs: 30000, callMs: (seconds - 40) * 1000, reapMs: 5000 },
      ...(isCapture ? { phaseLimits: { enumeration: 60000 } } : {}) }, path.join(delta, call.callId));
    append('raw.jsonl', { ...call, job, execution: result });
    if (!result.reaped || !['CAPTURED', 'RETURNED_EMPTY', 'RETURNED_EXACT', 'RETURNED_APPROX', 'OOM',
      'TIMEOUT_CALL', 'TIMEOUT_STARTUP', 'TIMEOUT_PHASE_ENUMERATION'].includes(result.status)) {
      stopped = `${call.callId}: ${result.status}: ${result.result?.error ?? 'scope/validity failure'}`;
      console.error(stopped);
    }
    return result;
  }
  try {
    if (isCapture) {
      for (const command of commands.captures.filter(c => c.captureIndex % 32 === shard)) {
        const call = { callId: 'capture-' + command.captureIndex, phase: 'capture' };
        const fixtureDir = path.join(root, 'input-' + command.captureIndex);
        const result = await run(call, { mode: 'capture', command, fixtureDir }, 340);
        let inputArtifact = null;
        if (fs.existsSync(fixtureDir)) {
          write(path.join(fixtureDir, 'CAPTURE.json'), { command, result: result.result ?? null, status: result.status });
          inputArtifact = await upload(`fast-input-${command.captureIndex}`, fixtureDir, true);
          fs.rmSync(fixtureDir, { recursive: true });
        }
        const record = { command, status: result.status, result: result.result, inputArtifact, reaped: result.reaped };
        records.push(record); append('records.jsonl', record); await flush();
      }
    } else {
      for (const task of chunk.tasks) {
        const inputRoot = path.join(root, 'input-cache');
        const available = task.capture?.status === 'CAPTURED' && task.capture.inputArtifact;
        if (available && !stopped) await download(task.capture.inputArtifact, inputRoot);
        const oom = new Set();
        for (const call of task.calls) {
          const key = (call.fixture?.id ?? task.command.id) + ':' + call.arm;
          let result;
          if (!available) result = { status: 'NOT_RUN_CAPTURE_MISSING', reaped: true };
          else if (oom.has(key)) result = { status: 'NOT_RUN_AFTER_OOM', reaped: true };
          else result = await run(call, { mode: call.phase === 'e2e' ? 'e2e' : 'matrix',
            command: task.command, fixture: call.fixture, inputRoot,
            filters: task.capture.result.filters, arm: call.arm, trace: call.trace }, call.reservationSeconds);
          if (result.status === 'OOM') oom.add(key);
          const record = scalar(call, result); records.push(record); append('records.jsonl', record);
          await flush();
        }
        if (fs.existsSync(inputRoot)) fs.rmSync(inputRoot, { recursive: true });
      }
    }
  } catch (error) { stopped = error.stack; append('failure.jsonl', { error: stopped }); }
  finally {
    // Failure of flush/publish fails the job; never claim undelivered records durable.
    await flush(true);
    const dir = path.join(root, 'summary');
    write(path.join(dir, 'SUMMARY.json'), { runId, mode, shard, environment, stopped, records, checkpoints, transport,
      elapsedMs: Date.now() - started, planHash: chunk?.scheduleHash ?? lock.commandPlanHash });
    await upload(`fast-${mode}-summary-${shard}`, dir);
    summary(`## Fast ${mode} ${shard}: ${stopped ? 'INVALID / STOPPED' : 'recorded'}\nRecords ${records.length}; checkpoints ${checkpoints.length}.\n${stopped ? '```\n' + stopped + '\n```' : 'Original outcomes retained; censoring is not a performance win.'}`);
  }
  assert(!stopped, stopped);
}

async function plan(lock, commands) {
  verifyLock(lock);
  const summaries = loadSummaries('capture-summaries');
  assert.equal(summaries.length, 32); assert(summaries.every(s => !s.stopped && s.runId === runId));
  const records = summaries.flatMap(s => s.records);
  assert.equal(records.length, 1113); assert.equal(new Set(records.map(r => r.command.captureIndex)).size, 1113);
  const plan = measurementPlan(scope, commands, records);
  assert(plan.reservationSeconds / 3600 + 1113 * 340 / 3600 + 64 * 340 / 3600 + 100 <= 1200);
  assert(32 * 300 + plan.chunks.length * 900 + 3 * 1800 + 62 < 100 * 3600, 'control reservation exceeds100h');
  plan.lock = lock;
  const dir = path.join(root, 'plan'); write(path.join(dir, 'PLAN.json'), plan);
  write(path.join(dir, 'CAPTURE_SUMMARIES.json'), summaries);
  await upload('fast-measurement-plan', dir);
  output('matrix', JSON.stringify({ include: plan.chunks.map(c => ({ shard: c.index })) }));
  summary(`## Frozen Fast schedule\n${plan.selection.main.length} main matrices, ${plan.selection.supplemental.length} supplemental, ${plan.selection.trace.length} trace.\n${plan.schedule.length} calls, ${plan.chunks.length} chunks; max-parallel16.\nSchedule SHA256: ${plan.scheduleHash}`);
}

async function audit(plan) {
  const summaries = loadSummaries('measure-summaries'), rows = summaries.flatMap(s => s.records), expected = new Map(plan.schedule.map(c => [c.callId, c]));
  const seen = new Set(), anomalies = [], statuses = {};
  for (const s of summaries) {
    if (s.stopped) anomalies.push({ shard: s.shard, error: s.stopped });
    if (s.runId !== runId || s.planHash !== plan.scheduleHash) anomalies.push({ shard: s.shard, error: 'foreign plan' });
  }
  for (const r of rows) {
    if (!expected.has(r.callId) || seen.has(r.callId)) anomalies.push({ callId: r.callId, error: 'foreign/duplicate call' });
    seen.add(r.callId); statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    if (!r.reaped) anomalies.push({ callId: r.callId, error: 'not reaped' });
  }
  const missing = [...expected.keys()].filter(id => !seen.has(id));
  const trace = new Map();
  for (const row of rows.filter(r => r.phase === 'trace')) {
    const key = row.fixtureId + ':' + row.arm + ':' + row.repeat;
    if (!trace.has(key)) trace.set(key, []); trace.get(key).push(row);
  }
  for (const [key, pair] of trace) {
    if (pair.length === 2 && pair.every(r => r.status.startsWith('RETURNED'))) {
      for (const field of ['status', 'qualityHash', 'keysHash', 'states', 'decision'])
        if (pair[0][field] !== pair[1][field]) anomalies.push({ key, error: 'trace changed ' + field });
    }
  }
  const artifactIndex = summaries.flatMap(s => s.checkpoints);
  const report = { runId, scheduleHash: plan.scheduleHash, expected: expected.size, observed: rows.length, missing, statuses, anomalies,
    status: anomalies.length ? 'INVALID' : missing.length || rows.some(r => r.status.startsWith('NOT_RUN')) ? 'INCOMPLETE' : 'COLLECTION_COMPLETE',
    performanceWinner: 'NOT_ADJUDICATED', artifactIndex,
    captureSummaryArtifacts: 'fast-capture-summary-*', selectedInputs: plan.selection.main.map(f => ({ id: f.id, artifact: f.inputArtifact, sha256: f.sha256 })),
    auditContract: 'Original-row witnesses verified per worker; global call/trace reconciliation; raw delta artifacts retained separately' };
  const dir = path.join(root, 'analysis'); write(path.join(dir, 'AUDIT.json'), report);
  write(path.join(dir, 'PLAN.json'), plan);
  fs.writeFileSync(path.join(dir, 'calls.jsonl.gz'), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n', { level: 1 }));
  write(path.join(dir, 'TRANSPORT.json'), summaries.map(s => ({ shard: s.shard, transport: s.transport })));
  fs.writeFileSync(path.join(dir, 'README_KO.md'), '# Fast 개발 벤치 자료\n\nAUDIT.json의 상태/누락을 먼저 확인한다. calls.jsonl.gz는 scalar 색인이며 완전한 seed/품질/원행렬은 PLAN의 입력 artifact 및 AUDIT.artifactIndex의 raw delta에 보존된다. exact와 approximate를 분리하고, 원본 hash를 검증한다. 이 자료는 fresh holdout이 아니다. 평균만으로 정책을 채택하지 않는다.\n');
  await upload('fast-analysis-index', dir);
  summary(`## Fast collection ${report.status}\nExpected ${expected.size}, observed ${rows.length}, missing ${missing.length}, anomalies ${anomalies.length}.\n\`\`\`json\n${JSON.stringify(statuses, null, 2)}\n\`\`\`\nThis is collection status, not a policy recommendation.`);
  assert.equal(anomalies.length, 0, 'invalid measurements; see analysis index');
}

try {
  if (mode === 'fetch') await fetchArtifacts();
  else if (mode === 'bootstrap') await boot();
  else if (mode === 'audit') await audit(read('plan/PLAN.json'));
  else {
    const lock = read('bootstrap/LOCK.json'), commands = read('bootstrap/COMMANDS.json');
    if (mode === 'capture') await worker(lock, commands, null);
    else if (mode === 'plan') await plan(lock, commands);
    else if (mode === 'measure') {
      const plan = read('plan/PLAN.json'); assert.equal(plan.scheduleHash, digest(plan.schedule));
      await worker(lock, commands, { ...plan.chunks[shard], scheduleHash: plan.scheduleHash });
    } else throw new Error('invalid campaign mode');
  }
} catch (error) { summary('## Fast campaign failure\n```\n' + error.stack + '\n```'); throw error; }
