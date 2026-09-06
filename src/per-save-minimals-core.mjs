import {primaryRequest} from "./primary-backend.mjs";
import { makeOrderCountQuality, recordOrderCount } from "./human-ranking.mjs";
import { minimumCover } from "./min-cover.mjs";
import { minimumCoverAdaptiveAsync } from "./min-cover-adaptive.mjs";
import { orderMinimalKeysByCoverage } from "./minimal-order.mjs";
import { canUsePatternEnumeration, enumerateCases, visitCaseSolutions } from "./pc-enumeration-engine.mjs";
import { pieceFromRustCode } from "./piece-order.mjs";
import { PER_SAVE_DISPLAY_ORDER, unusedPieceForSolution } from "./save-piece.mjs";
import { requirePositiveQuality } from "./quality-contract.mjs";
import {
  prepareQueuePieceCounts,
  prepareSolutionPieceCounts,
  unusedPiecePrepared,
} from "./saves.mjs";

export { PER_SAVE_DISPLAY_ORDER, unusedPieceForSolution } from "./save-piece.mjs";

function normalizeCases(queues) {
  return queues.map((entry, index) =>
    typeof entry === "string" ? { caseId: `legacy:${index}`, queue: entry } : entry);
}

export function perSaveLabel(piece, { pcSuccess, success, saveRate, guaranteed }) {
  if (guaranteed) return `☆ Save ${piece}`;
  if (pcSuccess === 0 || saveRate === null) return `Save ${piece} (N/A)`;
  return `Save ${piece} (${(saveRate * 100).toFixed(2)}%)`;
}

function directSingleQueueResult({ board, cases, direct, displayOrder }) {
  const entry = cases[0];
  const bestByPiece = new Map();
  for (const solution of direct) {
    const piece = pieceFromRustCode(solution.saved);
    if (piece) bestByPiece.set(piece, solution);
  }
  const pcSuccess = direct.length ? 1 : 0;
  const results = {};
  for (const piece of displayOrder) {
    const solution = bestByPiece.get(piece);
    const success = solution ? 1 : 0;
    const saveRate = pcSuccess === 0 ? null : success / pcSuccess;
    const guaranteed = pcSuccess > 0 && success === pcSuccess;
    const coverage = new Map();
    if (solution) coverage.set(entry.caseId, new Set([solution.key]));
    const playableOrderCount = solution ? requirePositiveQuality(solution.orderCount, {
      key: solution.key,
      caseId: entry.caseId,
      label: "playableOrderCount",
    }) : null;
    const data = {
      piece,
      success,
      pcSuccess,
      total: 1,
      saveRate,
      guaranteed,
      minimalCount: success,
      keys: solution ? [solution.key] : [],
      solutions: solution ? [solution] : [],
      coverageCounts: solution ? [1] : [],
      coverage,
      humanQualityVector: solution ? [playableOrderCount] : [],
      playableOrderCount,
      minimumCoverBackend: "direct",
      cardinalityBackend: "direct",
      qualityBackend: "direct-exact",
      humanQualityExact: true,
    };
    data.label = perSaveLabel(piece, data);
    results[piece] = data;
  }
  return { board, queues: [entry.queue], total: 1, pcSuccess, pcRate: pcSuccess, results };
}

function collectPerSaveData({ board, cases, solver, useHold, displayOrder }) {
  const coverageByPiece = new Map([...displayOrder].map((piece) => [piece, new Map()]));
  const qualityIndex = new Map();
  const queueCounts = cases.map((entry) => prepareQueuePieceCounts(entry.queue));
  const usageByKey = new Map();
  const { caseHasSolution, byKey } = visitCaseSolutions({
    board,
    cases,
    solver,
    useHold,
    visit: (entry, caseIndex, solution, orderCount) => {
      recordOrderCount(qualityIndex, entry.caseId, { key: solution.key, orderCount });
      let usage = usageByKey.get(solution.key);
      if (!usage) {
        usage = prepareSolutionPieceCounts(solution);
        usageByKey.set(solution.key, usage);
      }
      const saved = unusedPiecePrepared(queueCounts[caseIndex], usage);
      let keys = coverageByPiece.get(saved).get(entry.caseId);
      if (!keys) {
        keys = new Set();
        coverageByPiece.get(saved).set(entry.caseId, keys);
      }
      keys.add(solution.key);
    },
  });
  return {
    coverageByPiece,
    qualityFor: makeOrderCountQuality(qualityIndex),
    byKey,
    pcSuccess: caseHasSolution.reduce((count, value) => count + value, 0),
  };
}

