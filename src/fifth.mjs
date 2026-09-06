import { decoder } from "tetris-fumen";
import { boardFromFumenPage } from "./board.mjs";
import { combineWithIntro, solutionPage } from "./fumen.mjs";
import { makeOrderCountQuality, recordOrderCount } from "./human-ranking.mjs";
import { minimumCover } from "./min-cover.mjs";
import { minimumCoverAdaptiveAsync } from "./min-cover-adaptive.mjs";
import { expandPatternCases } from "./pattern.mjs";
import { visitCaseSolutions } from "./pc-enumeration-engine.mjs";
import {
  compileSaveExpression,
  prepareSaveCase,
  prepareSolutionPieceCounts,
  savedMaskPrepared,
} from "./saves.mjs";
import { TETRIS_DISPLAY_ORDER } from "./piece-order.mjs";

export const FIFTH_PIECES = TETRIS_DISPLAY_ORDER;
export const FIFTH_DISPLAY_ORDER = "SZOLJIT";
export const FIFTH_BESTSAVE_PIECES = "ILJSZO";
export const fifthSaveCondition = (piece) => [...FIFTH_PIECES].filter((value) => value !== piece).join("");

function caseSeesPiece(entry, piece) {
  const drawCount = (entry.observedBag ?? entry.lastBag)?.drawCount ?? 0;
  return drawCount > 0 && entry.queue.slice(-drawCount).includes(piece);
}

function collectFifth({ sourceFumen, analysisPattern, solver, useHold }) {
  const board = boardFromFumenPage(decoder.decode(sourceFumen)[0]);
  const cases = expandPatternCases(analysisPattern);
  const queues = cases.map((entry) => entry.queue);
  const all = new Map(cases.map((entry) => [entry.caseId, []]));
  const saveMasks = new Map(cases.map((entry) => [entry.caseId, new Map()]));
  const qualityIndex = new Map();
  const saveCases = cases.map((entry) => {
    if (!entry.lastBag) {
      throw new Error(`5th analysis branch ${entry.branchIndex + 1} does not end in a bag token`);
    }
    return prepareSaveCase(entry.queue, entry.lastBag);
  });
  const usageByKey = new Map();
  const { byKey } = visitCaseSolutions({
    board,
    cases,
    solver,
    useHold,
    trackCaseSolutions: false,
    visit: (entry, caseIndex, solution, orderCount) => {
      let usage = usageByKey.get(solution.key);
      if (!usage) {
        usage = prepareSolutionPieceCounts(solution);
        usageByKey.set(solution.key, usage);
      }
      all.get(entry.caseId).push(solution);
      saveMasks.get(entry.caseId).set(solution.key, savedMaskPrepared(saveCases[caseIndex], usage));
      recordOrderCount(qualityIndex, entry.caseId, { key: solution.key, orderCount });
    },
  });
  return { board, cases, queues, all, saveMasks, byKey, qualityFor: makeOrderCountQuality(qualityIndex) };
}

function buildFifthCoverage(collected, piece) {
  const wanted = fifthSaveCondition(piece);
  const table = compileSaveExpression(wanted);
  const coverage = new Map();
  let success = 0;
  let seen = 0;
  for (const entry of collected.cases) {
    if (!caseSeesPiece(entry, piece)) continue;
    seen += 1;
    const rows = collected.all.get(entry.caseId) ?? [];
    const masks = collected.saveMasks.get(entry.caseId);
    let keys = null;
    for (const solution of rows) {
      if (!table[masks?.get(solution.key) ?? 0]) continue;
      if (!keys) keys = new Set();
      keys.add(solution.key);
    }
    if (keys?.size) {
      success += 1;
      coverage.set(entry.caseId, keys);
    }
  }
  return { coverage, success, seen };
}

