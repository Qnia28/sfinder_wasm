// Small remote contracts only; no catalog population measurement.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ARMS } from './adapter.mjs';
import { isolatedScope } from '../secondary-bench/followup-scope.mjs';
import { publishPayloads } from './transport.mjs';
import { verifySnapshot } from '../secondary-bench/common/evidence.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' });
const [mode, output = 'fast-preflight'] = process.argv.slice(2);
const summary = text => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};

if (mode === 'verify') {
  const members = fs.readdirSync(output, { withFileTypes: true }).filter(e => e.isDirectory());
  assert.equal(members.length, 3, 'three shard payloads required');
  const snapshots = members.map(e => verifySnapshot(path.join(output, e.name)));
  assert.equal(new Set(snapshots.map(s => s.identity.shard)).size, 3);
  assert(snapshots.every(s => s.identity.runId === process.env.GITHUB_RUN_ID));
  summary('## Fast artifact round trip PASS\n3 distinct payloads: all member sizes and SHA256 verified.\nThis is transport/contract evidence, not population performance.');
} else {
  assert.equal(mode, 'run'); assert.equal(process.platform, 'linux');
  assert(process.env.GITHUB_RUN_ID);
  fs.mkdirSync(output, { recursive: false });
  const sourceFiles = execFileSync('git', ['ls-files', 'src', 'wasm', 'tools/fast-bench',
    'tools/secondary-bench', '.github/workflows/fast-budget-preflight.yml'], { encoding: 'utf8' }).trim().split('\n');
  const sources = Object.fromEntries(sourceFiles.map(p => [p, hash(fs.readFileSync(p))]));
  const scopePath = 'tools/fast-bench/SCOPE_20261015_v2.json';
  const originUtc = new Date().toISOString();
  const lock = { phase: 'FAST_CONTRACT_TRANSPORT_PREFLIGHT', schema: 1, originUtc,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
    node: process.version, flags: ['--experimental-wasm-stack-switching'],
    os: os.release(), cpu: os.cpus()[0], cpuCount: os.cpus().length,
    scopeSha256: hash(fs.readFileSync(scopePath)), sources,
    reservedUnits: 30, maximumVMs: 1, maximumJobMinutes: 15,
    catalogCalls: 0, scopeMemoryBytes: 3 * 1024 ** 3, scopeSwapBytes: 0 };
  write(path.join(output, 'LOCK.json'), lock);
  // Triangle requires K>=2; [a,b] covers all rows. Duplicates preserve row weighting.
  const rows = [[[0, 1], [1, 3]], [[1, 1], [2, 3]], [[0, 3], [2, 1]]];
  const fixture = { schema: 1, id: 'contract-weighted-triangle', keys: ['a', 'b', 'c'],
    rows: [...rows, rows[0]], K: 2, seed: [0, 1],
    cardinalityProof: { status: 'PROVEN', backend: 'analytic-triangle-no-universal-candidate' } };
  const records = [], fd = fs.openSync(path.join(output, 'raw.jsonl'), 'wx');
  const starts = fs.openSync(path.join(output, 'starts.jsonl'), 'wx');
  const append = (f, row) => { fs.writeSync(f, JSON.stringify(row) + '\n'); fs.fsyncSync(f); };
  try {
    const jobs = Object.keys(ARMS).flatMap(arm => [true, false].map(trace => ({ arm, trace, mode: 'matrix', fixture })));
    jobs.push(...['BASE100', 'B1', 'B10', 'B40', 'DIRECT'].map(arm => ({ mode: 'product-parity', arm, fixture })));
    jobs.push({ mode: 'watchdog' });
    assert.equal(jobs.length, lock.reservedUnits);
    for (const [i, job] of jobs.entries()) {
      assert(Date.now() - Date.parse(originUtc) < 10 * 60 * 1000, 'preflight admission deadline');
      const callId = 'fast-preflight-' + i;
      append(starts, { callId, job, atUtc: new Date().toISOString() });
      const result = await isolatedScope({ callId, contractChildFile: 'tools/fast-bench/preflight-child.mjs', job,
        limits: { startupMs: 30000, callMs: job.mode === 'watchdog' ? 200 : 10000, reapMs: 5000 } }, path.join(output, callId));
      append(fd, { callId, job, result }); records.push({ callId, job, result });
      assert.equal(result.reaped, true, 'process tree not reclaimed');
      const valid = job.mode === 'watchdog' ? result.status === 'TIMEOUT_CALL'
        : job.mode === 'product-parity' ? result.status === 'PARITY_PASS'
          : ['RETURNED_EXACT', 'RETURNED_APPROX'].includes(result.status);
      assert(valid, `${callId}: ${result.status}; ${result.result?.error ?? ''}`);
    }
    for (const arm of Object.keys(ARMS)) {
      const [on, off] = records.filter(r => r.job.mode === 'matrix' && r.job.arm === arm).map(r => r.result.result);
      for (const key of ['keys', 'qualityVector', 'searchedStates', 'qualityExact', 'decision']) assert.deepEqual(on[key], off[key], `trace changes ${arm}/${key}`);
    }
    for (const [p, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(p)), expected, 'source changed');
    write(path.join(output, 'CONTRACT_RESULT.json'), { status: 'PASS', calls: records.length, catalogCalls: 0 });
    summary('## Fast remote contracts PASS\n30 isolated calls: 12 arms × trace ON/OFF, 5 product-path parity checks, 1 synchronous watchdog/reap check.\nSynthetic fixture only; no catalog performance claims.');
  } catch (error) {
    summary('## Fast remote contracts FAIL\n```\n' + error.stack + '\n```');
    throw error;
  } finally { fs.closeSync(fd); fs.closeSync(starts); }
  // Use real SDK credentials, with 3 independent input-like payloads.
  const client = (await import('../secondary-bench/artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
  const payloads = [0, 1, 2].map(shard => {
    const directory = path.join(output, 'payload-' + shard); fs.mkdirSync(directory);
    write(path.join(directory, 'INPUT.json'), { fixture, shard, lock });
    // Deterministic CSR-like bytes to exercise meaningful compression and hashes.
    const bytes = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + shard) % 251;
    fs.writeFileSync(path.join(directory, 'matrix.bin'), bytes);
    return { directory, receiptFile: path.join(output, `receipt-${shard}.json`),
      name: `fast-preflight-payload-${shard}`, identity: { runId: process.env.GITHUB_RUN_ID, shard } };
  });
  const delivery = await publishPayloads(client, payloads);
  write(path.join(output, 'TRANSPORT.json'), delivery);
  assert.equal(delivery.status, 'ALL_DURABLE');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'artifact-ids=' + delivery.results.map(r => r.receipt.attempts.at(-1).artifactId).join(',') + '\n');
  summary('### Upload receipts\n' + delivery.results.map(r => `- ${r.name}: ${r.transportMs.toFixed(0)}ms, artifact ${r.receipt.attempts.at(-1).artifactId}`).join('\n'));
}
