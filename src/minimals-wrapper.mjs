import { calculateLegacySaveMinimals, calculateSaveMinimals, encodeSaveMinimalFumen } from "./minimals-feature.mjs";
import { queuesForFinder } from "./pattern.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

export function calculateLegacyMinimalsFeature({
  sourceFumen,
  pattern,
  wantedSave,
  clear = 4,
  solver,
  useHold = true,
}) {
  decodeAndValidate(sourceFumen, clear);
  const calculation = calculateLegacySaveMinimals({
    sourceFumen,
    analysisPattern: pattern,
    wantedSave,
    solver,
    useHold,
    height: clear,
  });
  return {
    pathPattern: queuesForFinder(pattern),
    analysisPattern: pattern,
    total: calculation.queues.length,
    saveSuccess: calculation.saveSuccess,
    minimalCount: calculation.minimalCount,
    coverageCounts: calculation.coverageCounts,
    fumen: encodeSaveMinimalFumen(calculation),
  };
}


export async function calculateMinimalsFeature({
  sourceFumen,
  pattern,
  wantedSave,
  clear = 4,
  solver,
  useHold = true,
  exactHumanQuality = "Fast",
  primary = undefined, Primary = undefined,
  useHiGHS = undefined,
  UseHiGHS = undefined,
  fastStateBudget = undefined,
  primaryProof = "standard",
}) {
  decodeAndValidate(sourceFumen, clear);
  const calculation = await calculateSaveMinimals({
    sourceFumen,
    analysisPattern: pattern,
    wantedSave,
    solver,
    useHold,
    height: clear,
    exactHumanQuality,
    primary: primary ?? Primary,
    useHiGHS: useHiGHS ?? UseHiGHS ?? "auto",
    fastStateBudget,
    primaryProof,
  });
  return {
    pathPattern: queuesForFinder(pattern),
    analysisPattern: pattern,
    total: calculation.queues.length,
    saveSuccess: calculation.saveSuccess,
    minimalCount: calculation.minimalCount,
    coverageCounts: calculation.coverageCounts,
    fumen: encodeSaveMinimalFumen(calculation),
    minimumCoverBackend: calculation.minimumCoverBackend,
    cardinalityBackend: calculation.cardinalityBackend,
    qualityBackend: calculation.qualityBackend,
    primaryRequested: calculation.primaryRequested,
    primaryResolved: calculation.primaryResolved,
    useHiGHSRequested: calculation.useHiGHSRequested,
    useHiGHSResolved: calculation.useHiGHSResolved,
    minimumCoverKernelCases: calculation.minimumCoverKernelCases,
    minimumCoverKernelSolutions: calculation.minimumCoverKernelSolutions,
    minimumCoverKernelEntries: calculation.minimumCoverKernelEntries,
    fastDominancePreviewBudget: calculation.fastDominancePreviewBudget,
    fastDominancePreviewStates: calculation.fastDominancePreviewStates,
    fastProbeBudget: calculation.fastProbeBudget,
    fastProbeStates: calculation.fastProbeStates,
    fastThresholdBudget: calculation.fastThresholdBudget,
    fastThresholdStates: calculation.fastThresholdStates,
    fastFallback: calculation.fastFallback,
    fastDecision: calculation.fastDecision,
    humanQualityExact: calculation.humanQualityExact,
  };
}

// Compatibility aliases. Production callers should use calculateMinimalsFeature();
// the explicit Legacy name is the synchronous pre-2.1 behavior.
export const calculateMinimalsFeatureAsync = calculateMinimalsFeature;
export const calculateMinimalsFeatureSync = calculateLegacyMinimalsFeature;