function finishFifthPiece(collected, piece, data, minimal) {
  const availability = data.seen ? data.success / data.seen : 0;
  const isSee = data.seen > 0 && data.success === data.seen;
  const label = isSee ? `See ${piece}` : `Use ${piece}`;
  const usage = {
    piece,
    success: data.success,
    total: collected.queues.length,
    seen: data.seen,
    availability,
    isSee,
    label,
  };
  if (!data.success || !minimal) {
    return { usage, result: { minimalCount: 0, keys: [], solutions: [], humanQualityVector: [], humanQualityExact: true } };
  }
  const keys = [...minimal.keys].sort();
  return {
    usage,
    result: {
      minimalCount: minimal.count,
      keys,
      solutions: keys.map((key) => collected.byKey.get(key)),
      humanQualityVector: minimal.qualityVector ?? [],
      minimumCoverBackend: minimal.backend ?? "rust-legacy",
      primaryRequested: minimal.primaryRequested ?? "auto",
      primaryResolved: minimal.primaryResolved ?? "rust",
      cardinalityBackend: minimal.cardinalityBackend ?? null,
      qualityBackend: minimal.qualityBackend ?? null,
      humanQualityExact: minimal.qualityExact ?? true,
    },
  };
}

// Legacy synchronous exact implementation retained for compatibility/reference.
export function fifthMinimalsPerSaves({ sourceFumen, analysisPattern, solver, useHold = true }) {
  const collected = collectFifth({ sourceFumen, analysisPattern, solver, useHold });
  const usages = {};
  const results = {};
  for (const piece of FIFTH_DISPLAY_ORDER) {
    const data = buildFifthCoverage(collected, piece);
    const minimal = data.success
      ? minimumCover(data.coverage, { qualityFor: collected.qualityFor, solver })
      : null;
    const finished = finishFifthPiece(collected, piece, data, minimal);
    usages[piece] = finished.usage;
    results[piece] = finished.result;
  }
  const bestsave = [...FIFTH_BESTSAVE_PIECES].every((piece) => usages[piece].isSee);
  return { board: collected.board, cases: collected.cases, queues: collected.queues, all: collected.all, usages, results, bestsave };
}

export async function fifthMinimalsPerSavesAsync({
  sourceFumen,
  analysisPattern,
  solver,
  useHold = true,
  exactHumanQuality = "true",
  primary = undefined, Primary = undefined,
  useHiGHS = "auto",
  fastStateBudget = undefined,
  tinyExactMaxCandidates = 48,
}) {
  const collected = collectFifth({ sourceFumen, analysisPattern, solver, useHold });
  const usages = {};
  const results = {};
  for (const piece of FIFTH_DISPLAY_ORDER) {
    const data = buildFifthCoverage(collected, piece);
    const minimal = data.success
      ? await minimumCoverAdaptiveAsync(data.coverage, {
        qualityFor: collected.qualityFor,
        solver,
        exactQuality: exactHumanQuality,
        primary: primary ?? Primary,
        useHiGHS,
        fastStateBudget,
        tinyExactMaxCandidates,
      })
      : null;
    const finished = finishFifthPiece(collected, piece, data, minimal);
    usages[piece] = finished.usage;
    results[piece] = finished.result;
  }
  const bestsave = [...FIFTH_BESTSAVE_PIECES].every((piece) => usages[piece].isSee);
  return { board: collected.board, cases: collected.cases, queues: collected.queues, all: collected.all, usages, results, bestsave };
}

export function encodeFifthCombined({ sourceFumen, title, calculation }) {
  const pages = [];
  const pageCounts = {};
  for (const piece of FIFTH_DISPLAY_ORDER) {
    const result = calculation.results[piece];
    pageCounts[piece] = result.solutions.length;
    for (const solution of result.solutions) {
      const usage = calculation.usages[piece];
      const comment = usage.isSee ? `☆ ${usage.label}` : usage.label;
      pages.push(solutionPage(calculation.board, solution, comment));
    }
  }
  return { fumen: combineWithIntro(sourceFumen, title, pages), pageCounts };
}
