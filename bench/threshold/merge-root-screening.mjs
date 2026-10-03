import assert from 'node:assert/strict';

const sorted = ids => [...ids].sort();
export function mergeRootScreening(retained, resumed, selection) {
  assert.equal(retained.runId, selection.sourceRunId);
  assert.notEqual(resumed.runId, retained.runId);
  for (const report of [retained, resumed]) {
    assert.equal(report.profile, 'root-screen'); assert.equal(report.pairs, 1);
    assert.equal(report.timeoutSeconds, 300); assert.equal(report.manifestHash, selection.manifestHash);
    assert.equal(report.wasmHashes.experiment, selection.wasmHash);
    for (const key of ['originalRust', 'candidateRust', 'candidateJs']) assert.equal(report.sourceDigest[key], selection.sourceDigest[key]);
    assert.equal(report.samples.length, report.cases * 12);
    assert.equal(report.perCase.length, report.cases * 6);
    assert.equal(report.skippedSamples, 0);
  }
  assert.deepEqual(sorted(new Set(retained.samples.map(s => s.caseId))), sorted(selection.reuseCompleteCases));
  assert.deepEqual(sorted(new Set(resumed.samples.map(s => s.caseId))), sorted(selection.cases.map(c => c.caseId)));
  assert.equal(retained.cases, 58); assert.equal(resumed.cases, 42);
  const samples = [retained, resumed].flatMap(r => r.samples.map(s => ({ ...s, sourceRunId: r.runId, sourceCandidate: r.candidate })));
  const seen = new Set();
  for (const s of samples) {
    const key = `${s.caseId}/${s.comparisonIndex}/${s.pair}/${s.side}`;
    assert(!seen.has(key), 'cross-run duplicate sample'); seen.add(key);
  }
  const perCase = [retained, resumed].flatMap(r => r.perCase.map(c => ({ ...c, sourceRunId: r.runId, sourceCandidate: r.candidate })));
  const ids = new Set(samples.map(s => s.caseId)); assert.equal(ids.size, 100);
  for (const id of ids) {
    const raw = samples.filter(s => s.caseId === id);
    assert.equal(raw.length, 12); assert.equal(new Set(raw.map(s => s.sourceRunId)).size, 1);
    for (let index = 0; index < 6; index++) {
      const pair = raw.filter(s => s.comparisonIndex === index);
      assert.equal(pair.length, 2); assert.deepEqual(sorted(pair.map(s => s.side)), ['left', 'right']);
      assert(pair.every(s => s.pair === 0));
    }
  }
  const comparisons = Array.from({ length: 6 }, (_, index) => {
    const rows = perCase.filter(c => c.comparisonIndex === index); assert.equal(rows.length, 100);
    const done = rows.filter(c => c.pairedComplete === 1);
    return { index, name: rows[0].name, leftMask: rows[0].left.mask, rightMask: rows[0].right.mask,
      cases: 100, pairedCompleteMatrices: done.length,
      geomean: done.length ? Math.exp(done.reduce((s, r) => s + Math.log(r.pairedSpeedupMedian), 0) / done.length) : null,
      faster: done.filter(c => c.pairedSpeedupMedian > 1).length,
      slower: done.filter(c => c.pairedSpeedupMedian < 1).length,
      leftExact: rows.reduce((s, c) => s + c.leftExact, 0), rightExact: rows.reduce((s, c) => s + c.rightExact, 0),
      gain110: done.filter(c => c.pairedSpeedupMedian >= 1.1).map(c => c.caseId),
      sideRegressions: rows.filter(c => c.sideRegression).map(c => c.caseId),
      pairedRegressions: rows.filter(c => c.pairedRegression).map(c => c.caseId),
      exactToTimeout: rows.filter(c => c.leftOnlyExact > 0).map(c => c.caseId),
      onOnlyPairs: rows.reduce((s, c) => s + c.rightOnlyExact, 0),
      memoryAlerts: rows.filter(c => c.memoryReview).map(c => c.caseId) };
  });
  return { version: 1, profile: 'root-screen', campaignComplete: true, cases: 100, pairs: 1, timeoutSeconds: 300,
    resumedMaxParallel: 12, sources: [retained, resumed].map(r => ({ runId: r.runId, url: r.url, candidate: r.candidate, retainedCases: r.cases })),
    manifestHash: selection.manifestHash, wasmHashes: resumed.wasmHashes, sourceDigest: resumed.sourceDigest,
    exact: samples.filter(s => s.status === 'EXACT').length, timeout: samples.filter(s => s.status === 'TIMEOUT').length,
    omittedOldPartialCalls: 120, comparisons, perCase, samples,
    diagnostics: [retained, resumed].flatMap(r => r.diagnostics.map(d => ({ ...d, sourceRunId: r.runId }))),
    witnessHashes: { ...retained.witnessHashes, ...resumed.witnessHashes },
    note: 'Resumed composite screening: old complete58 + rerun42, each input wholly from one run/VM. Old partial120 outcomes excluded, not cherry-picked. Per-case paired ratios only, no cross-VM absolute-time pairing. One repeat is screening, not confirmation.' };
}
