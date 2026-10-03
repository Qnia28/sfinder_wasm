import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { sha256, validateWitness } from './engine.mjs';

const retest = process.argv[2] === '--retest';
const runId = retest ? process.argv[3] : '37097238109';
assert(/^\d+$/.test(runId), 'retest requires its Actions run ID');
const selection = retest ? JSON.parse(readFileSync(new URL('./retest-selection.json', import.meta.url))) : null;
const expectedCases = retest ? selection.cases.length : 100;
const pairs = retest ? 10 : 5;
const label = retest ? 'retest10' : 'expanded100';
const manifestBytes = readFileSync(new URL('./cycle1-100/manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const summary = resolve(`bench/threshold/results/remote-${label}-summary/threshold-summary-${runId}-1`);
const aggregateBytes = readFileSync(resolve(summary, 'results.json'));
const aggregate = JSON.parse(aggregateBytes), evaluation = JSON.parse(readFileSync(resolve(summary, 'evaluation.json')));
assert.equal(aggregate.invalid, false); assert.equal(aggregate.rows.length, expectedCases);
assert.equal(aggregate.reports.length, expectedCases);
const reference = aggregate.reports[0].environment;
if (!retest) assert.equal(reference.candidate, '74666a9159d8e6b4121d9bd8073f8e4d5bffef56');
assert.equal(reference.profile, 'confirm-onoff'); assert.equal(reference.mask, 16);
assert.equal(reference.pairs, pairs); assert.equal(reference.timeoutSeconds, 300);
assert.equal(reference.manifestHash, sha256(manifestBytes));
if (retest) {
  assert.equal(reference.build.hashes.experiment, selection.wasmHash);
  for (const key of ['originalRust', 'candidateRust', 'candidateJs']) {
    assert.equal(reference.build.sourceDigest[key], selection.sourceDigest[key]);
  }
  assert.deepEqual([...aggregate.rows.map(r => r.caseId)].sort(), selection.cases.map(c => c.caseId).sort());
}
for (const r of aggregate.reports) {
  for (const k of ['candidate', 'profile', 'mask', 'pairs', 'timeoutSeconds', 'manifestHash', 'runId', 'runAttempt'])
    assert.equal(r.environment[k], reference[k]);
  assert.deepEqual(r.environment.build.hashes, reference.build.hashes);
  assert.deepEqual(r.environment.build.sourceDigest, reference.build.sourceDigest);
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(dir, e.name))
    : e.name === 'samples.jsonl' ? [resolve(dir, e.name)] : []);
}
const matrices = new Map(), hashes = new Map(), samples = [], seen = new Set(), perCaseSamples = new Map();
const initialReport = retest ? JSON.parse(readFileSync(new URL('./reports/expanded100.json', import.meta.url))) : null;
const files = walk(resolve(`bench/threshold/results/remote-${label}-raw`)); assert.equal(files.length, expectedCases);
for (const file of files) {
  const localSummary = JSON.parse(readFileSync(resolve(dirname(file), 'summary.json')));
  assert.equal(localSummary.invalid, false);
  const rows = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, pairs * 2); assert.equal(new Set(rows.map(r => r.caseId)).size, 1);
  const caseId = rows[0].caseId;
  assert(!perCaseSamples.has(caseId)); perCaseSamples.set(caseId, rows);
  const entry = manifest.cases.find(c => c.id === caseId); assert(entry);
  const caseSummary = aggregate.rows.find(r => r.caseId === caseId); assert(caseSummary);
  const matching = aggregate.reports.find(r => r.file === caseSummary.report); assert(matching);
  assert.deepEqual(localSummary.environment, matching.environment);
  for (const r of rows) {
    assert(['EXACT', 'TIMEOUT'].includes(r.status)); assert(['left', 'right'].includes(r.side));
    assert.equal(r.engine, 'experiment'); assert.equal(r.mask, r.side === 'left' ? 0 : 16);
    assert.equal(r.wasmHash, reference.build.hashes.experiment); assert.equal(r.traceEnabled, false);
    assert.equal(r.inputHash, entry.sha256); assert.equal(r.suite, entry.suite);
    assert.equal(r.comparisonIndex, 0); assert(Number.isInteger(r.pair) && r.pair >= 0 && r.pair < pairs);
    const key = `${caseId}/${r.pair}/${r.side}`; assert(!seen.has(key)); seen.add(key);
    if (r.status === 'EXACT') {
      if (!matrices.has(caseId)) {
        const gzip = readFileSync(new URL(`./cycle1-100/${entry.file}`, import.meta.url));
        assert.equal(sha256(gzip), entry.compressedSha256);
        const bytes = gunzipSync(gzip); assert.equal(sha256(bytes), entry.sha256);
        matrices.set(caseId, JSON.parse(bytes));
      }
      const witness = JSON.parse(gunzipSync(readFileSync(resolve(dirname(file), r.witness))));
      assert.equal(witness.completed, true);
      const hash = validateWitness(matrices.get(caseId), witness); assert.equal(hash, r.witnessHash);
      if (retest && initialReport.witnessHashes[caseId]) assert.equal(hash, initialReport.witnessHashes[caseId],
        'retest optimum differs from the initial run');
      if (hashes.has(caseId)) assert.equal(hash, hashes.get(caseId)); else hashes.set(caseId, hash);
      assert(Number.isFinite(r.nativeMs) && r.nativeMs >= 0);
    } else { assert.equal(r.nativeMs, undefined); assert.equal(r.solverMs, undefined); }
    const { suite, pair, side, mask, status, nativeMs, solverMs, outerMs, searchedStates,
      processPeakRssKiB, wasmMemoryBytes, witnessHash } = r;
    samples.push({ caseId, suite, pair, side, mask, status, nativeMs, solverMs, outerMs,
      searchedStates, processPeakRssKiB, wasmMemoryBytes, witnessHash });
  }
}
assert.equal(samples.length, expectedCases * pairs * 2);
const median = xs => {
  const a = [...xs].sort((x, y) => x - y), at = Math.floor(a.length / 2);
  return a.length % 2 ? a[at] : (a[at - 1] + a[at]) / 2;
};
const spread = xs => xs.length < 2 ? null : (Math.max(...xs) - Math.min(...xs)) / median(xs);
const perCase = evaluation.rows.map(row => {
  const raw = perCaseSamples.get(row.caseId); assert(raw);
  const paired = Array.from({ length: pairs }, (_, pair) => {
    const off = raw.find(r => r.pair === pair && r.side === 'left');
    const on = raw.find(r => r.pair === pair && r.side === 'right'); assert(off && on);
    return { pair, offStatus: off.status, onStatus: on.status,
      speedup: off.status === 'EXACT' && on.status === 'EXACT' ? off.nativeMs / on.nativeMs : null,
      offMs: off.nativeMs, onMs: on.nativeMs };
  });
  const ratios = paired.filter(p => p.speedup !== null).map(p => p.speedup);
  assert.equal(row.pairedComplete, ratios.length);
  if (ratios.length) assert.equal(row.pairedSpeedupMedian, median(ratios));
  assert.equal(row.leftExact, raw.filter(r => r.side === 'left' && r.status === 'EXACT').length);
  assert.equal(row.rightExact, raw.filter(r => r.side === 'right' && r.status === 'EXACT').length);
  const { report, candidate, ...rest } = row;
  const offTimes = raw.filter(r => r.side === 'left' && r.status === 'EXACT').map(r => r.nativeMs);
  const onTimes = raw.filter(r => r.side === 'right' && r.status === 'EXACT').map(r => r.nativeMs);
  return { ...rest, paired, offSpread: spread(offTimes), onSpread: spread(onTimes), ratioSpread: spread(ratios),
    pairedDeltaMedianMs: ratios.length ? median(paired.filter(p => p.speedup !== null).map(p => p.onMs - p.offMs)) : null,
    fasterPairs: paired.filter(p => p.speedup !== null && p.speedup > 1).length,
    slowerPairs: paired.filter(p => p.speedup !== null && p.speedup < 1).length,
    initial: selection?.cases.find(c => c.caseId === row.caseId),
    cohort: manifest.cases.find(c => c.id === row.caseId).cohort };
});
const complete = perCase.filter(r => r.pairedComplete > 0);
const stats = { matrices: expectedCases, samples: samples.length,
  exact: samples.filter(r => r.status === 'EXACT').length, timeout: samples.filter(r => r.status === 'TIMEOUT').length,
  offExact: samples.filter(r => r.side === 'left' && r.status === 'EXACT').length,
  onExact: samples.filter(r => r.side === 'right' && r.status === 'EXACT').length,
  pairedCompleteMatrices: complete.length,
  fasterMatrices: complete.filter(r => r.pairedSpeedupMedian > 1).length,
  slowerMatrices: complete.filter(r => r.pairedSpeedupMedian < 1).length,
  speedupAtLeast110: complete.filter(r => r.pairedSpeedupMedian >= 1.1).length,
  timeReductionAtLeast10Percent: complete.filter(r => r.pairedSpeedupMedian >= 1 / 0.9).length,
  offOnlyExactPairs: perCase.reduce((n, r) => n + r.leftOnlyExact, 0),
  onOnlyExactPairs: perCase.reduce((n, r) => n + r.rightOnlyExact, 0),
  geomeanCompletedRatios: Math.exp(complete.reduce((n, r) => n + Math.log(r.pairedSpeedupMedian), 0) / complete.length),
  regressionReview: perCase.filter(r => r.regressionReview).map(r => r.caseId),
  memoryReview: perCase.filter(r => r.memoryReview).map(r => r.caseId),
  onOnlyCompletedMatrices: perCase.filter(r => r.leftExact === 0 && r.rightExact > 0).map(r => r.caseId),
  bothTimeoutMatrices: perCase.filter(r => r.leftExact === 0 && r.rightExact === 0).map(r => r.caseId),
};
const output = { version: 1, runId, attempt: 1, url: `https://github.com/Qnia28/sfinder_wasm/actions/runs/${runId}`,
  candidate: reference.candidate, profile: reference.profile, mask: 16, pairs, timeoutSeconds: 300,
  manifestHash: reference.manifestHash, databaseHash: manifest.databaseHash,
  wasmHashes: reference.build.hashes, sourceDigest: reference.build.sourceDigest,
  aggregateSha256: sha256(aggregateBytes), stats, comparisons: evaluation.comparisons,
  audit: `${expectedCases} same-VM comparisons; ${samples.length} unique samples; completed witnesses independently re-scored on hashed original rows; all completed settings for each matrix agree. ON-only completion has no completed OFF optimum cross-check.`,
  witnessHashes: Object.fromEntries(hashes), perCase,
  samples: samples.sort((a, b) => a.caseId.localeCompare(b.caseId) || a.pair - b.pair || a.side.localeCompare(b.side)) };
mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./reports/${label}.json`, import.meta.url), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(stats, null, 2));
for (const row of perCase.filter(r => r.regressionReview || r.rightOnlyExact))
  console.log(JSON.stringify({ id: row.caseId, paired: row.paired, regressionReview: row.regressionReview }));
