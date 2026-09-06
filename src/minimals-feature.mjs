import { decoder } from "tetris-fumen";
import { boardFromFumenPage } from "./board.mjs";
import { encodePages } from "./fumen.mjs";
import { makeOrderCountQuality, recordOrderCount } from "./human-ranking.mjs";
import { minimumCover } from "./min-cover.mjs";
import { minimumCoverAsync } from "./min-cover-adaptive.mjs";
import { orderMinimalKeysByCoverage } from "./minimal-order.mjs";
import { expandPatternCases } from "./pattern.mjs";
import { collectCompactMinimals } from "./minimals-compact.mjs";
import { enumerateCases, canUsePatternEnumeration } from "./pc-enumeration-engine.mjs";
import { compileExactSaveExpression, prepareSaveCase, prepareSolutionPieceCounts, savedMultiplicityCodePrepared } from "./saves.mjs";

function collectSaveMinimals({
  sourceFumen,
  analysisPattern,
  wantedSave,
  solver,
  useHold = true,
  height = 4,
}) {
  const board = boardFromFumenPage(decoder.decode(sourceFumen)[0], height);
  const cases = expandPatternCases(analysisPattern);
  const queues = cases.map((entry) => entry.queue);
  if (canUsePatternEnumeration({ cases, solver }) && typeof solver.enumeratePcPatternCompact === 'function') {
    const compact = solver.enumeratePcPatternCompact(board, queues, useHold);
    if (compact) return { board, height, cases, queues, ...collectCompactMinimals(compact, cases, wantedSave) };
  }
  const coverage = new Map();
  const qualityIndex = new Map();
  const saveMatches = compileExactSaveExpression(wantedSave);
  const byKey = new Map();
  const saveCases = cases.map((entry) => prepareSaveCase(entry.queue, entry.lastBag));
  const usageByKey = new Map();
  const path = enumerateCases({ board, cases, solver, useHold });

  if (path.mode === "pattern") {
    for (const solution of path.rows) {
      byKey.set(solution.key, solution);
      for (const hit of solution.coverage) {
        const entry = cases[hit.caseIndex];
        if (!entry) throw new Error(`invalid pattern coverage case ${hit.caseIndex}`);
        if (!entry.lastBag) {
          throw new Error(`save analysis branch ${entry.branchIndex + 1} does not end in a bag token`);
        }
        let usage = usageByKey.get(solution.key);
        if (!usage) {
          usage = prepareSolutionPieceCounts(solution);
          usageByKey.set(solution.key, usage);
        }
        if (!saveMatches(savedMultiplicityCodePrepared(saveCases[hit.caseIndex], usage))) continue;
        let keys = coverage.get(entry.caseId);
        if (!keys) {
          keys = new Set();
          coverage.set(entry.caseId, keys);
        }
        keys.add(solution.key);
        recordOrderCount(qualityIndex, entry.caseId, {
          key: solution.key,
          orderCount: hit.orderCount,
        });
      }
    }
  } else {
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const entry = cases[caseIndex];
      const solutions = path.rows[caseIndex];
      if (!entry.lastBag) {
        throw new Error(`save analysis branch ${entry.branchIndex + 1} does not end in a bag token`);
      }
      for (const solution of solutions) {
        byKey.set(solution.key, solution);
        let usage = usageByKey.get(solution.key);
        if (!usage) {
          usage = prepareSolutionPieceCounts(solution);
          usageByKey.set(solution.key, usage);
        }
        if (!saveMatches(savedMultiplicityCodePrepared(saveCases[caseIndex], usage))) continue;
        let keys = coverage.get(entry.caseId);
        if (!keys) {
          keys = new Set();
          coverage.set(entry.caseId, keys);
        }
        keys.add(solution.key);
        recordOrderCount(qualityIndex, entry.caseId, solution);
      }
    }
  }

  return { board, height, cases, queues, coverage, qualityIndex, byKey };
}

function finishSaveMinimals(collected, minimal) {
  if (!Number.isFinite(minimal.count) || !minimal.keys.length) throw new Error("no minimal");
  const { board, height, cases, queues, coverage, byKey } = collected;
  const ordered = orderMinimalKeysByCoverage(minimal.keys, coverage);
  const keys = ordered.keys;
  return {
    board,
    height,
    cases,
    queues,
    get coverage() { return coverage.toMap ? coverage.toMap() : coverage; },
    saveSuccess: coverage.size,
    minimalCount: minimal.count,
    keys,
    solutions: keys.map((key) => byKey.get(key)),
    coverageCounts: ordered.coverageCounts,
    humanQualityVector: minimal.qualityVector ?? [],
    minimumCoverBackend: minimal.backend ?? "rust",
    cardinalityBackend: minimal.cardinalityBackend ?? "rust",
    qualityBackend: minimal.qualityBackend ?? "rust-legacy-exact",
    primaryRequested: minimal.primaryRequested ?? "auto",
    primaryResolved: minimal.primaryResolved ?? "rust",
    useHiGHSRequested: minimal.useHiGHSRequested ?? "auto",
    useHiGHSResolved: minimal.useHiGHSResolved ?? false,
    minimumCoverKernelCases: minimal.minimumCoverKernelCases ?? null,
    minimumCoverKernelSolutions: minimal.minimumCoverKernelSolutions ?? null,
    minimumCoverKernelEntries: minimal.minimumCoverKernelEntries ?? null,
    fastDominancePreviewBudget: minimal.fastDominancePreviewBudget ?? null,
    fastDominancePreviewStates: minimal.fastDominancePreviewStates ?? null,
    fastProbeBudget: minimal.fastProbeBudget ?? null,
    fastProbeStates: minimal.fastProbeStates ?? null,
    fastThresholdBudget: minimal.fastThresholdBudget ?? null,
    fastThresholdStates: minimal.fastThresholdStates ?? null,
    fastFallback: minimal.fastFallback ?? false,
    fastDecision: minimal.fastDecision ?? null,
    humanQualityExact: minimal.qualityExact ?? true,
  };
}

export function calculateLegacySaveMinimals(input) {
  const collected = collectSaveMinimals(input);
  const minimal = minimumCover(collected.coverage, {
    qualityFor: makeOrderCountQuality(collected.qualityIndex),
    solver: input.solver,
  });
  return finishSaveMinimals(collected, minimal);
}

export async function calculateSaveMinimals(input) {
  const collected = collectSaveMinimals(input);
  const minimal = await minimumCoverAsync(collected.coverage, {
    qualityFor: makeOrderCountQuality(collected.qualityIndex),
    solver: input.solver,
    exactQuality: input.exactHumanQuality ?? "fast",
    primary: input.primary ?? input.Primary,
    useHiGHS: input.useHiGHS ?? input.UseHiGHS ?? "auto",
    fastStateBudget: input.fastStateBudget,
    primaryProof: input.primaryProof ?? "standard",
  });
  return finishSaveMinimals(collected, minimal);
}

export const calculateSaveMinimalsAsync = calculateSaveMinimals;
export const calculateSaveMinimalsSync = calculateLegacySaveMinimals;

export function encodeSaveMinimalFumen(calculation) {
  const comments = calculation.coverageCounts.map((count) =>
    `${(count / calculation.queues.length * 100).toFixed(2)}% (${count}/${calculation.queues.length})`);
  return encodePages(
    calculation.board,
    calculation.solutions,
    comments,
    calculation.height ?? 4,
  );
}
