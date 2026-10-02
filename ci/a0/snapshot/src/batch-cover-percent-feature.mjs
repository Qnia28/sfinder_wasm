import { calculateChanceCountFromBoard } from './chance-feature.mjs';
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
  outputMode = "queues",
  maxBatchPrefixes = 65536,
}) {
  if (!["queues","count"].includes(outputMode)) throw new RangeError(`unsupported cover-percent outputMode '${outputMode}'`);
  const countOnly = outputMode === "count";
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
    outputMode: countOnly ? "count" : "coverage",
    maxBatchPrefixes,
  });
  const percentQueues = countOnly ? null : expandPattern(percentInput);
  const solver = await pcSolver(clear);
  try {
    const rows = [];
    const solveCache = new Map();
    for (const target of cover.targets) {
      const occupied = target.base | target.operations.reduce((mask, operation) => mask | operation.mask, 0n);
      const cacheKey = occupied.toString(16);
      let solve = solveCache.get(cacheKey);
      if (solve === undefined) {
        solve = countOnly ? calculateChanceCountFromBoard({board:occupied,pattern:percentInput,clear,solver,useHold,maxBatchPrefixes}) : solveQueuesExistence({
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
        coverPercent: countOnly ? (BigInt(cover.totalExact) ? Number(BigInt(target.coverageExact)*100000000000000n/BigInt(cover.totalExact))/1000000000000 : 0) : cover.total ? target.coverage / cover.total * 100 : 0,
        solve: countOnly ? solve.success : solve,
        solveTotal: countOnly ? solve.total : percentQueues.length,
        solvePercent: countOnly ? solve.percent : percentQueues.length ? solve / percentQueues.length * 100 : 0,
        ...(countOnly ? {coveredExact:target.coverageExact,solveExact:solve.successExact,solveTotalExact:solve.totalExact} : {}),
      });
    }
    rows.sort((left, right) => countOnly
      ? (BigInt(left.solveExact)>BigInt(right.solveExact)?-1:BigInt(left.solveExact)<BigInt(right.solveExact)?1:
         BigInt(left.coveredExact)>BigInt(right.coveredExact)?-1:BigInt(left.coveredExact)<BigInt(right.coveredExact)?1:0)
      : (
      right.solvePercent - left.solvePercent || right.coverPercent - left.coverPercent
    ));
    const fumen = encoder.encode(rows.map((row) => solutionPage(
      row.base,
      row.solution,
      `Cover: ${Number(row.coverPercent.toFixed(2))}, Solve: ${Number(row.solvePercent.toFixed(2))}`,
      clear,
    )));
    return {
      ...(countOnly ? {outputMode,totalExact:cover.totalExact,coveredExact:cover.coveredExact,failedExact:cover.failedExact} : {}),
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
