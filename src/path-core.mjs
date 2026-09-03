import { decoder } from "tetris-fumen";
import { boardFromFumenPage } from "./board.mjs";
import { encodePages } from "./fumen.mjs";
import { expandPatternCases } from "./pattern.mjs";
import { canUsePatternEnumeration, enumerateCases } from "./pc-enumeration-engine.mjs";
import { PC_ROUTING_PROFILES } from "./pc-routing-policy.mjs";

export const PATH_FOUR_LINE_PATTERN_MIN_CASES = PC_ROUTING_PROFILES.path.fourLinePatternMinCases;
export const PATH_TALL_PATTERN_MIN_CASES = PC_ROUTING_PROFILES.path.tallPatternMinCases;

function geometryOf(solution) {
  return { masks: solution.masks, key: solution.key };
}

function compareCoverageRows(left, right) {
  return right.coverageCount - left.coverageCount
    || left.solution.key.localeCompare(right.solution.key);
}

function collectCompactPatternPath(packed) {
  const ordered = packed.solutions.map((solution, index) => ({
    solution,
    coverageCount: packed.coverageCounts[index],
  }));
  ordered.sort(compareCoverageRows);
  return ordered;
}

function collectPatternPath(rows) {
  const ordered = rows.map((solution) => ({
    solution: geometryOf(solution),
    coverageCount: solution.coverage.length,
  }));
  ordered.sort(compareCoverageRows);
  return ordered;
}

function collectScalarPath(rows) {
  const byKey = new Map();

  for (const solutions of rows) {
    for (const solution of solutions) {
      const current = byKey.get(solution.key);
      if (current) current.coverageCount += 1;
      else byKey.set(solution.key, { solution: geometryOf(solution), coverageCount: 1 });
    }
  }

  const ordered = [...byKey.values()];
  ordered.sort(compareCoverageRows);
  return ordered;
}

export function calculatePath({
  sourceFumen,
  analysisPattern,
  solver,
  useHold = true,
  height = 4,
  board = null,
  fourLinePatternMinCases = PATH_FOUR_LINE_PATTERN_MIN_CASES,
  tallPatternMinCases = PATH_TALL_PATTERN_MIN_CASES,
}) {
  const initialBoard = board ?? boardFromFumenPage(decoder.decode(sourceFumen)[0], height);
  const cases = expandPatternCases(analysisPattern);
  const queues = cases.map((entry) => entry.queue);
  let backend;
  let ordered;

  if (typeof solver.enumeratePcPath === "function" && canUsePatternEnumeration({
    cases,
    solver,
    fourLineMinCases: fourLinePatternMinCases,
    tallMinCases: tallPatternMinCases,
  })) {
    const packed = solver.enumeratePcPath(initialBoard, queues, useHold);
    if (packed && Array.isArray(packed.solutions)) {
      backend = "pattern";
      ordered = collectCompactPatternPath(packed);
    }
  }

  if (!ordered) {
    const path = enumerateCases({
      board: initialBoard,
      cases,
      solver,
      useHold,
      fourLinePatternMinCases,
      tallPatternMinCases,
    });
    backend = path.mode;
    ordered = path.mode === "pattern"
      ? collectPatternPath(path.rows)
      : collectScalarPath(path.rows);
  }

  return {
    board: initialBoard,
    height,
    cases,
    total: cases.length,
    backend,
    solutions: ordered.map((entry) => entry.solution),
    coverageCounts: ordered.map((entry) => entry.coverageCount),
  };
}

export function encodePathFumen(calculation) {
  if (calculation.solutions.length === 0) return null;
  const total = calculation.total;
  const comments = calculation.coverageCounts.map((count) =>
    `${(count / total * 100).toFixed(2)}% (${count}/${total})`);
  return encodePages(
    calculation.board,
    calculation.solutions,
    comments,
    calculation.height ?? 4,
  );
}
