import {
  calculatePerSaveMinimals,
  calculatePerSaveMinimalsAsync,
  encodePerSaveMinimals,
  resolvePerSaveTargetLines,
} from "./per-save-minimals.mjs";
import { decodeAndValidate } from "./pc-input.mjs";

export function calculateLegacyPerSaveMinimalsFeature({
  sourceFumen,
  pattern,
  title = "",
  targetLines,
  clear,
  solver,
  useHold = true,
  candidateLimit = 16,
}) {
  const resolved = resolvePerSaveTargetLines({ targetLines, clear });
  decodeAndValidate(sourceFumen, resolved);
  const calculation = calculatePerSaveMinimals({
    sourceFumen,
    pattern,
    solver,
    useHold,
    targetLines: resolved,
    candidateLimit,
  });
  const encoded = encodePerSaveMinimals({ sourceFumen, title, calculation });
  const results = {};
  for (const [piece, result] of Object.entries(calculation.results)) {
    results[piece] = {
      piece: result.piece,
      success: result.success,
      pcSuccess: result.pcSuccess,
      total: result.total,
      saveRate: result.saveRate,
      guaranteed: result.guaranteed,
      minimalCount: result.minimalCount,
      coverageCounts: result.coverageCounts,
      playableOrderCount: result.playableOrderCount,
      label: result.label,
    };
  }
  return {
    targetLines: calculation.targetLines,
    occupiedCells: calculation.occupiedCells,
    remainingCells: calculation.remainingCells,
    piecesNeeded: calculation.piecesNeeded,
    expectedQueueLength: calculation.expectedQueueLength,
    total: calculation.total,
    pcSuccess: calculation.pcSuccess,
    pcRate: calculation.pcRate,
    results,
    pageCounts: encoded.pageCounts,
    fumen: encoded.fumen,
  };
}

export async function calculatePerSaveMinimalsFeature({
  sourceFumen,
  pattern,
  title = "",
  targetLines,
  clear,
  solver,
  useHold = true,
  candidateLimit = 16,
  exactHumanQuality = "true",
  primary = undefined, Primary = undefined,
  useHiGHS = undefined,
  UseHiGHS = undefined,
  fastStateBudget = undefined,
}) {
  const resolved = resolvePerSaveTargetLines({ targetLines, clear });
  decodeAndValidate(sourceFumen, resolved);
  const calculation = await calculatePerSaveMinimalsAsync({
    sourceFumen,
    pattern,
    solver,
    useHold,
    targetLines: resolved,
    candidateLimit,
    exactHumanQuality,
    primary: primary ?? Primary,
    useHiGHS: useHiGHS ?? UseHiGHS ?? "auto",
    fastStateBudget,
    includeCoverage: false,
  });
  const encoded = encodePerSaveMinimals({ sourceFumen, title, calculation });
  const results = {};
  for (const [piece, result] of Object.entries(calculation.results)) {
    results[piece] = {
      piece: result.piece,
      success: result.success,
      pcSuccess: result.pcSuccess,
      total: result.total,
      saveRate: result.saveRate,
      guaranteed: result.guaranteed,
      minimalCount: result.minimalCount,
      coverageCounts: result.coverageCounts,
      playableOrderCount: result.playableOrderCount,
      label: result.label,
      humanQualityExact: result.humanQualityExact,
      minimumCoverBackend: result.minimumCoverBackend,
      primaryRequested: result.primaryRequested,
      primaryResolved: result.primaryResolved,
      cardinalityBackend: result.cardinalityBackend,
      qualityBackend: result.qualityBackend,
    };
  }
  return {
    targetLines: calculation.targetLines,
    occupiedCells: calculation.occupiedCells,
    remainingCells: calculation.remainingCells,
    piecesNeeded: calculation.piecesNeeded,
    expectedQueueLength: calculation.expectedQueueLength,
    total: calculation.total,
    pcSuccess: calculation.pcSuccess,
    pcRate: calculation.pcRate,
    results,
    pageCounts: encoded.pageCounts,
    fumen: encoded.fumen,
  };
}

export const calculatePerSaveMinimalsFeatureAsync = calculatePerSaveMinimalsFeature;
export const calculatePerSaveMinimalsFeatureSync = calculateLegacyPerSaveMinimalsFeature;
