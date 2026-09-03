import { decodeAndValidate } from "./pc-input.mjs";
import { queuesForFinder } from "./pattern.mjs";
import { calculatePath, encodePathFumen } from "./path-core.mjs";

export function calculatePathFeature({
  sourceFumen,
  pattern,
  clear = 4,
  solver,
  useHold = true,
}) {
  const { board } = decodeAndValidate(sourceFumen, clear);
  const calculation = calculatePath({
    sourceFumen,
    analysisPattern: pattern,
    solver,
    useHold,
    height: clear,
    board,
  });
  return {
    pathPattern: queuesForFinder(pattern),
    analysisPattern: pattern,
    total: calculation.total,
    solutionCount: calculation.solutions.length,
    coverageCounts: calculation.coverageCounts,
    backend: calculation.backend,
    fumen: encodePathFumen(calculation),
  };
}
