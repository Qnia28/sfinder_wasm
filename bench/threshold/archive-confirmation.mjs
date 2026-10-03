// Preserve compact measurements beyond Actions artifact retention, and re-audit
// every completed witness before generating the checked-in confirmation record.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { sha256, validateWitness } from './engine.mjs';

const runId = '37046842107';
const manifestBytes = readFileSync(new URL('./cycle1/manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(resolve(dir, e.name)) : e.name === 'samples.jsonl' ? [resolve(dir, e.name)] : []);
}
const witnessHashes = new Map(), matrices = new Map(), attempts = [];
let reference;
for (const attempt of [1, 2]) {
  const summaryPath = resolve(`bench/threshold/results/remote-confirm${attempt}-summary/threshold-summary-${runId}-${attempt}/evaluation.json`);
  const evaluation = JSON.parse(readFileSync(summaryPath));
  const resultPath = resolve(dirname(summaryPath), 'results.json');
  const aggregate = JSON.parse(readFileSync(resultPath));
  assert.equal(aggregate.invalid, false);
  assert.equal(aggregate.rows.length, 20);
  const first = aggregate.reports[0].environment;
  assert.equal(first.mask, 16); assert.equal(first.profile, 'confirm');
  assert.equal(first.pairs, 5); assert.equal(first.timeoutSeconds, 60);
  assert.equal(first.manifestHash, sha256(manifestBytes));
  const build = first.build;
  const identity = { candidate: first.candidate, baseline: first.baseline,
    manifestHash: first.manifestHash, wasmHashes: build.hashes, sourceDigest: build.sourceDigest };
  if (reference) assert.deepEqual(identity, reference); else reference = identity;
  for (const r of aggregate.reports) {
    assert.equal(r.environment.runAttempt, String(attempt));
    assert.equal(r.environment.runId, runId);
    assert.equal(r.environment.candidate, first.candidate);
    assert.deepEqual(r.environment.build.hashes, build.hashes);
    assert.deepEqual(r.environment.build.sourceDigest, build.sourceDigest);
  }
  const samples = [], unique = new Set();
  for (const file of walk(resolve(`bench/threshold/results/remote-confirm${attempt}-raw`))) {
    const rows = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.length, 10);
    for (const sample of rows) {
      assert(['EXACT', 'TIMEOUT'].includes(sample.status));
      assert(['left', 'right'].includes(sample.side));
      assert.equal(sample.mask, sample.side === 'left' ? 0 : 16);
      assert.equal(sample.engine, sample.side === 'left' ? 'original' : 'experiment');
      assert.equal(sample.wasmHash, build.hashes[sample.engine]);
      assert.equal(sample.traceEnabled, false);
      assert(Number.isInteger(sample.pair) && sample.pair >= 0 && sample.pair < 5);
      const key = `${sample.caseId}/${sample.pair}/${sample.side}`;
      assert(!unique.has(key)); unique.add(key);
      const entry = manifest.cases.find(c => c.id === sample.caseId); assert(entry);
      assert.equal(entry.sha256, sample.inputHash);
      if (sample.status === 'EXACT') {
        if (!matrices.has(entry.id)) {
          const gzip = readFileSync(new URL(`./cycle1/${entry.file}`, import.meta.url));
          assert.equal(sha256(gzip), entry.compressedSha256);
          const bytes = gunzipSync(gzip); assert.equal(sha256(bytes), entry.sha256);
          matrices.set(entry.id, JSON.parse(bytes));
        }
        const witness = JSON.parse(gunzipSync(readFileSync(resolve(dirname(file), sample.witness))));
        assert.equal(witness.completed, true);
        const hash = validateWitness(matrices.get(entry.id), witness);
        assert.equal(hash, sample.witnessHash);
        if (witnessHashes.has(entry.id)) assert.equal(hash, witnessHashes.get(entry.id));
        else witnessHashes.set(entry.id, hash);
      } else {
        assert.equal(sample.solverMs, undefined);
        assert.equal(sample.nativeMs, undefined);
      }
      const { caseId, suite, pair, side, engine, mask, status, nativeMs, solverMs, outerMs,
        searchedStates, processPeakRssKiB, wasmMemoryBytes, witnessHash } = sample;
      samples.push({ caseId, suite, pair, side, engine, mask, status, nativeMs, solverMs, outerMs,
        searchedStates, processPeakRssKiB, wasmMemoryBytes, witnessHash });
    }
  }
  assert.equal(samples.length, 200);
  assert.equal(samples.filter(s => s.status === 'EXACT').length, 110);
  assert.equal(samples.filter(s => s.status === 'TIMEOUT').length, 90);
  for (const row of evaluation.rows) {
    const local = samples.filter(s => s.caseId === row.caseId);
    assert.equal(local.length, 10);
    assert.equal(local.filter(s => s.side === 'left' && s.status === 'EXACT').length, row.leftExact);
    assert.equal(local.filter(s => s.side === 'right' && s.status === 'EXACT').length, row.rightExact);
  }
  attempts.push({ attempt, url: `https://github.com/Qnia28/sfinder_wasm/actions/runs/${runId}/attempts/${attempt}`,
    summarySha256: sha256(readFileSync(resultPath)), comparisons: evaluation.comparisons,
    perCase: evaluation.rows.map(({ report, candidate, ...row }) => row),
    environments: aggregate.reports.map(r => ({ runner: r.environment.runner,
      cpu: r.environment.cpu, node: r.environment.node, platform: r.environment.platform })),
    samples: samples.sort((a, b) => a.caseId.localeCompare(b.caseId) || a.pair - b.pair || a.side.localeCompare(b.side)) });
}
const output = new URL('./reports/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('confirmation.json', output), JSON.stringify({ version: 1, runId,
  identity: reference, databaseHash: manifest.databaseHash, mask: 16, pairs: 5, timeoutSeconds: 60,
  audit: '400 samples; 220 exact witnesses independently rescored on hashed original rows and equal across both engines/attempts. Timeout outcomes are censored, never completed times.',
  witnessHashes: Object.fromEntries(witnessHashes), attempts }, null, 2) + '\n', { flag: 'wx' });
console.log('Archived 400 checked samples and per-case confirmation metrics; 220 exact witnesses agree.');
