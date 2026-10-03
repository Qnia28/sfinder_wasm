import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { median } from './qb-review.mjs';
import { sha256 } from './engine.mjs';
const initialBytes = readFileSync(new URL('./reports/qb-independent.json', import.meta.url));
const initial = JSON.parse(initialBytes);
const repeated = JSON.parse(readFileSync(new URL('./reports/qb-independent-recheck.json', import.meta.url)));
const resolution = JSON.parse(readFileSync(new URL('./reports/qb-independent-resolution.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('./qb-independent100/manifest.json', import.meta.url)));
const build = JSON.parse(readFileSync(new URL('./reports/qb-independent-build.json', import.meta.url)));
const execution = JSON.parse(readFileSync(new URL('./reports/qb-independent-execution.json', import.meta.url)));
assert.equal(initial.manifestHash, sha256(readFileSync(new URL('./qb-independent100/manifest.json', import.meta.url))));
const coreHashes = manifest.cases.map(c => {
  const matrix = JSON.parse(gunzipSync(readFileSync(new URL(`./qb-independent100/${c.file}`, import.meta.url))));
  return sha256(JSON.stringify({ keys: matrix.keys, rows: matrix.rows, K: matrix.K, seed: matrix.seed }));
});
const range = values => ({ min: Math.min(...values), median: median(values), max: Math.max(...values) });
const gm = rows => Math.exp(rows.reduce((s, r) => s + Math.log(r.pairedSpeedupMedian), 0) / rows.length);
const comparisons = initial.comparisons.map(c => {
  const rows = initial.perCase.filter(r => r.comparisonIndex === c.index);
  return { index: c.index, leftMask: c.left.mask, rightMask: c.right.mask, geomean: gm(rows),
    // Distributions of within-input summaries only: these are not pooled
    // runtimes or an overall sum/absolute-speedup statistic across VMs.
    perInputOffMedianMsRange: range(rows.map(r => r.leftMedianMs)),
    perInputOnMedianMsRange: range(rows.map(r => r.rightMedianMs)),
    allThreeFaster: rows.filter(r => r.fasterPairs === 3).length, allThreeSlower: rows.filter(r => r.slowerPairs === 3).length,
    rangeNoisy: rows.filter(r => r.offSpread >= 0.1 || r.onSpread >= 0.1).length,
    directionChanges: rows.filter(r => r.fasterPairs > 0 && r.slowerPairs > 0).length,
    maxPairedMedianPeakRssRatio: Math.max(...rows.map(r => r.rightPeakRssMedianKiB / r.leftPeakRssMedianKiB)),
    maxPairedMedianWasmMemoryRatio: Math.max(...rows.map(r => r.rightWasmMemoryMedianBytes / r.leftWasmMemoryMedianBytes)),
    forcedStrata: [false, true].map(hasForced => {
      const stratum = rows.filter(r => (manifest.cases.find(c => c.id === r.caseId).F > 0) === hasForced);
      return { hasForced, cases: stratum.length, geomean: gm(stratum),
        faster: stratum.filter(r => r.pairedSpeedupMedian > 1).length, slower: stratum.filter(r => r.pairedSpeedupMedian < 1).length,
        perInputPairedDeltaMsRange: range(stratum.map(r => r.pairedDeltaMs)) };
    }),
  };
});
const result = { runId: initial.runId, candidate: initial.candidate, dataset: manifest.dataset,
  evidenceHash: sha256(initialBytes), manifestHash: initial.manifestHash, buildObjectHash: sha256(JSON.stringify(build)),
  requestedSetups: 100, distinctInputCores: new Set(coreHashes).size, mirrorGroups: resolution.coverage.mirrorGroups,
  actualExact: initial.exact + repeated.exact, actualTimeout: initial.timeout + repeated.timeout,
  largestObservedNativeMs: Math.max(...initial.samples.map(r => r.nativeMs), ...repeated.samples.map(r => r.nativeMs)),
  noForced: resolution.coverage.noForced, comparisons,
  smallConsistentSlowdowns: resolution.smallConsistentSlowdowns,
  workflowMinutes: execution.workflowMinutes, maxShardJobs: execution.phases.allShardJobs.maxOverlap,
  interpretation: {
    totalEffect: '0/20 geomean1.01656 is a small descriptive point estimate, not robust evidence of a general wall-time improvement on QB.',
    rootIncrement: '16/20 geomean1.00654,49faster/51slower,97range-noisy. Incremental QB benefit not established; no-forced48 controls observed geomean0.99785.',
    regression: 'Eight initial material alerts across seven inputs were not reproduced at>=10%+>=5ms+>=8/10slower. Three16/20 inputs have>=8/10slower and paired +2.63–3.11ms; retain them rather than labeling all regressions disproved.',
    scope: 'Small K1–5,840rows, millisecond-scale calls; validates short/no-forced independent behavior, not long/hard QB workloads or all cycles.87mirror groups are not guaranteed independent statistical units.',
    currentPropagation: 'Retain previous cycle1 A evidence. This campaign does not directly compare0/16, so do not infer a new isolated currentPropagation grade by dividing cross-comparison ratios.',
    rootForced: 'Retain conditional A within cycle1 only. The QB campaign is supplementary correctness/non-material-regression evidence, not a reason to expand to unconditional A.',
    candidate: 'Keep mask20 as a conditional product-path validation candidate alongside mask16; QB alone does not justify replacing mask16 with20 as a product default. No integration/routing/default changes authorized or made.',
    statistics: 'No initial/recheck pooling, timeout substitution, cross-VM absolute-time sum, or significance claim. Forced strata are descriptive post-hoc summaries, not new selection criteria.',
  } };
writeFileSync(new URL('./reports/qb-independent-analysis.json', import.meta.url), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
