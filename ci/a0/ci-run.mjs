import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { gunzipSync } from 'node:zlib';
import { collectWorker } from './a0-worker-lifecycle.mjs';
import { validateSchedule, validateLedger, runIdFor } from './a0-contracts.mjs';
import { analyzeRecords } from './a0-analysis.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const snapshot = path.join(root, 'snapshot');
const prep = path.join(root, 'attempt-04/prep');
const bytes = fs.readFileSync(path.join(prep, 'a0-test-cases.json'));
const plan = JSON.parse(bytes);
validateSchedule(plan);
const hash = b => createHash('sha256').update(b).digest('hex');
const hashFile = f => hash(fs.readFileSync(f));
const write = (f, value) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(value, null, 2) + '\n'); };
const harnessHashes = Object.fromEntries(fs.readdirSync(root).filter(f => f.endsWith('.mjs')).sort().map(f => [f, hashFile(path.join(root, f))]));
const runtime = { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model,
  logicalCpus: os.cpus().length, runnerOS: process.env.RUNNER_OS, imageVersion: process.env.ImageVersion,
  runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, commit: process.env.GITHUB_SHA };
function command(exe, args, log) {
  const r = spawnSync(exe, args, { cwd: root, encoding: 'utf8', timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
  if (log) { fs.mkdirSync(path.dirname(log), { recursive: true }); fs.writeFileSync(log, `${r.stdout ?? ''}\n${r.stderr ?? ''}`); }
  if (r.status !== 0) throw new Error(r.stderr || r.error?.message || `${exe} failed`);
  return r.stdout;
}
function sourceCheck() {
  const expected = JSON.parse(fs.readFileSync(path.join(prep, 'dev-source-files.json')));
  for (const row of expected) if (hashFile(path.join(snapshot, row.path)) !== row.sha256) throw new Error(`frozen source mismatch: ${row.path}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(prep, 'dev-a0-build-manifest.json')));
  if (hash(Buffer.from(JSON.stringify(expected))) !== manifest.snapshotTree.sha256) throw new Error('source manifest mismatch');
  return manifest.snapshotTree.sha256;
}
function checkedBuild() {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'built/build.json')));
  if (b.status !== 'CORRECTNESS_PASS' || b.scheduleSha256 !== hash(bytes)
      || b.binarySha256 !== hashFile(path.join(root, 'built/pc_wasm.wasm'))
      || JSON.stringify(b.harnessHashes) !== JSON.stringify(harnessHashes)) throw new Error('build/test artifact mismatch');
  sourceCheck();
  fs.copyFileSync(path.join(root, 'built/pc_wasm.wasm'), path.join(snapshot, 'wasm/pc_wasm.wasm'));
  return b;
}
const [mode, arg, cap, destination] = process.argv.slice(2);
if (mode === 'preflight') {
  sourceCheck();
  command(process.execPath, [path.join(root, 'verify-a0-inputs.mjs')]);
  console.log(JSON.stringify({ status: 'CI_PREFLIGHT_PASS', plannedRuns: plan.plannedRuns, sourceFiles: 440, solverCalls: 0 }));
} else if (mode === 'prepare') {
  const out = path.join(root, 'built');
  const sourceTreeSha256 = sourceCheck();
  command(process.execPath, ['--test', path.join(root, 'a0-harness.test.mjs')], path.join(out, 'harness-tests.log'));
  command(process.execPath, [path.join(root, 'verify-a0-inputs.mjs')], path.join(out, 'input-preflight.log'));
  process.env.CARGO_TARGET_DIR = path.join(root, 'cargo-target');
  const manifest = path.join(snapshot, 'rust/Cargo.toml');
  for (const release of [false, true]) {
    const text = command('cargo', ['test', '--manifest-path', manifest, '-p', 'pc-core', '--lib', '--offline',
      ...(release ? ['--release'] : []), 'partition', '--', '--test-threads=1'], path.join(out, `host-${release ? 'release' : 'debug'}.log`));
    if (!/test result: ok\. [1-9]\d* passed/.test(text)) throw new Error('zero host tests selected');
  }
  command('cargo', ['build', '--manifest-path', manifest, '-p', 'pc-wasm', '--release', '--target', 'wasm32-unknown-unknown', '--offline'], path.join(out, 'wasm-build.log'));
  const wasm = path.join(root, 'cargo-target/wasm32-unknown-unknown/release/pc_wasm.wasm');
  fs.copyFileSync(wasm, path.join(snapshot, 'wasm/pc_wasm.wasm'));
  fs.copyFileSync(wasm, path.join(out, 'pc_wasm.wasm'));
  const fixturesPath = path.join(prep, 'correctness-fixtures.json');
  const result = await collectWorker(new Worker(path.join(root, 'a0-correctness-worker.mjs'), {
    workerData: { snapshotRoot: snapshot, fixturesPath, fixturesSha256: hashFile(fixturesPath) } }), { maxWallMs: 60_000 });
  write(path.join(out, 'wasm-correctness.json'), result);
  if (result.status !== 'PASS') throw new Error(result.message || 'WASM correctness failed');
  sourceCheck();
  write(path.join(out, 'build.json'), { status: 'CORRECTNESS_PASS', sourceTreeSha256, scheduleSha256: hash(bytes),
    binarySha256: hashFile(wasm), harnessHashes, runtime, toolchain: command('rustc', ['--version', '--verbose']),
    fixtureCount: result.fixtureCount, solverCalls: result.solverCalls });
} else if (mode === 'shard') {
  const shard = Number(arg);
  if (!Number.isInteger(shard) || shard < 0 || shard > 3) throw new Error('invalid shard');
  const build = checkedBuild();
  const selected = plan.selectedCaseIds.filter((_, i) => i % 4 === shard);
  const shardPlan = { ...plan, selectedCaseIds: selected, selectedUniqueMatrixCount: selected.length,
    plannedRuns: selected.length * 8,
    runSchedule: plan.runSchedule.filter(j => selected.includes(j.caseId)).map((j, i) => ({ ...j, globalSequence: j.sequence, sequence: i + 1 })) };
  validateSchedule(shardPlan);
  const out = path.join(root, `output/shard-${shard}`);
  fs.mkdirSync(out, { recursive: true });
  const campaign = { ...build, runtime, shard, stateBudget: 100_000, timeoutIncumbentPolicy: 'accepted hard kill; no in-flight incumbent capture',
    globalScheduleSha256: hash(bytes), scheduleSha256: hash(Buffer.from(JSON.stringify(shardPlan))) };
  write(path.join(out, 'campaign.json'), campaign);
  write(path.join(out, 'schedule.json'), shardPlan);
  const ledger = path.join(out, 'runs.jsonl');
  if (fs.existsSync(ledger)) throw new Error('refusing to overwrite a ledger');
  const append = r => { const fd = fs.openSync(ledger, 'a'); try { fs.writeFileSync(fd, JSON.stringify(r) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
  const classification = fs.readFileSync(path.join(root, 'attempt-02/classification.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  for (const job of shardPlan.runSchedule) {
    const c = plan.cases.find(c => c.caseId === job.caseId);
    const input = classification.find(r => r.snapshot?.path === c.representative.snapshotPath);
    const runId = runIdFor(job);
    const identity = { runId, caseId: job.caseId, repetition: job.repetition, variant: job.variant };
    const start = performance.now();
    append({ event: 'start', ...identity, globalSequence: job.globalSequence, startedUtc: new Date().toISOString() });
    let probe;
    const result = await collectWorker(new Worker(path.join(root, 'a0-secondary-worker.mjs'), { workerData: {
      ...identity, devSnapshotRoot: snapshot, matrixFile: path.join(root, 'attempt-02', input.snapshot.path),
      compressedSha256: input.snapshot.gzipSha256, jsonSha256: input.snapshot.jsonSha256,
      identitySha256: c.identitySha256, binarySha256: build.binarySha256, stateBudget: 100_000,
    } }), { maxWallMs: Math.max(1, 60_000 - (performance.now() - start)), onProbe: m => {
      if (m.runId !== runId || m.variant !== job.variant) throw new Error('worker identity mismatch'); probe = m;
    } });
    if (probe) append({ event: 'probe-attempt', ...identity, startedUtc: probe.startedUtc });
    if (['EXACT', 'BUDGET_CAPPED'].includes(result.status) && (result.runId !== runId || result.binarySha256 !== build.binarySha256)) throw new Error('foreign worker result');
    append({ ...result, event: 'result', ...identity, binarySha256: build.binarySha256, stateBudget: 100_000,
      input: { ...(result.input ?? {}), identitySha256: c.identitySha256 }, probeEligible: true,
      globalSequence: job.globalSequence, endUtc: new Date().toISOString() });
    console.log(`${shard}: ${job.sequence}/${shardPlan.plannedRuns} ${runId} ${result.status}`);
    if (result.status === 'ERROR') throw new Error(result.message || 'worker error');
  }
  const records = fs.readFileSync(ledger, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  validateLedger(records, shardPlan, campaign);
  write(path.join(out, 'complete.json'), { status: 'COMPLETE', runs: shardPlan.plannedRuns });
} else if (mode === 'analyze') {
  const build = checkedBuild();
  const records = [], shards = [];
  for (let shard = 0; shard < 4; shard++) {
    const dir = path.join(root, `downloads/shard-${shard}`);
    const campaign = JSON.parse(fs.readFileSync(path.join(dir, 'campaign.json')));
    const sp = JSON.parse(fs.readFileSync(path.join(dir, 'schedule.json')));
    const rows = fs.readFileSync(path.join(dir, 'runs.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    if (campaign.binarySha256 !== build.binarySha256 || campaign.globalScheduleSha256 !== hash(bytes)) throw new Error('shard provenance mismatch');
    validateLedger(rows, sp, campaign);
    records.push(...rows); shards.push(campaign);
  }
  const getMatrix = id => JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'attempt-02', plan.cases.find(c => c.caseId === id).representative.snapshotPath))));
  const report = analyzeRecords(plan, { ...build, stateBudget: 100_000 }, records, getMatrix);
  report.runnerStrata = shards.map(s => ({ shard: s.shard, runtime: s.runtime }));
  report.crossRunnerTimingCaution = 'Pairs/all repetitions share a runner; pooled wall sum is descriptive. Inspect per-shard ratios; no automatic promotion.';
  report.shardExactSubsetRatios = shards.map(s => {
    const ids = plan.selectedCaseIds.filter((_, i) => i % 4 === s.shard);
    const values = report.exactMatrixResults.filter(r => ids.includes(r.caseId));
    return { shard: s.shard, matrices: values.length, ratio: values.reduce((n, r) => n + r.a0MedianMs, 0) / values.reduce((n, r) => n + r.histMedianMs, 0) };
  });
  const out = path.join(root, 'output/analysis');
  write(path.join(out, 'report.json'), report);
  write(path.join(out, 'runner-provenance.json'), shards);
  fs.writeFileSync(path.join(out, 'runs.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ status: report.status, recordedResults: report.recordedResults, gates: report.gates, ratio: report.exactSubsetRatio }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## A0 cycle1\nRuns: ${report.recordedResults}/584; exact matrices: ${report.exactBothMatrices}; paired wall ratio: ${report.exactSubsetRatio}; all preregistered gates: ${report.allGatesPass}.\n\nNo promotion. See artifact for full witnesses, quality vectors and runner strata.\n`);
} else if (mode === 'pack') {
  command('tar', ['-czf', path.resolve(root, destination), '-C', path.resolve(root, arg), '.']);
  const size = fs.statSync(path.resolve(root, destination)).size;
  if (size >= Number(cap) * 1024 * 1024) throw new Error(`artifact exceeds ${cap} MiB: ${size}`);
  console.log(`artifact bytes: ${size}`);
} else throw new Error('choose prepare, shard N, analyze, or pack DIR CAP_MIB DEST');
