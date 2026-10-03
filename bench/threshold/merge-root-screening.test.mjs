import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRootScreening } from './merge-root-screening.mjs';
const ids = Array.from({ length: 100 }, (_, i) => `case-${String(i).padStart(3, '0')}`);
const selection = { sourceRunId: 'old', manifestHash: 'manifest', wasmHash: 'wasm',
  sourceDigest: { originalRust: 'o', candidateRust: 'r', candidateJs: 'j' },
  reuseCompleteCases: ids.slice(0, 58), cases: ids.slice(58).map(caseId => ({ caseId })) };
function report(caseIds, runId) {
  return { runId, url: runId, candidate: `${runId}-commit`, profile: 'root-screen', pairs: 1,
    timeoutSeconds: 300, manifestHash: selection.manifestHash, wasmHashes: { experiment: 'wasm' },
    sourceDigest: selection.sourceDigest, cases: caseIds.length, skippedSamples: 0, diagnostics: [], witnessHashes: {},
    samples: caseIds.flatMap(caseId => Array.from({ length: 6 }, (_, comparisonIndex) => ['left', 'right'].map(side => ({
      caseId, comparisonIndex, side, pair: 0, status: 'EXACT', nativeMs: side === 'left' ? 12 : 10,
    }))).flat()),
    perCase: caseIds.flatMap(caseId => Array.from({ length: 6 }, (_, comparisonIndex) => ({
      caseId, comparisonIndex, name: `comparison-${comparisonIndex}`, left: { mask: 0 }, right: { mask: 4 },
      pairedComplete: 1, pairedSpeedupMedian: 1.2, leftExact: 1, rightExact: 1, leftOnlyExact: 0, rightOnlyExact: 0,
    }))) };
}
test('merge keeps old58 + new42, exactly1200 unique calls and one source per input', () => {
  const merged = mergeRootScreening(report(ids.slice(0, 58), 'old'), report(ids.slice(58), 'new'), selection);
  assert.equal(merged.cases, 100); assert.equal(merged.samples.length, 1200);
  assert.equal(merged.perCase.length, 600); assert.equal(merged.exact, 1200); assert.equal(merged.timeout, 0);
  assert(merged.comparisons.every(c => c.cases === 100 && c.pairedCompleteMatrices === 100 && Math.abs(c.geomean - 1.2) < 1e-12));
  assert(merged.samples.filter(s => s.caseId === ids[0]).every(s => s.sourceRunId === 'old'));
  assert(merged.samples.filter(s => s.caseId === ids[99]).every(s => s.sourceRunId === 'new'));
});
test('merge rejects changed engines, crossed/duplicate cases, missing calls and partial supplementation', () => {
  const old = report(ids.slice(0, 58), 'old'), next = report(ids.slice(58), 'new');
  assert.throws(() => mergeRootScreening(old, { ...next, wasmHashes: { experiment: 'different' } }, selection));
  assert.throws(() => mergeRootScreening(old, { ...next, sourceDigest: { ...next.sourceDigest, candidateRust: 'changed' } }, selection));
  assert.throws(() => mergeRootScreening(old, report([...ids.slice(58, 99), ids[0]], 'new'), selection));
  assert.throws(() => mergeRootScreening(old, { ...next, samples: next.samples.slice(1) }, selection));
  const crossed = { ...next, samples: [...next.samples] };
  crossed.samples[0] = { ...crossed.samples[0], side: 'right' };
  assert.throws(() => mergeRootScreening(old, crossed, selection));
  assert.throws(() => mergeRootScreening(old, { ...next, skippedSamples: 2 }, selection));
});