function finishPieceResult({
  piece, coverage, successOverride = null, coverageCountForKey = null,
  pcSuccess, total, minimal, byKey,
}) {
  const success = successOverride ?? coverage.size;
  const saveRate = pcSuccess === 0 ? null : success / pcSuccess;
  const guaranteed = pcSuccess > 0 && success === pcSuccess;
  let minimalCount = 0;
  let keys = [];
  let solutions = [];
  let coverageCounts = [];
  let humanQualityVector = [];
  if (minimal && Number.isFinite(minimal.count) && minimal.keys.length) {
    minimalCount = minimal.count;
    if (coverageCountForKey) {
      const ordered = minimal.keys
        .map((key) => ({ key, coverageCount: coverageCountForKey(key) }))
        .sort((left, right) => right.coverageCount - left.coverageCount || left.key.localeCompare(right.key));
      keys = ordered.map((row) => row.key);
      coverageCounts = ordered.map((row) => row.coverageCount);
    } else {
      const ordered = orderMinimalKeysByCoverage(minimal.keys, coverage);
      keys = ordered.keys;
      coverageCounts = ordered.coverageCounts;
    }
    solutions = keys.map((key) => byKey.get(key));
    humanQualityVector = minimal.qualityVector ?? [];
  }
  const data = {
    piece,
    success,
    pcSuccess,
    total,
    saveRate,
    guaranteed,
    minimalCount,
    keys,
    solutions,
    coverageCounts,
    coverage: coverage ?? new Map(),
    humanQualityVector,
    playableOrderCount: total === 1 && solutions.length
      ? requirePositiveQuality(humanQualityVector[0], {
        key: keys[0] ?? null,
        label: "playableOrderCount",
      })
      : null,
    minimumCoverBackend: minimal?.backend ?? (success > 0 ? "rust-legacy" : null),
    primaryRequested: minimal?.primaryRequested ?? "auto",
    primaryResolved: minimal?.primaryResolved ?? null,
    cardinalityBackend: minimal?.cardinalityBackend ?? null,
    qualityBackend: minimal?.qualityBackend ?? null,
    humanQualityExact: minimal?.qualityExact ?? true,
  };
  data.label = perSaveLabel(piece, data);
  return data;
}

function maybeDirect({ board, cases, solver, useHold, candidateLimit, displayOrder }) {
  if (cases.length !== 1 || typeof solver.perSaveBest !== "function") return null;
  const direct = solver.perSaveBest(board, cases[0].queue, useHold, { candidateLimit });
  return Array.isArray(direct) ? directSingleQueueResult({ board, cases, direct, displayOrder }) : null;
}

