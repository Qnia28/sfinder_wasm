import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { manifest, manifestPath, loadFixture } from './fixtures.mjs';
import { sha256, validateWitness } from './engine.mjs';
import { settings } from './profiles.mjs';
import { auditRepetitionProgress, TIMEOUT_POLICY } from './timeout-policy.mjs';

export const median = xs => {
  if (!xs.length) return null;
  const a = [...xs].sort((a, b) => a - b), at = Math.floor(a.length / 2);
  return a.length % 2 ? a[at] : (a[at - 1] + a[at]) / 2;
};
export function reviewRow(row, raw) {
  const paired = Array.from({ length: row.executedPairs }, (_, pair) => {
    const off = raw.find(s => s.pair === pair && s.side === 'left');
    const on = raw.find(s => s.pair === pair && s.side === 'right'); assert(off && on);
    return { pair, offStatus: off.status, onStatus: on.status, offMs: off.nativeMs, onMs: on.nativeMs,
      speedup: off.status === 'EXACT' && on.status === 'EXACT' ? off.nativeMs / on.nativeMs : null };
  });
  const done = paired.filter(p => p.speedup !== null), ratios = done.map(p => p.speedup);
  assert.equal(row.pairedSpeedupMedian, median(ratios)); assert.equal(row.pairedComplete, done.length);
  const delta = median(done.map(p => p.onMs - p.offMs));
  const spread = values => values.length < 2 ? null : (Math.max(...values) - Math.min(...values)) / median(values);
  const sideRegression = done.length > 0 && row.rightMedianMs >= row.leftMedianMs * 1.1 && row.rightMedianMs - row.leftMedianMs >= 5;
  const pairedRegression = done.length > 0 && median(ratios) <= 1 / 1.1 && delta >= 5;
  const completionDiscordance = paired.some(p => p.offStatus !== p.onStatus);
  const memoryReview = row.rightPeakRssMedianKiB > row.leftPeakRssMedianKiB * 1.2
    || row.rightWasmMemoryMedianBytes > row.leftWasmMemoryMedianBytes * 1.2;
  const slowerPairs = ratios.filter(r => r < 1).length;
  const longSlowdown = done.length > 0 && row.leftMedianMs >= 60000 && delta >= 100 && slowerPairs >= Math.ceil(done.length * 2 / 3);
  const largeGain = done.length > 0 && row.leftMedianMs >= 1000 && median(ratios) >= 1.5;
  const reasons = [sideRegression && 'side-median-material-regression', pairedRegression && 'paired-material-regression',
    completionDiscordance && 'completion-discordance', memoryReview && 'memory-over20percent',
    longSlowdown && 'long-input-consistent-slowdown', largeGain && 'large-gain-over1point5'].filter(Boolean);
  const { report, candidate, ...rest } = row;
  return { ...rest, paired, pairedDeltaMs: delta, fasterPairs: ratios.filter(r => r > 1).length, slowerPairs,
    offSpread: spread(done.map(p => p.offMs)), onSpread: spread(done.map(p => p.onMs)), ratioSpread: spread(ratios),
    sideRegression, pairedRegression, completionDiscordance, memoryReview, longSlowdown, largeGain, recheckReasons: reasons };
}

