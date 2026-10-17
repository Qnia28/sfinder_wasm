// Transport-only continuation. The measured product/child remains pinned to
// the parent commit in a separate checkout; original sources are hash-checked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const harness = path.resolve('harness'), product = path.resolve('product');
const manifest = JSON.parse(fs.readFileSync(path.join(harness, 'tools/fast-routing/CONTINUATION_39026013968.json')));
const client = (await import(pathToFileURL(path.join(harness, 'tools/secondary-bench/artifact-action/node_modules/@actions/artifact/lib/artifact.js')))).default;
process.chdir(product);
const { isolatedScope } = await import(pathToFileURL(path.join(product, 'tools/secondary-bench/followup-scope.mjs')));
const { seal, verifySnapshot } = await import(pathToFileURL(path.join(product, 'tools/secondary-bench/common/evidence.mjs')));
const [mode, shardText] = process.argv.slice(2), shard = Number(shardText), runId = process.env.GITHUB_RUN_ID;
assert.equal(process.platform, 'linux'); assert.equal(process.env.GITHUB_REPOSITORY, 'Qnia28/sfinder_wasm');
assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'preserve this attempt; no workflow retry');
const hash = b => createHash('sha256').update(b).digest('hex'), digest = v => hash(JSON.stringify(v));
const read = p => JSON.parse(fs.readFileSync(p));
const root = path.resolve('../routing-resume'); fs.mkdirSync(root, { recursive: false });
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value) + '\n', { flag: 'wx' });
const summary = text => { console.log(text); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n'); };
const transport = [];
// Installation quota is shared across runs: a new workflow does not reset it.
// Wait against GitHub's declared reset once, before admitting measurement VMs.
if (mode === 'plan') {
  for (let attempt = 0; attempt < 2; attempt++) {
    const quota = JSON.parse(execFileSync('gh', ['api', 'rate_limit'], { encoding: 'utf8', timeout: 30000 })).resources.core;
    assert(Number.isFinite(quota.remaining) && Number.isFinite(quota.reset));
    write(`QUOTA-${attempt}.json`, { ...quota, observedUtc: new Date().toISOString() });
    if (quota.remaining >= 400) break;
    assert.equal(attempt, 0, 'insufficient quota after reset; preserve evidence');
    const waitMs = Math.max(1000, quota.reset * 1000 - Date.now() + 15000);
    assert(waitMs <= 3700000 && Date.now() + waitMs < manifest.deadlineMs, 'quota wait exceeds original clock');
    summary(`Installation quota ${quota.remaining}; waiting until ${new Date(Date.now() + waitMs).toISOString()} before downloads. No measurement calls started.`);
    await delay(waitMs);
  }
}
async function hashFile(file) { const h = createHash('sha256'); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest('hex'); }
async function download(ref, destination) {
  const archive = destination + '.zip', fd = fs.openSync(archive, 'wx');
  const start = performance.now();
  try { execFileSync('gh', ['api', `repos/Qnia28/sfinder_wasm/actions/artifacts/${ref.id}/zip`],
    { stdio: ['ignore', fd, 'pipe'], timeout: 180000 }); } finally { fs.closeSync(fd); }
  assert.equal(await hashFile(archive), ref.digest.replace(/^sha256:/, ''), 'archive digest');
  execFileSync('python', [path.join(product, 'tools/secondary-bench/followup-extract.py'), archive, destination, String(1024 ** 3)], { stdio: 'inherit' });
  const snapshot = verifySnapshot(destination);
  if (ref.checkpointId) assert.equal(snapshot.checkpointId, ref.checkpointId);
  fs.unlinkSync(archive); transport.push({ direction: 'download', artifactId: ref.id, ms: performance.now() - start });
}
async function upload(name, directory) {
  const snapshot = await seal(directory, { runId, parentRunId: manifest.parentRunId, name });
  const result = await client.uploadArtifact(name, [path.join(directory, 'SNAPSHOT.json'), ...snapshot.members.map(m => path.join(directory, m.path))],
    directory, { compressionLevel: 1, retentionDays: 30 });
  assert(result.id > 0 && /^[a-f0-9]{64}$/.test(result.digest));
  return { id: result.id, digest: result.digest, checkpointId: snapshot.checkpointId, name, runId };
}
function scalar(call, execution) {
  const r = execution.result;
  return { ...call, status: execution.status, reaped: execution.reaped, wallMs: execution.wallMs, memoryScope: execution.memoryScope,
    policyMs: r?.policyMs, apiMs: r?.apiMs, outcomes: r?.outcomes ? Object.fromEntries(Object.entries(r.outcomes).map(([f, o]) => [f, {
      ...o, keys: undefined, selected: undefined, qualityVector: undefined,
      fastTelemetry: o.fastTelemetry ? { ...o.fastTelemetry, stages: o.fastTelemetry.stages.map(s => ({ ...s, keys: undefined, inputKeys: undefined, qualityVector: undefined })) } : null,
      qualityHash: o.qualityVector ? digest(o.qualityVector) : null, keysHash: o.keys ? digest([...o.keys].sort()) : null }])) : null,
    executionRunId: runId, originalSourceCommit: manifest.sourceCommit };
}
const planDirectory = path.join(root, 'original-plan'); await download(manifest.planArtifact, planDirectory);
const plan = read(path.join(planDirectory, 'PLAN.json'));
assert.equal(digest(plan.schedule), manifest.scheduleHash); assert.equal(plan.scheduleHash, manifest.scheduleHash);
assert.equal(plan.lock.commit, manifest.sourceCommit); assert.equal(plan.lock.deadlineMs, manifest.deadlineMs);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), manifest.sourceCommit);
if (process.version !== plan.lock.node) summary(`## Runtime mismatch before measurement\nActual ${process.version}, original lock ${plan.lock.node}. No population calls admitted.`);
assert.equal(process.version, plan.lock.node, 'continuation must match actual parent action runtime, not parent setup-node configuration');
for (const [file, expected] of Object.entries(plan.lock.sources)) assert.equal(hash(fs.readFileSync(file)), expected, file);
assert(Date.now() < manifest.deadlineMs, 'original clock exhausted');
// Additional 2h conservatively covers failed plan39029765625 and this
// pre-measurement quota wait. Original 96h deadline is never extended.
const cumulativeHours = manifest.budget.cumulativeConservativeHours + 2;
assert(cumulativeHours <= 1200, 'cumulative budget');
if (mode === 'plan') {
  assert.equal(manifest.chunks.reduce((n, c) => n + c.callIds.length, 0), manifest.resumeCalls);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'matrix=' + JSON.stringify({ include: manifest.chunks.map(c => ({ shard: c.shard })) }) + '\n');
  write('CONTINUATION.json', manifest);
  write('ADDITIONAL_CONTROL_BUDGET.json', { failedPlanRunId: '39029765625', extraControlReservationHours: 2, cumulativeHours });
  summary(`## Routing transport continuation\n${manifest.resumeCalls} calls in ${manifest.chunks.length} chunks; original product, limits, clock and schedule retained.\nCompleted command blocks reused; interrupted command blocks run whole on one VM. Earlier attempts retained. Cumulative reservation ${cumulativeHours.toFixed(3)} hours.`);
} else {
  assert.equal(mode, 'measure');
  const selected = manifest.chunks.find(c => c.shard === shard); assert(selected);
  const allowed = new Set(selected.callIds), chunk = plan.chunks[shard];
  const calls = chunk.tasks.flatMap(t => t.calls).filter(c => allowed.has(c.callId)); assert.equal(calls.length, allowed.size);
  const end = Math.min(manifest.deadlineMs, Date.now() + (calls.reduce((n, c) => n + c.reservationSeconds, 0) + 900) * 1000);
  const records = [], checkpoints = []; let stopped = null, deltaIndex = 0, delta, bytes = 0, flushed = Date.now();
  const fresh = () => { delta = path.join(root, 'delta-' + deltaIndex); fs.mkdirSync(delta); }; fresh();
  const append = (name, value) => { const line = JSON.stringify(value) + '\n', fd = fs.openSync(path.join(delta, name), 'a');
    try { fs.writeSync(fd, line); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } bytes += Buffer.byteLength(line); };
  const flush = async force => {
    if (!force && bytes < 16 * 1024 ** 2 && Date.now() - flushed < 600000) return;
    if (!fs.readdirSync(delta).length) return;
    checkpoints.push(await upload(`fast-routing-resume-${shard}-delta-${deltaIndex}`, delta));
    fs.rmSync(delta, { recursive: true }); deltaIndex++; fresh(); bytes = 0; flushed = Date.now();
  };
  const environment = { runId, parentRunId: manifest.parentRunId, sourceCommit: manifest.sourceCommit,
    node: process.version, cpu: os.cpus()[0].model, cores: os.cpus().length, release: os.release(), shard,
    startedUtc: new Date().toISOString(), originalOriginUtc: manifest.originUtc, scheduleHash: plan.scheduleHash };
  append('environment.jsonl', environment);
  try {
    for (const task of chunk.tasks) {
      if (!task.calls.some(c => allowed.has(c.callId))) continue;
      assert(task.calls.every(c => allowed.has(c.callId)), 'partial command continuation forbidden');
      const inputRoot = path.join(root, 'input-cache'), available = task.capture?.status === 'CAPTURED' && task.capture.inputArtifact;
      if (available && !stopped) await download(task.capture.inputArtifact, inputRoot);
      const oom = new Set();
      for (const call of task.calls) {
        let execution;
        if (stopped) execution = { status: 'NOT_RUN_INVALIDATED', reaped: true };
        else if (!available) execution = { status: 'NOT_RUN_CAPTURE_MISSING', reaped: true };
        else if (oom.has(call.arm)) execution = { status: 'NOT_RUN_AFTER_OOM', reaped: true };
        else if (Date.now() + call.reservationSeconds * 1000 + 120000 >= end) execution = { status: 'NOT_RUN_BUDGET', reaped: true };
        else {
          const job = { mode: 'e2e', study: plan.study, command: task.command, fixture: call.fixture,
            inputRoot, filters: task.capture.result.filters, arm: call.arm, trace: call.trace, diagnostics: call.diagnostics };
          append('starts.jsonl', { callId: call.callId, job, atUtc: new Date().toISOString() });
          execution = await isolatedScope({ callId: call.callId, contractChildFile: 'tools/fast-bench/child.mjs', job,
            limits: { startupMs: 30000, callMs: (call.reservationSeconds - 40) * 1000, reapMs: 5000 } }, path.join(delta, call.callId));
          append('raw.jsonl', { ...call, job, execution });
          if (execution.status === 'OOM') oom.add(call.arm);
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
    const dir = path.join(root, 'summary'); fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'SUMMARY.json'), JSON.stringify({ runId, parentRunId: manifest.parentRunId, shard, environment,
      scheduleHash: plan.scheduleHash, sourceCommit: manifest.sourceCommit, stopped, records, checkpoints, transport }) + '\n', { flag: 'wx' });
    await upload(`fast-routing-resume-summary-${shard}`, dir);
    summary(`## Routing resumed shard ${shard}: ${stopped ? 'STOPPED' : 'recorded'}\n${records.length}/${allowed.size} calls.\n${stopped ?? 'Original attempts remain preserved; no performance winner inferred.'}`);
  }
  assert(!stopped, stopped); assert.equal(records.length, allowed.size);
}
