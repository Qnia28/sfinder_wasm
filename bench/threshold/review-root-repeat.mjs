import assert from 'node:assert/strict';

export function reviewRootRepeat(report, screen) {
  assert.equal(report.profile, 'root-confirm'); assert.equal(report.pairs, 5); assert.equal(report.cases, 100);
  assert.equal(report.manifestHash, screen.manifestHash);
  assert.equal(report.wasmHashes.experiment, screen.wasmHashes.experiment);
  assert.equal(report.comparisons.length, 1);
  assert.equal(report.comparisons[0].leftMask, 16); assert.equal(report.comparisons[0].rightMask, 20);
  const initial = new Map(screen.perCase.filter(c => c.comparisonIndex === 1).map(c => [c.caseId, c]));
  const rows = report.perCase.map(c => {
    const before = initial.get(c.caseId); assert(before);
    const flags = [];
    // A range alone is not a reason to launch another broad campaign. Flag
    // repeat-consistent material slowdowns, censored discordance or memory.
    if ((c.pairedRegression || c.sideRegression) && c.slowerPairs >= 4) flags.push('repeat-consistent-regression');
    if (c.leftOnlyExact > 0 || c.rightOnlyExact > 0) flags.push('completion-discordance');
    if (c.memoryReview) flags.push('memory-alert');
    return { ...c, initialRatio: before.pairedSpeedupMedian, initialRegression: before.pairedRegression,
      noisy: [c.offSpread, c.onSpread, c.ratioSpread].some(s => s !== null && s >= 0.1),
      directionChanged: before.pairedSpeedupMedian !== null && c.pairedSpeedupMedian !== null
        && (before.pairedSpeedupMedian > 1) !== (c.pairedSpeedupMedian > 1),
      repeatConsistentFaster: c.pairedComplete === 5 && c.fasterPairs >= 4,
      repeatConsistentSlower: c.pairedComplete === 5 && c.slowerPairs >= 4, flags };
  });
  const full = rows.filter(c => c.pairedComplete === 5);
  const actual = report.samples.length, skipped = report.skippedSamples;
  assert.equal(actual + skipped, 1000);
  assert.equal(report.exact + report.timeout, actual);
  const summary = { runId: report.runId, actualCalls: actual, requestedCalls: 1000, skippedCalls: skipped,
    exact: report.exact, timeout: report.timeout,
    earlyStoppedCases: rows.filter(c => c.earlyStop).map(c => c.caseId),
    fullyPairedCases: full.length,
    geomeanFullyPaired: full.length ? Math.exp(full.reduce((s, c) => s + Math.log(c.pairedSpeedupMedian), 0) / full.length) : null,
    faster: full.filter(c => c.pairedSpeedupMedian > 1).length,
    slower: full.filter(c => c.pairedSpeedupMedian < 1).length,
    consistentFaster: full.filter(c => c.repeatConsistentFaster).length,
    consistentSlower: full.filter(c => c.repeatConsistentSlower).length,
    repeatedGains110: full.filter(c => c.pairedSpeedupMedian >= 1.1 && c.fasterPairs >= 4).map(c => c.caseId),
    noisy: rows.filter(c => c.noisy).length,
    directionChanged: rows.filter(c => c.directionChanged).length,
    sideRegressions: rows.filter(c => c.sideRegression).map(c => c.caseId),
    pairedRegressions: rows.filter(c => c.pairedRegression).map(c => c.caseId),
    initialRegressionFollowup: rows.filter(c => c.initialRegression).map(c => ({
      caseId: c.caseId, initialRatio: c.initialRatio, repeatRatio: c.pairedSpeedupMedian,
      pairedDeltaMs: c.pairedDeltaMs, fasterPairs: c.fasterPairs, slowerPairs: c.slowerPairs,
      pairedRegression: c.pairedRegression, sideRegression: c.sideRegression, flags: c.flags,
    })),
    followup: rows.filter(c => c.flags.length).map(c => ({ caseId: c.caseId, reasons: c.flags })),
    note: 'Initial1pair and repeat5pairs stay separate. Ratios computed within the same VM only. No unrun call is a timeout. No automatic product promotion. Repeat-consistent is descriptive (4/5), not a significance test.' };
  assert.equal(summary.initialRegressionFollowup.length, 4);
  return { summary, rows };
}
