import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { sha256, validateWitness } from './engine.mjs';
import { settings } from './profiles.mjs';
import { auditRepetitionProgress } from './timeout-policy.mjs';
const [runId, label] = process.argv.slice(2);
assert(/^\d+$/.test(runId) && /^root-[a-z0-9-]+$/.test(label), 'supply run ID and root-* label');
const retained = label === 'root-retained';
const artifactLabel = retained ? 'root-screen-interrupted' : label;
const selection = ['root-retained', 'root-resumed'].includes(label)
  ? JSON.parse(readFileSync(new URL('./root-resume-selection.json', import.meta.url))) : null;
const bytes = readFileSync(`bench/threshold/results/remote-${artifactLabel}-summary/threshold-summary-${runId}-1/results.json`);
const aggregate = JSON.parse(bytes);
if (retained) {
  assert.equal(runId, selection.sourceRunId); assert.equal(aggregate.invalid, true);
  assert.equal(selection.sourceReportHash, sha256(readFileSync(new URL('./reports/root-screen-interrupted.json', import.meta.url))));
  assert.deepEqual(aggregate.reports.length, selection.reuseCompleteCases.length);
  assert.deepEqual([...new Set(aggregate.rows.map(r => r.caseId))].sort(), [...selection.reuseCompleteCases].sort());
  assert.deepEqual([...aggregate.missing].sort(), selection.cases.map(c => c.caseId).sort());
} else assert.equal(aggregate.invalid, false);
const manifestBytes = readFileSync(new URL('./cycle1-100/manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const initial = JSON.parse(readFileSync(new URL('./reports/expanded100.json', import.meta.url)));
const reference = aggregate.reports[0].environment;
assert(['root-screen', 'root-confirm'].includes(reference.profile));
const expectedComparisons = settings(reference.profile, reference.mask);
if (reference.profile === 'root-confirm') {
  const screen = JSON.parse(readFileSync(new URL('./reports/root-screen.json', import.meta.url)));
  assert.equal(reference.build.hashes.experiment, screen.wasmHashes.experiment);
  assert.equal(reference.manifestHash, screen.manifestHash);
  for (const key of ['originalRust', 'candidateRust', 'candidateJs']) {
    assert.equal(reference.build.sourceDigest[key], screen.sourceDigest[key]);
  }
}
if (selection) {
  assert.equal(reference.profile, selection.profile); assert.equal(reference.pairs, selection.pairs);
  assert.equal(reference.mask, selection.mask); assert.equal(reference.build.hashes.experiment, selection.wasmHash);
  for (const key of ['originalRust', 'candidateRust', 'candidateJs']) {
    assert.equal(reference.build.sourceDigest[key], selection.sourceDigest[key]);
  }
  if (!retained) assert.deepEqual([...new Set(aggregate.rows.map(r => r.caseId))].sort(), selection.cases.map(c => c.caseId).sort());
}
assert.equal(reference.timeoutSeconds, 300);
assert.equal(reference.manifestHash, sha256(manifestBytes));
assert.equal(reference.runId, runId); assert.equal(reference.runAttempt, '1');
assert.equal(reference.dirty, ''); assert.equal(reference.build.dirty, '');
function walk(dir, name) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(resolve(dir, e.name), name) : e.name === name ? [resolve(dir, e.name)] : []);
}
const root = resolve(`bench/threshold/results/remote-${artifactLabel}-raw`);
const files = walk(root, 'samples.jsonl').filter(file => !retained || selection.reuseCompleteCases
  .includes(JSON.parse(readFileSync(file, 'utf8').split('\n')[0]).caseId));
