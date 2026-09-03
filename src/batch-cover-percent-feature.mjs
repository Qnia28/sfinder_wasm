import { encoder } from "tetris-fumen";
import { calculateCover } from "./batch-cover-feature.mjs";
import { pcSolver, solutionFromOps } from "./batch-feature-common.mjs";
import { solutionPage } from "./fumen.mjs";
import { solveQueuesExistence } from "./pc-enumeration-engine.mjs";
import { expandPattern } from "./pattern.mjs";

export async function calculateCoverPercent({
  sourceFumen,
  pattern,
  coverPattern,
  percentPattern,
  clear = 4,
  mode = "normal",
  mirror = "no",
  useHold = true,
}) {
  const coverInput = coverPattern ?? pattern;
  const percentInput = percentPattern ?? pattern;
  if (!coverInput || !percentInput) throw new Error("cover and percent patterns are required");

  const cover = await calculateCover({
    sourceFumen,
    pattern: coverInput,
    clear,
    mode,
    mirror,
    useHold,
  });
  const percentQueues = expandPattern(percentInput);
  const solver = await pcSolver(clear);
  try {
    const rows = [];
    const solveCache = new Map();
    for (const target of cover.targets) {
      const occupied = target.base | target.operations.reduce((mask, operation) => mask | operation.mask, 0n);
      const cacheKey = occupied.toString(16);
      let solve = solveCache.get(cacheKey);
      if (solve === undefined) {
        solve = solveQueuesExistence({
          board: occupied,
          queues: percentQueues,
          solver,
          useHold,
        }).reduce((count, possible) => count + (possible ? 1 : 0), 0);
        solveCache.set(cacheKey, solve);
      }
      const solution = solutionFromOps(target.operations);
      rows.push({
        solution,
        base: target.base,
        mirror: !!target.mirror,
        covered: target.coverage,
        coverPercent: cover.total ? target.coverage / cover.total * 100 : 0,
        solve,
        solveTotal: percentQueues.length,
        solvePercent: percentQueues.length ? solve / percentQueues.length * 100 : 0,
      });
    }
    rows.sort((left, right) => (
      right.solvePercent - left.solvePercent || right.coverPercent - left.coverPercent
    ));
    const fumen = encoder.encode(rows.map((row) => solutionPage(
      row.base,
      row.solution,
      `Cover: ${Number(row.coverPercent.toFixed(2))}, Solve: ${Number(row.solvePercent.toFixed(2))}`,
      clear,
    )));
    return {
      coverPattern: cover.pathPattern,
      percentPattern: percentInput,
      covered: cover.covered,
      total: cover.total,
      failed: cover.failed,
      totalCoverPercent: cover.percent,
      solutions: rows,
      count: rows.length,
      fumen,
    };
  } finally {
    solver.close();
  }
}