function collectPatternPerSaveNumeric({ board, cases, solver, useHold, displayOrder }) {
  const path = enumerateCases({ board, cases, solver, useHold });
  if (path.mode !== "pattern") return null;
  const solutions = [...path.rows].sort((left, right) => left.key.localeCompare(right.key));
  const idByKey = new Map(solutions.map((solution, id) => [solution.key, id]));
  const byKey = new Map(solutions.map((solution) => [solution.key, solution]));
  const pieceIndex = new Map([...displayOrder].map((piece, index) => [piece, index]));
  const rowsByPiece = Array.from({ length: displayOrder.length }, () => Array(cases.length));
  const coverageCountsByPiece = Array.from(
    { length: displayOrder.length }, () => new Uint32Array(solutions.length),
  );
  const candidateSeenByPiece = Array.from(
    { length: displayOrder.length }, () => new Uint8Array(solutions.length),
  );
  const candidateCounts = new Uint32Array(displayOrder.length);
  const caseHasSolution = new Uint8Array(cases.length);
  const queueCounts = cases.map((entry) => prepareQueuePieceCounts(entry.queue));
  const usageById = new Array(solutions.length);

  for (const solution of path.rows) {
    const id = idByKey.get(solution.key);
    let usage = usageById[id];
    if (!usage) usageById[id] = usage = prepareSolutionPieceCounts(solution);
    for (const hit of solution.coverage) {
      const caseIndex = hit.caseIndex;
      caseHasSolution[caseIndex] = 1;
      const saved = unusedPiecePrepared(queueCounts[caseIndex], usage);
      const pi = pieceIndex.get(saved);
      if (pi === undefined) throw new Error(`invalid saved piece ${String(saved)}`);
      let row = rowsByPiece[pi][caseIndex];
      if (!row) rowsByPiece[pi][caseIndex] = row = [];
      row.push([id, requirePositiveQuality(hit.orderCount, {
        key: solution.key,
        caseId: cases[caseIndex]?.caseId ?? caseIndex,
        label: "playableOrderCount",
      })]);
      coverageCountsByPiece[pi][id] += 1;
      if (!candidateSeenByPiece[pi][id]) {
        candidateSeenByPiece[pi][id] = 1;
        candidateCounts[pi] += 1;
      }
    }
  }
  return {
    solutions, byKey, rowsByPiece, coverageCountsByPiece, candidateCounts,
    pcSuccess: caseHasSolution.reduce((count, value) => count + value, 0),
  };
}

function numericRowsToCoverage(rows, cases, solutions) {
  const coverage = new Map();
  const qualityIndex = new Map();
  for (let caseIndex = 0; caseIndex < rows.length; caseIndex += 1) {
    const row = rows[caseIndex];
    if (!row?.length) continue;
    const caseId = cases[caseIndex].caseId;
    const keys = new Set();
    const qualityByKey = new Map();
    for (const [id, quality] of row) {
      const key = solutions[id].key;
      keys.add(key);
      qualityByKey.set(key, quality);
    }
    coverage.set(caseId, keys);
    qualityIndex.set(caseId, qualityByKey);
  }
  return { coverage, qualityFor: makeOrderCountQuality(qualityIndex) };
}

// Legacy synchronous exact API retained for compatibility/reference.
export function calculatePerSaveMinimalsFromBoard({
  board,
  queues,
  solver,
  useHold = true,
  displayOrder = PER_SAVE_DISPLAY_ORDER,
  candidateLimit = 16,
}) {
  const cases = normalizeCases(queues);
  const direct = maybeDirect({ board, cases, solver, useHold, candidateLimit, displayOrder });
  if (direct) return direct;
  const collected = collectPerSaveData({ board, cases, solver, useHold, displayOrder });
  const results = {};
  for (const piece of displayOrder) {
    const coverage = collected.coverageByPiece.get(piece);
    const minimal = coverage.size > 0
      ? minimumCover(coverage, { qualityFor: collected.qualityFor, solver })
      : null;
    results[piece] = finishPieceResult({
      piece,
      coverage,
      pcSuccess: collected.pcSuccess,
      total: cases.length,
      minimal,
      byKey: collected.byKey,
    });
  }
  return {
    board,
    queues: cases.map((entry) => entry.queue),
    total: cases.length,
    pcSuccess: collected.pcSuccess,
    pcRate: cases.length === 0 ? null : collected.pcSuccess / cases.length,
    results,
  };
}