assert.equal(files.length, aggregate.reports.length);
const matrices = new Map(), witnesses = new Map(), cases = new Set(), seen = new Set(), samples = [], diagnostics = [];
for (const file of files) {
  const local = JSON.parse(readFileSync(resolve(dirname(file), 'summary.json')));
  assert.equal(local.invalid, false);
  const environment = local.environment;
  assert.deepEqual(local.comparisons, expectedComparisons);
  for (const k of ['candidate', 'profile', 'mask', 'pairs', 'timeoutSeconds', 'manifestHash', 'runId', 'runAttempt', 'dirty', 'earlyTimeoutPolicy']) {
    assert.deepEqual(environment[k], reference[k]);
  }
  assert.deepEqual(environment.build, reference.build);
  const raw = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const caseId = raw[0].caseId; assert(!cases.has(caseId)); cases.add(caseId);
  const entry = manifest.cases.find(c => c.id === caseId); assert(entry);
  const gzip = readFileSync(new URL(`./cycle1-100/${entry.file}`, import.meta.url));
  assert.equal(sha256(gzip), entry.compressedSha256);
  const inputBytes = gunzipSync(gzip); assert.equal(sha256(inputBytes), entry.sha256);
  const matrix = JSON.parse(inputBytes); matrices.set(caseId, matrix);
  const matches = aggregate.rows.filter(r => r.caseId === caseId);
  assert.equal(matches.length, local.comparisons.length);
  for (const row of matches) {
    const records = raw.filter(r => r.comparisonIndex === row.comparisonIndex);
    auditRepetitionProgress(records, row, reference.pairs);
    const localRow = local.rows.find(r => r.caseId === caseId && r.comparisonIndex === row.comparisonIndex);
    assert(localRow); auditRepetitionProgress(records, localRow, reference.pairs);
  }
  const report = aggregate.reports.find(r => r.file === matches[0].report); assert(report);
  assert.deepEqual(report.environment, environment);
  for (const r of raw) {
    assert.equal(r.caseId, caseId); assert.equal(r.inputHash, entry.sha256);
    assert(['EXACT', 'TIMEOUT'].includes(r.status)); assert(['left', 'right'].includes(r.side));
    assert.equal(r.engine, 'experiment'); assert.equal(r.traceEnabled, false);
    assert.equal(r.wasmHash, reference.build.hashes.experiment);
    assert(Number.isInteger(r.pair) && r.pair >= 0 && r.pair < reference.pairs);
    const comparison = local.comparisons[r.comparisonIndex]; assert(comparison);
    assert.equal(r.mask, comparison[r.side].mask);
    const key = `${caseId}/${r.comparisonIndex}/${r.pair}/${r.side}`; assert(!seen.has(key)); seen.add(key);
    if (r.status === 'EXACT') {
      const witness = JSON.parse(gunzipSync(readFileSync(resolve(dirname(file), r.witness))));
      assert.equal(witness.completed, true);
      const hash = validateWitness(matrix, witness); assert.equal(hash, r.witnessHash);
      assert.equal(witness.searchedStates, r.searchedStates);
      if (initial.witnessHashes[caseId]) assert.equal(hash, initial.witnessHashes[caseId]);
      if (witnesses.has(caseId)) assert.equal(hash, witnesses.get(caseId)); else witnesses.set(caseId, hash);
      assert(Number.isFinite(r.nativeMs) && r.nativeMs > 0);
    } else { assert.equal(r.nativeMs, undefined); assert.equal(r.solverMs, undefined); }
    const { pair, comparisonIndex, side, mask, status, nativeMs, solverMs, outerMs, searchedStates,
      processPeakRssKiB, wasmMemoryBytes, witnessHash } = r;
    samples.push({ caseId, pair, comparisonIndex, side, mask, status, nativeMs, solverMs, outerMs,
      searchedStates, processPeakRssKiB, wasmMemoryBytes, witnessHash });
  }
  if (reference.profile === 'root-screen') {
    const trace = JSON.parse(readFileSync(resolve(dirname(file), 'root-diagnostics.json')));
    assert.equal(trace.inputHash, entry.sha256); assert.equal(trace.caseId, caseId);
    assert.equal(trace.traceWasmHash, reference.build.hashes.trace);
    assert.equal(trace.stateBudget, 1000);
    for (const result of trace.results) {
      validateWitness(matrix, result); assert(result.searchedStates <= 1000);
      if (result.completed && witnesses.has(caseId)) {
        assert.equal(validateWitness(matrix, result), witnesses.get(caseId));
      }
      // The compact old archive omits quality vectors. Check prefix internal
      // consistency here; full prefix optimality is covered by the oracle tests.
      const levels = [...new Set(matrix.rows.flatMap(row => row.map(([, q]) => q)))].sort((a, b) => a - b);
      if (levels.length > 1) levels.shift();
      assert(result.provenPrefix.length <= levels.length);
      for (const [i, target] of result.provenPrefix.entries()) {
        assert.equal(target, result.quality.filter(q => q >= levels[i]).length);
      }
    }
    diagnostics.push({ ...trace, results: trace.results.map(result => ({
      mask: result.mask, completed: result.completed, count: result.count,
      searchedStates: result.searchedStates, provenPrefix: result.provenPrefix,
      diagnostics: result.diagnostics, witnessHash: validateWitness(matrix, result),
      note: 'Full selected/quality vectors verified against original rows before compacting; available in raw trace artifacts.',
    })) });
  }
}
const median = xs => {
  if (!xs.length) return null;
  const a = [...xs].sort((a, b) => a - b), at = Math.floor(a.length / 2);
  return a.length % 2 ? a[at] : (a[at - 1] + a[at]) / 2;
};
const spread = xs => xs.length < 2 ? null : (Math.max(...xs) - Math.min(...xs)) / median(xs);
const perCase = aggregate.rows.map(row => {
  const raw = samples.filter(s => s.caseId === row.caseId && s.comparisonIndex === row.comparisonIndex);
  const progress = auditRepetitionProgress(raw, row, reference.pairs);
  const paired = Array.from({ length: progress.executedPairs }, (_, pair) => {
    const off = raw.find(s => s.pair === pair && s.side === 'left');
    const on = raw.find(s => s.pair === pair && s.side === 'right'); assert(off && on);
    return { pair, offStatus: off.status, onStatus: on.status, offMs: off.nativeMs, onMs: on.nativeMs,
      speedup: off.status === 'EXACT' && on.status === 'EXACT' ? off.nativeMs / on.nativeMs : null,
      stateRatio: off.status === 'EXACT' && on.status === 'EXACT' && on.searchedStates > 0
        ? off.searchedStates / on.searchedStates : null };
  });
  const done = paired.filter(p => p.speedup !== null), ratios = done.map(p => p.speedup);
  assert.equal(row.pairedSpeedupMedian, median(ratios)); assert.equal(row.pairedComplete, ratios.length);
  for (const [side, key] of [['left', 'leftExact'], ['right', 'rightExact']]) {
    assert.equal(row[key], raw.filter(s => s.side === side && s.status === 'EXACT').length);
  }
  const { report, candidate, ...rest } = row;
  const pairedDeltaMs = median(done.map(p => p.onMs - p.offMs));
  return { ...rest, ...progress, paired, pairedDeltaMs,
    offSpread: spread(raw.filter(s => s.side === 'left' && s.status === 'EXACT').map(s => s.nativeMs)),
    onSpread: spread(raw.filter(s => s.side === 'right' && s.status === 'EXACT').map(s => s.nativeMs)),
    ratioSpread: spread(ratios), fasterPairs: ratios.filter(r => r > 1).length,
    slowerPairs: ratios.filter(r => r < 1).length,
    sideRegression: row.pairedComplete > 0 && row.rightMedianMs >= row.leftMedianMs * 1.1
      && row.rightMedianMs - row.leftMedianMs >= 5,
    pairedRegression: ratios.length > 0 && median(ratios) <= 1 / 1.1 && pairedDeltaMs >= 5,
    memoryReview: row.rightPeakRssMedianKiB > row.leftPeakRssMedianKiB * 1.2
      || row.rightWasmMemoryMedianBytes > row.leftWasmMemoryMedianBytes * 1.2 };
});
const comparisons = [...new Set(perCase.map(r => r.comparisonIndex))].map(index => {
  const rows = perCase.filter(r => r.comparisonIndex === index);
  const done = rows.filter(r => r.pairedComplete > 0);
  return { index, name: rows[0].name, leftMask: rows[0].left.mask, rightMask: rows[0].right.mask,
    cases: rows.length, pairedCompleteMatrices: done.length,
    geomean: done.length ? Math.exp(done.reduce((s, r) => s + Math.log(r.pairedSpeedupMedian), 0) / done.length) : null,
    faster: done.filter(r => r.pairedSpeedupMedian > 1).length,
    slower: done.filter(r => r.pairedSpeedupMedian < 1).length,
    gain110: done.filter(r => r.pairedSpeedupMedian >= 1.1).map(r => r.caseId),
    sideRegressions: rows.filter(r => r.sideRegression).map(r => r.caseId),
    pairedRegressions: rows.filter(r => r.pairedRegression).map(r => r.caseId),
    exactToTimeout: rows.filter(r => r.leftOnlyExact > 0).map(r => r.caseId),
    onOnlyPairs: rows.reduce((s, r) => s + r.rightOnlyExact, 0),
    earlyStopped: rows.filter(r => r.earlyStop).map(r => r.caseId),
    skippedPairs: rows.reduce((s, r) => s + r.skippedPairs, 0),
    memoryAlerts: rows.filter(r => r.memoryReview).map(r => r.caseId) };
});
writeFileSync(new URL(`./reports/${label}.json`, import.meta.url), JSON.stringify({
  runId, url: `https://github.com/Qnia28/sfinder_wasm/actions/runs/${runId}`, attempt: 1,
  candidate: reference.candidate, profile: reference.profile, pairs: reference.pairs, timeoutSeconds: 300,
  manifestHash: reference.manifestHash, wasmHashes: reference.build.hashes, sourceDigest: reference.build.sourceDigest,
  aggregateSha256: sha256(bytes), cases: cases.size, exact: samples.filter(s => s.status === 'EXACT').length,
  timeout: samples.filter(s => s.status === 'TIMEOUT').length, comparisons, perCase, diagnostics,
  requestedSamples: cases.size * expectedComparisons.length * reference.pairs * 2,
  skippedSamples: perCase.reduce((s, r) => s + r.skippedPairs * 2, 0),
  witnessHashes: Object.fromEntries(witnesses), samples,
  audit: 'Unique samples/settings, same-VM environments, input/build/source hashes, and all completed original-row witnesses checked. Existing completed optima matched expanded100 hashes. Budgeted traces are not timing data.',
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(comparisons, null, 2));