export function audit(input, pairs, expectedIds, previous = null, profile = 'product-confirm') {
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(resolve(dir, e.name)) : e.name === 'samples.jsonl' ? [resolve(dir, e.name)] : []); }
  const files = (Array.isArray(input) ? input : [input]).flatMap(walk); assert.equal(files.length, expectedIds.length);
  const build = JSON.parse(readFileSync(process.env.THRESHOLD_BUILD_ROOT
    ? resolve(process.env.THRESHOLD_BUILD_ROOT, 'build.json') : new URL('./build/build.json', import.meta.url)));
  const known = JSON.parse(readFileSync(new URL('./fixtures/known-witnesses.json', import.meta.url)));
  assert.equal(manifest.cases.length, 200);
  assert.equal(build.dirty, '');
  const witnesses = new Map(), samples = [], perCase = [], observed = new Set(), environments = [];
  const comparisons = settings(profile, 0);
  for (const file of files) {
    const summary = JSON.parse(readFileSync(resolve(dirname(file), 'summary.json')));
    assert.equal(summary.invalid, false); assert.deepEqual(summary.comparisons, comparisons);
    const e = summary.environment; environments.push(e);
    assert.equal(e.profile, profile); assert.equal(e.mask, 0); assert.equal(e.pairs, pairs); assert.equal(e.timeoutSeconds, 300);
    assert.equal(e.manifestHash, sha256(readFileSync(manifestPath))); assert.equal(e.dirty, '');
    assert.equal(e.earlyTimeoutPolicy, TIMEOUT_POLICY);
    assert.equal(e.runId, process.env.GITHUB_RUN_ID ?? null); assert.equal(e.runAttempt, process.env.GITHUB_RUN_ATTEMPT ?? null);
    assert.equal(e.candidate, build.candidate); assert.deepEqual(e.build, build);
    if (previous) {
      assert.equal(e.manifestHash, previous.manifestHash); assert.deepEqual(e.build.hashes, previous.wasmHashes);
      assert.deepEqual(e.build.sourceDigest, previous.sourceDigest);
    }
    const raw = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const id = raw[0].caseId; assert(expectedIds.includes(id)); assert(!observed.has(id)); observed.add(id);
    const { entry, matrix } = loadFixture(id); const seen = new Set();
    for (const r of raw) {
      assert.equal(r.caseId, id); assert.equal(r.inputHash, entry.sha256);
      assert.equal(r.traceEnabled, false); assert.equal(r.wasmHash, build.hashes[r.engine]);
      assert(['EXACT', 'TIMEOUT'].includes(r.status)); assert(['left', 'right'].includes(r.side));
      assert(Number.isInteger(r.comparisonIndex) && comparisons[r.comparisonIndex]);
      assert.equal(r.mask, comparisons[r.comparisonIndex][r.side].mask);
      assert.equal(r.engine, comparisons[r.comparisonIndex][r.side].engine);
      const key = `${r.comparisonIndex}/${r.pair}/${r.side}`; assert(!seen.has(key)); seen.add(key);
      if (r.status === 'EXACT') {
        const witness = JSON.parse(gunzipSync(readFileSync(resolve(dirname(file), r.witness))));
        assert.equal(witness.completed, true); const hash = validateWitness(matrix, witness); assert.equal(hash, r.witnessHash);
        assert.equal(witness.searchedStates, r.searchedStates); assert(Number.isFinite(r.nativeMs) && r.nativeMs > 0);
        assert.equal(r.productRoute, 'minimumCoverAtCount/solver_min_cover_at_count_locked'); assert.equal(r.productExportCalls, 1);
        assert.equal(r.productMs, r.solverMs); assert(r.productMs >= r.nativeMs);
        assert(Number.isFinite(r.outerMs) && r.outerMs >= r.productMs);
        assert(Number.isFinite(r.processPeakRssKiB) && r.processPeakRssKiB > 0);
        assert(Number.isFinite(r.wasmMemoryBytes) && r.wasmMemoryBytes > 0);
        if (witnesses.has(id)) assert.equal(hash, witnesses.get(id)); else witnesses.set(id, hash);
        if (previous?.witnessHashes[id]) assert.equal(hash, previous.witnessHashes[id]);
        if (known[id]) assert.equal(hash, known[id], 'product witness differs from frozen historical optimum');
      } else { assert.equal(r.nativeMs, undefined); assert.equal(r.solverMs, undefined); }
      const { pair, comparisonIndex, side, engine, mask, status, nativeMs, solverMs, productMs, outerMs, searchedStates,
        processPeakRssKiB, wasmMemoryBytes, witnessHash } = r;
      samples.push({ caseId: id, pair, comparisonIndex, side, engine, mask, status, nativeMs, solverMs, productMs, outerMs,
        searchedStates, processPeakRssKiB, wasmMemoryBytes, witnessHash });
    }
    assert.equal(summary.rows.length, comparisons.length);
    for (const [index, comparison] of comparisons.entries()) {
      const row = summary.rows.find(r => r.caseId === id && r.comparisonIndex === index); assert(row);
      assert.equal(row.name, comparison.name); assert.deepEqual(row.left, comparison.left); assert.deepEqual(row.right, comparison.right);
      const records = raw.filter(r => r.comparisonIndex === index);
      auditRepetitionProgress(records, row, pairs);
      for (const [side, key] of [['left', 'leftExact'], ['right', 'rightExact']]) assert.equal(row[key], records.filter(r => r.side === side && r.status === 'EXACT').length);
      const complete = Array.from({ length: row.executedPairs }, (_, pair) => records.filter(r => r.pair === pair))
        .filter(p => p.every(r => r.status === 'EXACT'));
      for (const side of ['left', 'right']) {
        const done = complete.map(p => p.find(r => r.side === side));
        for (const [summaryKey, sampleKey] of [['MedianMs', 'nativeMs'], ['ProductMedianMs', 'productMs'], ['PeakRssMedianKiB', 'processPeakRssKiB'], ['WasmMemoryMedianBytes', 'wasmMemoryBytes']]) {
          assert.equal(row[side + summaryKey], median(done.map(r => r[sampleKey])));
        }
      }
      assert.equal(row.solverSpeedupMedian, median(complete.map(p => p.find(r => r.side === 'left').solverMs / p.find(r => r.side === 'right').solverMs)));
      for (const [side, key] of [['left', 'leftOnlyExact'], ['right', 'rightOnlyExact']]) {
        assert.equal(row[key], records.filter(r => r.side === side && r.status === 'EXACT'
          && records.some(o => o.pair === r.pair && o.side !== side && o.status === 'TIMEOUT')).length);
      }
      perCase.push({ ...reviewRow(row, records), cohort: entry.cohort });
    }
  }
  assert.deepEqual([...observed].sort(), [...expectedIds].sort());
  const statistics = comparisons.flatMap((comparison, index) => ['cycle1', 'qb'].map(cohort => {
    const rows = perCase.filter(r => r.comparisonIndex === index && r.cohort === cohort), done = rows.filter(r => r.pairedComplete > 0);
    const fully = rows.filter(r => r.pairedComplete === pairs);
    const geomean = data => data.length ? Math.exp(data.reduce((s, r) => s + Math.log(r.pairedSpeedupMedian), 0) / data.length) : null;
    return { index, cohort, ...comparison, cases: rows.length, pairedMatrices: done.length, fullyPairedMatrices: fully.length,
      geomean: geomean(done), fullyPairedGeomean: geomean(fully), faster: done.filter(r => r.pairedSpeedupMedian > 1).length,
      slower: done.filter(r => r.pairedSpeedupMedian < 1).length, onOnlyPairs: rows.reduce((s, r) => s + r.rightOnlyExact, 0),
      offOnlyPairs: rows.reduce((s, r) => s + r.leftOnlyExact, 0), earlyStopped: rows.filter(r => r.earlyStop).length,
      skippedSamples: rows.reduce((s, r) => s + r.skippedPairs * 2, 0),
      alerts: rows.filter(r => r.recheckReasons.length).map(r => ({ caseId: r.caseId, reasons: r.recheckReasons })) };
  }));
  return { profile, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    candidate: build.candidate, pairs, timeoutSeconds: 300, manifestHash: sha256(readFileSync(manifestPath)),
    evidenceProvenance: manifest.provenance,
    wasmHashes: build.hashes, sourceDigest: build.sourceDigest, environments,
    frozenMatrixPopulation: manifest.cases.length,
    auditedMatrices: observed.size, requestedSamples: observed.size * comparisons.length * pairs * 2,
    executedSamples: samples.length, skippedSamples: perCase.reduce((s, r) => s + r.skippedPairs * 2, 0),
    exact: samples.filter(r => r.status === 'EXACT').length, timeout: samples.filter(r => r.status === 'TIMEOUT').length,
    comparisons: statistics, perCase, samples, witnessHashes: Object.fromEntries(witnesses),
    audit: 'All raw samples, paired progress including unrun calls, same-job environments, source/build/input hashes and completed original-row witnesses independently checked. TIMEOUTs censored; no solver time assigned. No cross-VM absolute-time pooling.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output, pairsArg, previousPath] = process.argv.slice(2); assert(input && output && pairsArg);
  const previous = previousPath ? JSON.parse(readFileSync(previousPath)) : null;
  const selectionInput = previous ? JSON.parse(readFileSync(resolve(dirname(previousPath), 'selection.json'))) : null;
  if (selectionInput) {
    assert.equal(selectionInput.reviewHash, sha256(readFileSync(previousPath)));
    assert.equal(selectionInput.sourceManifestHash, previous.manifestHash);
    assert.deepEqual(selectionInput.sourceWasmHashes, previous.wasmHashes);
  }
  const expectedIds = selectionInput ? selectionInput.cases : JSON.parse(readFileSync(new URL('./run.json', import.meta.url))).cases;
  const review = audit(resolve(input), Number(pairsArg), expectedIds, previous);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'review.json'), JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
  const selected = [...new Set(review.perCase.filter(r => r.recheckReasons.length).map(r => r.caseId))];
  const selection = { cases: selected, criteria: 'Any material>=10% and>=5ms regression by side or paired medians; any completed/timeout discordance; paired ON memory>20%; >=60sec OFF with>=100ms paired slowdown and>=2/3 slower; >=1sec OFF gain>=1.5. Range-noise alone does not trigger retest.',
    sourceManifestHash: review.manifestHash, sourceWasmHashes: review.wasmHashes,
    reviewHash: sha256(readFileSync(resolve(output, 'review.json'))), details: review.perCase.filter(r => r.recheckReasons.length)
      .map(r => ({ caseId: r.caseId, comparisonIndex: r.comparisonIndex, reasons: r.recheckReasons })) };
  writeFileSync(resolve(output, 'selection.json'), JSON.stringify(selection, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ executed: review.executedSamples, comparisons: review.comparisons, selected }, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `enabled=${selected.length > 0}\nmatrix=${JSON.stringify({ case: selected })}\n`);
  }
}
