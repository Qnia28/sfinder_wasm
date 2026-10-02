import { VARIANTS, validateLedger, validateIncumbent, compareVectors, runIdFor } from './a0-contracts.mjs';

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export const nearestRankP95 = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
};

export function analyzeRecords(plan, campaign, records, getMatrix) {
  const terminals = validateLedger(records, plan, campaign);
  const results = [...terminals.values()];
  const goodStatus = row => ['EXACT', 'BUDGET_CAPPED'].includes(row?.status);
  const validationFailures = [];
  const verified = new Set();
  for (const row of results) {
    if (!goodStatus(row)) continue;
    try {
      if (row.incumbentValidation !== 'PASS' || row.integratedProbeAttempted !== true
          || row.completed !== (row.status === 'EXACT')
          || !Number.isFinite(row.solverCallWallMs) || row.solverCallWallMs <= 0) throw new Error('invalid successful result metadata');
      validateIncumbent(getMatrix(row.caseId), { ...row.incumbent,
        qualityVector: row.incumbent.qualityVector, completed: row.completed,
        searchedStates: row.searchedStates }, campaign.stateBudget);
      verified.add(row.runId);
    } catch (error) { validationFailures.push({ runId: row.runId, message: error.message }); }
  }
  const byJob = (caseId, repetition, variant) => terminals.get(runIdFor({ caseId, repetition, variant }));
  const qualityRegressions = [], stateRegressions = [], exactMismatches = [], missingComparisons = [];
  const pairRows = [];
  for (const caseId of plan.selectedCaseIds) {
    for (let repetition = 1; repetition <= plan.repetitionsPerVariant; repetition++) {
      const base = byJob(caseId, repetition, VARIANTS[0]);
      const treatment = byJob(caseId, repetition, VARIANTS[1]);
      if (!base || !treatment || !verified.has(base.runId) || !verified.has(treatment.runId)) {
        missingComparisons.push({ caseId, repetition, histStatus: base?.status ?? 'MISSING', a0Status: treatment?.status ?? 'MISSING' });
        continue;
      }
      const qualityCmp = compareVectors(treatment.incumbent.qualityVector, base.incumbent.qualityVector);
      if (qualityCmp < 0) qualityRegressions.push({ caseId, repetition });
      if (treatment.searchedStates > base.searchedStates) stateRegressions.push({ caseId, repetition });
      const exactBoth = base.status === 'EXACT' && treatment.status === 'EXACT';
      const sameExact = exactBoth && qualityCmp === 0
        && JSON.stringify(treatment.incumbent.keys) === JSON.stringify(base.incumbent.keys);
      if (exactBoth && !sameExact) exactMismatches.push({ caseId, repetition });
      pairRows.push({ caseId, repetition, histStatus: base.status, a0Status: treatment.status,
        qualityCmp, exactBoth, sameExact, histStates: base.searchedStates, a0States: treatment.searchedStates,
        histMs: base.solverCallWallMs, a0Ms: treatment.solverCallWallMs });
    }
  }

  const deterministicMismatches = [];
  for (const caseId of plan.selectedCaseIds) for (const variant of VARIANTS) {
    const observations = Array.from({ length: plan.repetitionsPerVariant }, (_, i) => byJob(caseId, i + 1, variant))
      .filter(row => row && verified.has(row.runId));
    const fingerprint = row => JSON.stringify([row.status, row.searchedStates, row.incumbent]);
    if (new Set(observations.map(fingerprint)).size > 1) deterministicMismatches.push({ caseId, variant });
  }

  const exactMatrices = [];
  for (const caseId of plan.selectedCaseIds) {
    const observations = VARIANTS.map(variant => Array.from({ length: plan.repetitionsPerVariant }, (_, i) => byJob(caseId, i + 1, variant)));
    if (observations.flat().every(row => row?.status === 'EXACT' && verified.has(row.runId))) {
      const histMedianMs = median(observations[0].map(row => row.solverCallWallMs));
      const a0MedianMs = median(observations[1].map(row => row.solverCallWallMs));
      exactMatrices.push({ caseId, histMedianMs, a0MedianMs, ratio: a0MedianMs / histMedianMs });
    }
  }
  const histWall = exactMatrices.reduce((sum, row) => sum + row.histMedianMs, 0);
  const a0Wall = exactMatrices.reduce((sum, row) => sum + row.a0MedianMs, 0);
  const ratio = histWall > 0 ? a0Wall / histWall : null;
  const p95 = nearestRankP95(exactMatrices.map(row => row.ratio));
  const statusCounts = Object.fromEntries(VARIANTS.map(variant => [variant,
    Object.fromEntries(['EXACT', 'BUDGET_CAPPED', 'TIMEOUT', 'ERROR'].map(status => [status,
      results.filter(row => row.variant === variant && row.status === status).length]))]));
  const exactCount = Object.fromEntries(VARIANTS.map(variant => [variant, statusCounts[variant].EXACT]));
  const gates = {
    allScheduledJobsReturned: terminals.size === plan.plannedRuns,
    noWorkerErrors: results.every(row => row.status !== 'ERROR'),
    noWitnessValidationFailures: validationFailures.length === 0,
    allQualityAndStatePairsComparable: missingComparisons.length === 0,
    noPairedQualityRegressions: qualityRegressions.length === 0,
    noPairedStateRegressions: stateRegressions.length === 0,
    noExactResultMismatches: exactMismatches.length === 0,
    deterministicRepeatedOutputs: deterministicMismatches.length === 0,
    atLeast20MatricesExactInBothConditions: exactMatrices.length >= 20,
    exactA0RunsNotFewerThanHist: exactCount[VARIANTS[1]] >= exactCount[VARIANTS[0]],
    exactSubsetAggregateWallAtLeast5PercentLower: ratio !== null && ratio <= 0.95,
    p95MatrixSlowdownAtMost10Percent: p95 !== null && p95 <= 1.10,
  };
  return {
    status: terminals.size === plan.plannedRuns ? 'ANALYZED' : 'PARTIAL_LEDGER',
    promotionDecision: 'REQUIRES_SEPARATE_APPROVAL',
    scheduleSha256: campaign.scheduleSha256,
    expectedRuns: plan.plannedRuns, recordedResults: terminals.size,
    exactRuns: exactCount, runStatuses: statusCounts,
    comparisonScope: plan.selectedUniqueMatrixCount === plan.uniqueMatrixCount ? 'FULL_SAVED_CORPUS' : 'SELECTED_SUBSET_ONLY',
    timingBoundary: 'cold fresh-worker Dev integrated API call, including ABI and Rust preparation; not isolated DFS kernel',
    pairedRuns: pairRows.length, missingComparisons,
    exactAgreementPairs: pairRows.filter(row => row.sameExact).length,
    exactMismatchPairs: exactMismatches, qualityRegressions, stateRegressions,
    validationFailures, deterministicMismatches,
    workerErrors: results.filter(row => row.status === 'ERROR').map(row => ({ runId: row.runId, message: row.message })),
    exactBothMatrices: exactMatrices.length,
    exactSubsetHistMedianSumMs: histWall, exactSubsetA0MedianSumMs: a0Wall,
    exactSubsetRatio: ratio, matrixRatioP95: p95,
    pairedResults: pairRows, exactMatrixResults: exactMatrices,
    gates, allGatesPass: Object.values(gates).every(Boolean),
  };
}
