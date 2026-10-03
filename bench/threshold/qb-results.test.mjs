import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { sha256, validateMatrix, validateWitness, openEngine } from './engine.mjs';
import { auditRepetitionProgress } from './timeout-policy.mjs';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const manifest = json('./qb-independent100/manifest.json');
const initial = json('./reports/qb-independent.json'), repeated = json('./reports/qb-independent-recheck.json');
const resolution = json('./reports/qb-independent-resolution.json'), analysis = json('./reports/qb-independent-analysis.json');
const execution = json('./reports/qb-independent-execution.json'), build = json('./reports/qb-independent-build.json');
const sourceAudit = json('./reports/qb-independent-source-audit.json');
function matrix(c) {
  const compressed = readFileSync(new URL(`./qb-independent100/${c.file}`, import.meta.url));
  assert.equal(sha256(compressed), c.compressedSha256); const bytes = gunzipSync(compressed);
  assert.equal(sha256(bytes), c.sha256); const m = JSON.parse(bytes); validateMatrix(m); return m;
}
test('frozen100 physical IDs and99 core matrices retain48 real no-forced controls and original QB conditions', () => {
  const snapshot = json('./qb-setups.json'); assert.equal(manifest.cases.length, 100); assert.equal(manifest.generationFailures.length, 0);
  assert.equal(manifest.snapshotHash, sha256(readFileSync(new URL('./qb-setups.json', import.meta.url))));
  assert.equal(initial.manifestHash, sha256(readFileSync(new URL('./qb-independent100/manifest.json', import.meta.url))));
  const cores = new Map();
  for (const c of manifest.cases) {
    const m = matrix(c), s = snapshot.setups.find(s => s.id === c.setupId); assert(s);
    assert.equal(m.pattern, s.pattern); assert.equal(m.sourceFumen, s.fumen); assert.equal(m.totalCases, 840);
    assert.equal(m.rows.length, 840); assert.equal(m.K, c.K); assert.deepEqual(m.seed, c.seedIds);
    assert.equal(m.enumerationWasmHash, build.hashes.original); assert.equal(m.snapshotHash, manifest.snapshotHash);
    const core = sha256(JSON.stringify({ keys: m.keys, rows: m.rows, K: m.K, seed: m.seed }));
    cores.set(core, [...(cores.get(core) || []), c.id]);
  }
  assert.equal(cores.size, 99); assert.equal(manifest.cases.filter(c => c.F === 0).length, 48);
  assert.deepEqual([...cores.values()].filter(ids => ids.length > 1), [['c7-2plus2-qb-row-175-L', 'c7-2plus2-qb-row-018-L']]);
});
test('all1480 exact compact samples reproduce paired accounting, ratios, hashes and ten new pairs', () => {
  const buildHash = sha256(JSON.stringify(build));
  for (const review of [initial, repeated]) {
    assert.equal(review.runId, '37144800885'); assert.equal(review.timeout, 0); assert.equal(review.skippedSamples, 0);
    assert.equal(review.samples.length, review.executedSamples); assert.equal(review.samples.length, review.requestedSamples);
    assert.equal(review.exact, review.samples.length); assert.deepEqual(review.wasmHashes, build.hashes);
    assert.deepEqual(review.sourceDigest, build.sourceDigest);
    assert(review.environments.every(e => e.buildObjectHash === buildHash && !e.dirty));
    for (const row of review.perCase) {
      const samples = review.samples.filter(s => s.caseId === row.caseId && s.comparisonIndex === row.comparisonIndex);
      auditRepetitionProgress(samples, row, review.pairs);
      assert.equal(row.pairedComplete, review.pairs);
      assert.equal(row.fasterPairs + row.slowerPairs, review.pairs);
      assert(samples.every(s => s.status === 'EXACT' && s.witnessHash === initial.witnessHashes[s.caseId]));
    }
  }
  assert.equal(initial.exact, 1200); assert.equal(repeated.exact, 280); assert.equal(repeated.auditedMatrices, 7);
  assert.equal(resolution.decisionAlerts.length, 0); assert.equal(resolution.smallConsistentSlowdowns.length, 3);
  assert(resolution.smallConsistentSlowdowns.every(r => r.slowerPairs === 8 && r.pairedDeltaMs < 5));
  assert.equal(initial.comparisons[0].geomean, 1.016560897496228);
  assert.equal(initial.comparisons[1].geomean, 1.0065386365470326);
  assert.equal(analysis.evidenceHash, sha256(readFileSync(new URL('./reports/qb-independent.json', import.meta.url))));
  assert.equal(analysis.distinctInputCores, 99); assert.equal(analysis.actualExact, 1480);
  assert.equal(execution.phases.allShardJobs.maxOverlap, 10);
  assert.equal(execution.phases.recheck.shardJobs.maxOverlap, 7);
  assert.equal(execution.phases.benchmark.intervals.length, 100);
  assert.equal(execution.phases.capture.zeroSecondIntervals, 63);
  assert.equal(sourceAudit.previousRootCampaignEngineUnchanged, true);
  assert.equal(sourceAudit.experimentWasmHash, build.hashes.experiment);
  assert.equal(Object.values(sourceAudit.checked).reduce((n, x) => n + x.files, 0), 420);
  for (const [name, check] of Object.entries(sourceAudit.checked)) assert.equal(check.digest, build.sourceDigest[name]);
});
test('local byte-identical real WASM replay matches completed witnesses for every QB matrix and0/16/20', async () => {
  const engine = await openEngine(process.env.THRESHOLD_REPLAY_WASM || 'bench/threshold/build/experiment.wasm');
  try {
    assert.equal(engine.wasmHash, initial.wasmHashes.experiment); assert.equal(engine.traceEnabled, false);
    for (const c of manifest.cases) for (const mask of [0, 16, 20]) {
      const m = matrix(c), result = engine.solve(m, { mask }); assert.equal(result.completed, true);
      assert.equal(validateWitness(m, result), initial.witnessHashes[c.id]);
    }
  } finally { engine.close(); }
});
