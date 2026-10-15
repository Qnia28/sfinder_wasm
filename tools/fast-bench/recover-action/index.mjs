import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const harness = path.resolve('harness'), product = path.resolve('product');
const continuation = JSON.parse(fs.readFileSync(path.join(harness, 'tools/fast-bench/CONTINUATION_38759068303.json')));
const client = (await import(pathToFileURL(path.join(harness, 'tools/secondary-bench/artifact-action/node_modules/@actions/artifact/lib/artifact.js')))).default;
process.chdir(product);
const { isolatedScope } = await import(pathToFileURL(path.join(product, 'tools/secondary-bench/followup-scope.mjs')));
const { seal, verifySnapshot } = await import(pathToFileURL(path.join(product, 'tools/secondary-bench/common/evidence.mjs')));
const mode = process.env.INPUT_MODE, shard = Number(process.env.INPUT_SHARD ?? 0), runId = process.env.GITHUB_RUN_ID;
const root = path.resolve('../fast-resume'); fs.mkdirSync(root, { recursive: true });
const read = p => JSON.parse(fs.readFileSync(p));
const hash = b => createHash('sha256').update(b).digest('hex');
const digest = v => hash(JSON.stringify(v));
const write = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v) + '\n', { flag: 'wx' }); };
const summary = text => { console.log(text); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n'); };
const transport = [];
async function hashFile(file) { const h = createHash('sha256'); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest('hex'); }
async function download(ref, directory) {
  assert(!fs.existsSync(directory));
  const start = performance.now();
  const zip = directory + '.zip';
  for (let attempt = 0; attempt < 3; attempt++) {
    const fd = fs.openSync(zip, 'wx');
    try {
      execFileSync('gh', ['api', `repos/Qnia28/sfinder_wasm/actions/artifacts/${ref.id}/zip`],
        { stdio: ['ignore', fd, 'pipe'], timeout: 180000 });
      fs.closeSync(fd);
      assert.equal(await hashFile(zip), ref.digest.replace(/^sha256:/, ''), 'backend ZIP hash');
      break;
    } catch (error) {
      try { fs.closeSync(fd); } catch {}
      transport.push({ id: ref.id, attempt, error: error.message });
      fs.rmSync(zip, { force: true });
      if (attempt === 2 || error.code === 'ERR_ASSERTION') throw error;
    }
  }
  execFileSync('python', [path.join(product, 'tools/secondary-bench/followup-extract.py'), zip, directory, String(1024 ** 3)], { stdio: 'inherit' });
  const snapshot = verifySnapshot(directory);
  if (ref.checkpointId) assert.equal(snapshot.checkpointId, ref.checkpointId);
  fs.unlinkSync(zip); transport.push({ direction: 'download', id: ref.id, ms: performance.now() - start });
}
async function upload(name, directory) {
  const start = performance.now(), snapshot = await seal(directory, { runId, parentRunId: continuation.parentRunId, name });
  const result = await client.uploadArtifact(name, [path.join(directory, 'SNAPSHOT.json'), ...snapshot.members.map(m => path.join(directory, m.path))],
    directory, { compressionLevel: 1, retentionDays: 30 });
  assert(result.id > 0 && /^[a-f0-9]{64}$/.test(result.digest));
  const ref = { id: result.id, digest: result.digest, checkpointId: snapshot.checkpointId, runId, name };
  transport.push({ direction: 'upload', ...ref, ms: performance.now() - start }); return ref;
}
async function originalPlan() {
  const dir = path.join(root, 'original-plan'); await download(continuation.planArtifact, dir);
  const plan = read(path.join(dir, 'PLAN.json'));
  assert.equal(plan.scheduleHash, continuation.scheduleHash);
  assert.equal(plan.lock.commit, continuation.sourceCommit);
  return plan;
}
function scalar(call, execution) {
  const r = execution.result;
  return { callId: call.callId, phase: call.phase, fixtureId: call.fixture?.id, arm: call.arm, repeat: call.repeat, trace: call.trace,
    status: execution.status, reaped: execution.reaped, wallMs: execution.wallMs, memoryScope: execution.memoryScope,
    policyMs: r?.policyMs, qualityExact: r?.qualityExact, qualityHash: r?.qualityVector ? digest(r.qualityVector) : null,
    keysHash: r?.keys ? digest([...r.keys].sort()) : null, states: r?.searchedStates, decision: r?.decision,
    outcomes: r?.outcomes ? Object.fromEntries(Object.entries(r.outcomes).map(([f, o]) => [f, { ...o,
      keys: undefined, selected: undefined, qualityVector: undefined,
      qualityHash: o.qualityVector ? digest(o.qualityVector) : null, keysHash: o.keys ? digest([...o.keys].sort()) : null }])) : null,
    executionRunId: runId, originalSourceCommit: continuation.sourceCommit };
}
async function measure(plan) {
  const allowed = new Set(continuation.chunks.find(c => c.shard === shard).callIds);
  assert.equal(process.version, plan.lock.node, 'runtime changed');
  for (const [p, h] of Object.entries(plan.lock.sources)) assert.equal(hash(fs.readFileSync(p)), h, 'original source changed ' + p);
  assert(Date.now() < continuation.deadlineMs, 'original campaign deadline exhausted');
  const chunk = plan.chunks[shard], records = [], checkpoints = [], oom = new Set();
  const seconds = chunk.tasks.flatMap(t => t.calls).filter(c => allowed.has(c.callId)).reduce((s, c) => s + c.reservationSeconds, 0);
  const end = Math.min(continuation.deadlineMs, Date.now() + (seconds + 900) * 1000);
  let stopped = null, n = 0, delta, bytes = 0, flushed = Date.now();
  const fresh = () => { delta = path.join(root, 'delta-' + n); fs.mkdirSync(delta); };
  fresh();
  const append = (name, row) => {
    const line = JSON.stringify(row) + '\n', fd = fs.openSync(path.join(delta, name), 'a');
    try { fs.writeSync(fd, line); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } bytes += Buffer.byteLength(line);
  };
  const flush = async force => {
    if (!force && bytes < 16 * 1024 ** 2 && Date.now() - flushed < 600000) return;
    if (!fs.readdirSync(delta).length) return;
    checkpoints.push(await upload(`fast-resume-${shard}-delta-${n}`, delta));
    fs.rmSync(delta, { recursive: true }); n++; bytes = 0; flushed = Date.now(); fresh();
  };
  append('environment.jsonl', { runId, source: continuation.sourceCommit, node: process.version,
    originUtc: continuation.originUtc, scheduleHash: plan.scheduleHash, shard });
  try {
    for (const task of chunk.tasks) {
      const calls = task.calls.filter(c => allowed.has(c.callId)); if (!calls.length) continue;
      const inputRoot = path.join(root, 'input');
      if (!stopped && task.capture?.inputArtifact) await download(task.capture.inputArtifact, inputRoot);
      for (const call of calls) {
        const key = (call.fixture?.id ?? task.command.id) + ':' + call.arm;
        let execution;
        if (stopped) execution = { status: 'NOT_RUN_INVALIDATED', reaped: true };
        else if (Date.now() + call.reservationSeconds * 1000 + 120000 > end) execution = { status: 'NOT_RUN_BUDGET', reaped: true };
        else if (task.capture?.status !== 'CAPTURED') execution = { status: 'NOT_RUN_CAPTURE_MISSING', reaped: true };
        else if (oom.has(key)) execution = { status: 'NOT_RUN_AFTER_OOM', reaped: true };
        else {
          const job = { mode: call.phase === 'e2e' ? 'e2e' : 'matrix', command: task.command, fixture: call.fixture,
            inputRoot, filters: task.capture.result.filters, arm: call.arm, trace: call.trace };
          append('starts.jsonl', { callId: call.callId, job, atUtc: new Date().toISOString() });
          execution = await isolatedScope({ callId: call.callId, contractChildFile: 'tools/fast-bench/child.mjs', job,
            limits: { startupMs: 30000, callMs: (call.reservationSeconds - 40) * 1000, reapMs: 5000 } }, path.join(delta, call.callId));
          append('raw.jsonl', { ...call, job, execution });
          if (execution.status === 'OOM') oom.add(key);
          if (!execution.reaped || !['RETURNED_EXACT', 'RETURNED_APPROX', 'RETURNED_EMPTY', 'TIMEOUT_CALL', 'TIMEOUT_STARTUP', 'OOM'].includes(execution.status))
            stopped = `${call.callId}: ${execution.status}: ${execution.result?.error ?? ''}`;
        }
        const row = scalar(call, execution); records.push(row); append('records.jsonl', row); await flush(false);
      }
      if (fs.existsSync(inputRoot)) fs.rmSync(inputRoot, { recursive: true });
    }
  } catch (error) { stopped = error.stack; append('failure.jsonl', { error: stopped }); }
  finally {
    await flush(true);
    const dir = path.join(root, 'summary');
    write(path.join(dir, 'SUMMARY.json'), { runId, shard, stopped, scheduleHash: plan.scheduleHash, records, checkpoints, transport });
    await upload(`fast-resume-summary-${shard}`, dir);
    summary(`## Fast resumed shard ${shard}: ${stopped ? 'STOPPED' : 'recorded'}\n${records.length}/${allowed.size} calls; original source and clock retained.\n${stopped ?? ''}`);
  }
  assert(!stopped, stopped); assert.equal(records.length, allowed.size);
}
async function audit(plan) {
  const parent = path.join(root, 'parent-analysis'); await download(continuation.analysisArtifact, parent);
  const priorAudit = read(path.join(parent, 'AUDIT.json'));
  const priorRows = gunzipSync(fs.readFileSync(path.join(parent, 'calls.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
  const rows = new Map([...priorRows, ...continuation.recoveredRecords].map(r => [r.callId, r]));
  const newRows = [], artifacts = [], errors = [];
  for (const c of continuation.chunks) {
    const name = `fast-resume-summary-${c.shard}`;
    const list = JSON.parse(execFileSync('gh', ['api', `repos/Qnia28/sfinder_wasm/actions/runs/${runId}/artifacts?name=${name}&per_page=20`], { encoding: 'utf8' }));
    const matches = list.artifacts.filter(a => a.name === name);
    if (matches.length !== 1) { errors.push({ shard: c.shard, error: 'missing summary' }); continue; }
    const dir = path.join(root, name); await download(matches[0], dir);
    const s = read(path.join(dir, 'SUMMARY.json')); assert.equal(s.scheduleHash, plan.scheduleHash);
    if (s.stopped) errors.push({ shard: c.shard, error: s.stopped });
    const allowed = new Set(c.callIds);
    if (s.records.length !== allowed.size || new Set(s.records.map(r => r.callId)).size !== allowed.size)
      errors.push({ shard: c.shard, error: 'continuation call count/identity mismatch' });
    for (const r of s.records) {
      assert(allowed.has(r.callId));
      assert(!rows.has(r.callId) || rows.get(r.callId).status.startsWith('NOT_RUN')
        || continuation.priorAttemptCallIds.includes(r.callId), 'unauthorized successful-call repeat');
      rows.set(r.callId, r); newRows.push(r);
    }
    artifacts.push(...s.checkpoints);
  }
  for (const id of continuation.excludedInterruptedBlockCalls) {
    if (!rows.has(id) || rows.get(id).status.startsWith('NOT_RUN')) {
      const c = plan.schedule.find(c => c.callId === id);
      rows.set(id, { callId: id, phase: c.phase, arm: c.arm, repeat: c.repeat, trace: c.trace, fixtureId: c.fixture?.id,
        status: continuation.unknownStartedCalls.includes(id) ? 'UNKNOWN_INTERRUPTED' : 'NOT_RUN_INTERRUPTED_BLOCK',
        reaped: null, previousStatus: rows.get(id)?.status ?? 'MISSING', reason: 'preserve same-VM paired-group rule; no repeats' });
    }
  }
  const missing = plan.schedule.filter(c => !rows.has(c.callId)).map(c => c.callId), statuses = {};
  for (const r of rows.values()) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  const pairs = new Map();
  for (const r of rows.values()) if (r.phase === 'trace' && r.status.startsWith('RETURNED')) {
    const key = r.fixtureId + ':' + r.arm + ':' + r.repeat; if (!pairs.has(key)) pairs.set(key, []); pairs.get(key).push(r);
  }
  for (const [key, p] of pairs) if (p.length === 2) for (const f of ['qualityHash', 'keysHash', 'states', 'decision', 'status'])
    if (p[0][f] !== p[1][f]) errors.push({ key, error: 'trace changes ' + f });
  const result = { schema: 2, runId, parentRunId: continuation.parentRunId, scheduleHash: plan.scheduleHash,
    status: errors.length || missing.length || [...rows.values()].some(r => /^(NOT_RUN|UNKNOWN|CANCELLED)/.test(r.status)) ? 'INCOMPLETE' : 'COLLECTION_COMPLETE',
    expected: plan.schedule.length, observed: rows.size, missing, statuses, errors,
    priorAuditStatus: priorAudit.status, historicalAnomalies: priorAudit.anomalies,
    originalSourceCommit: continuation.sourceCommit, originUtc: continuation.originUtc,
    authorizedPreviouslyStartedRemeasurements: continuation.priorAttemptCallIds.length, resumedCalls: newRows.length,
    authorization: continuation.authorization, budget: continuation.budget,
    artifactIndex: [...priorAudit.artifactIndex.map(a => ({ ...a, runId: continuation.parentRunId })), ...artifacts],
    recovered134: continuation.evidenceHashes,
    adjudication: 'Version2: user authorized whole interrupted-group remeasurement. Original attempts retained; latest complete groups used for paired comparisons. Original transport/reap-unknown failures are not rewritten.',
    performanceWinner: 'NOT_ADJUDICATED' };
  const dir = path.join(root, 'analysis'); write(path.join(dir, 'AUDIT.json'), result); write(path.join(dir, 'PLAN.json'), plan);
  write(path.join(dir, 'CONTINUATION.json'), continuation); write(path.join(dir, 'PARENT_AUDIT.json'), priorAudit);
  fs.copyFileSync(path.join(parent, 'calls.jsonl.gz'), path.join(dir, 'PARENT_CALLS.jsonl.gz'));
  const attempts = [...priorRows, ...continuation.recoveredRecords].map(r => ({ ...r, attemptRunId: continuation.parentRunId }));
  attempts.push(...continuation.unknownStartedCalls.map(callId => ({ callId, status: 'UNKNOWN_INTERRUPTED', attemptRunId: continuation.parentRunId })));
  attempts.push(...newRows.map(r => ({ ...r, attemptRunId: runId })));
  fs.writeFileSync(path.join(dir, 'ATTEMPTS.jsonl.gz'), gzipSync(attempts.map(r => JSON.stringify(r)).join('\n') + '\n'));
  fs.writeFileSync(path.join(dir, 'calls.jsonl.gz'), gzipSync([...rows.values()].map(r => JSON.stringify(r)).join('\n') + '\n'));
  await upload('fast-analysis-index', dir);
  summary(`## Fast continuation ${result.status}\n${newRows.length} calls; authorized previously-started remeasurements ${continuation.priorAttemptCallIds.length}.\nExpected ${result.expected}, accounted ${result.observed}, missing ${missing.length}, new validity errors ${errors.length}.\n\`\`\`json\n${JSON.stringify(statuses, null, 2)}\n\`\`\`\nAll original attempts are preserved separately. Censored outcomes are not completed timings.`);
  assert.equal(errors.length, 0); assert.equal(missing.length, 0);
}
try {
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'automatic workflow reruns forbidden');
  const plan = await originalPlan();
  if (mode === 'plan') {
    assert(Date.now() < continuation.deadlineMs);
    assert(continuation.budget.cumulativeConservativeHours < 1200);
    const total = continuation.chunks.reduce((n, c) => n + c.callIds.length, 0); assert.equal(total, continuation.resumeCalls);
    assert(new Set(continuation.chunks.flatMap(c => c.callIds)).size === total);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'matrix=' + JSON.stringify({ include: continuation.chunks.map(c => ({ shard: c.shard })) }) + '\n');
    summary(`## Resume frozen groups\n${total} calls / ${continuation.chunks.length} chunks, max16VM. Capture/completed groups reused; interrupted groups remeasured by explicit user instruction. Original origin ${continuation.originUtc}.\nCumulative reservation ${continuation.budget.cumulativeConservativeHours.toFixed(3)} runner-hours <1200.`);
  } else if (mode === 'measure') await measure(plan);
  else if (mode === 'audit') await audit(plan);
  else throw new Error('unknown recovery mode');
} catch (error) { summary('## Fast continuation failure\n```\n' + error.stack + '\n```'); throw error; }