// Production adaptive API. Exact human-quality remains the default.
export async function calculatePerSaveMinimalsFromBoardAsync({
  board,
  queues,
  solver,
  useHold = true,
  displayOrder = PER_SAVE_DISPLAY_ORDER,
  candidateLimit = 16,
  exactHumanQuality = "true",
  primary = undefined, Primary = undefined,
  useHiGHS = "auto",
  fastStateBudget = undefined,
  tinyExactMaxCandidates = 48,
  includeCoverage = true,
}) {
  const cases = normalizeCases(queues);
  const requestedPrimary = primaryRequest({primary, Primary, useHiGHS});
  const direct = requestedPrimary === "auto" ? maybeDirect({ board, cases, solver, useHold, candidateLimit, displayOrder }) : null;
  if (direct) return direct;

  const tinyLimit = Math.max(0, Math.floor(Number(tinyExactMaxCandidates) || 0));
  const canUseNumericPattern = typeof solver?.minimumCoverIds === "function"
    && canUsePatternEnumeration({ cases, solver });
  if (canUseNumericPattern) {
    const numeric = collectPatternPerSaveNumeric({ board, cases, solver, useHold, displayOrder });
    if (numeric) {
      const results = {};
      const idByKey = new Map(numeric.solutions.map((solution, id) => [solution.key, id]));
      for (let pi = 0; pi < displayOrder.length; pi += 1) {
        const piece = displayOrder[pi];
        const rows = numeric.rowsByPiece[pi];
        const activeRows = rows.filter((row) => row?.length);
        const candidateCount = numeric.candidateCounts[pi];
        let coverage = null;
        let minimal = null;
        let coverageCountForKey = null;

        if (requestedPrimary === "auto" && activeRows.length > 0 && tinyLimit > 0 && candidateCount <= tinyLimit) {
          const exact = solver.minimumCoverIds(activeRows, numeric.solutions.length);
          if (exact && Number.isFinite(exact.count)) {
            minimal = {
              count: exact.count,
              keys: exact.selectedIds.map((id) => numeric.solutions[id].key),
              qualityVector: exact.qualityVector,
              searchedStates: exact.searchedStates ?? 0,
              primaryRequested: requestedPrimary, primaryResolved: "rust",
              backend: "rust-legacy",
              cardinalityBackend: "rust-legacy-integrated",
              qualityBackend: "rust-legacy-exact",
              qualityExact: true,
            };
            coverageCountForKey = (key) => {
              const id = idByKey.get(key);
              return id === undefined ? 0 : numeric.coverageCountsByPiece[pi][id];
            };
          }
        }

        if (activeRows.length > 0 && !minimal) {
          const converted = numericRowsToCoverage(rows, cases, numeric.solutions);
          coverage = converted.coverage;
          minimal = await minimumCoverAdaptiveAsync(coverage, {
            qualityFor: converted.qualityFor,
            solver,
            exactQuality: exactHumanQuality,
            primary: primary ?? Primary,
            useHiGHS,
            fastStateBudget,
            tinyExactMaxCandidates,
          });
        } else if (includeCoverage && activeRows.length > 0) {
          coverage = numericRowsToCoverage(rows, cases, numeric.solutions).coverage;
        }

        results[piece] = finishPieceResult({
          piece,
          coverage,
          successOverride: activeRows.length,
          coverageCountForKey,
          pcSuccess: numeric.pcSuccess,
          total: cases.length,
          minimal,
          byKey: numeric.byKey,
        });
      }
      return {
        board,
        queues: cases.map((entry) => entry.queue),
        total: cases.length,
        pcSuccess: numeric.pcSuccess,
        pcRate: cases.length === 0 ? null : numeric.pcSuccess / cases.length,
        results,
      };
    }
  }

  const collected = collectPerSaveData({ board, cases, solver, useHold, displayOrder });
  const results = {};
  for (const piece of displayOrder) {
    const coverage = collected.coverageByPiece.get(piece);
    const minimal = coverage.size > 0
      ? await minimumCoverAdaptiveAsync(coverage, {
        qualityFor: collected.qualityFor,
        solver,
        exactQuality: exactHumanQuality,
        primary: primary ?? Primary,
        useHiGHS,
        fastStateBudget,
        tinyExactMaxCandidates,
      })
      : null;
    results[piece] = finishPieceResult({
      piece,
      coverage,
      pcSuccess: collected.pcSuccess,
      total: cases.length,
      minimal,
      byKey: collected.byKey,
    });
  }
  return {
    board,
    queues: cases.map((entry) => entry.queue),
    total: cases.length,
    pcSuccess: collected.pcSuccess,
    pcRate: cases.length === 0 ? null : collected.pcSuccess / cases.length,
    results,
  };
}
