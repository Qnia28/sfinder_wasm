import { decoder, encoder } from "tetris-fumen";
import { coverTargets } from "./batch-cover.mjs";
import { batchReachability, boolMirror, solutionFromOps } from "./batch-feature-common.mjs";
import { fieldMasks } from "./batch-geometry.mjs";
import { findCongruentSolutions } from "./batch-setup.mjs";
import { solutionPage } from "./fumen.mjs";
import { expandPattern, expandPatternCases, queuesForFinder } from "./pattern.mjs";
import { validateTargetLines } from "./pc-input.mjs";

export async function calculateCongruent({
  sourceFumen,
  pattern,
  clear = 4,
  blueGarbage = false,
  useHold = true,
  _keepVariants = false,
}) {
  validateTargetLines(clear);
  const pages = decoder.decode(sourceFumen);
  if (!pages.length) throw new Error("input Fumen has no pages");
  const finderPattern = queuesForFinder(pattern);
  const queues = expandPattern(finderPattern);
  const reachability = await batchReachability(clear, "tetrio");
  const out = [];
  for (const page of pages) {
    let { base, fill } = fieldMasks(page, clear);
    if (blueGarbage) {
      fill |= base;
      base = 0n;
    }
    const solutions = findCongruentSolutions({
      base,
      fill,
      queues,
      height: clear,
      reachability,
      useHold,
    });
    for (const solution of solutions) {
      if (_keepVariants) {
        out.push({ ...solution, base });
      } else {
        const { variants, ...publicSolution } = solution;
        out.push({ ...publicSolution, base });
      }
    }
  }
  if (!out.length) throw new Error("no congruent solutions");
  const fumen = encoder.encode(out.map((solution) => solutionPage(
    solution.base,
    solutionFromOps(solution.operations),
    solution.comment,
    clear,
  )));
  return {
    pathPattern: finderPattern,
    analysisPattern: pattern,
    solutions: out,
    count: out.length,
    fumen,
  };
}

export async function calculateCongruentCover({
  sourceFumen,
  pattern,
  clear = 4,
  mode = "normal",
  mirror = "no",
  blueGarbage = false,
  useHold = true,
}) {
  const congruent = await calculateCongruent({
    sourceFumen,
    pattern,
    clear,
    blueGarbage,
    useHold,
    _keepVariants: true,
  });
  const queues = expandPatternCases(congruent.pathPattern);
  const reachability = await batchReachability(clear, "jstris");
  const targets = congruent.solutions.map((solution) => ({
    base: solution.base,
    operations: solution.operations,
    orders: solution.orders,
    variants: solution.variants,
    comment: solution.comment,
    key: solution.key,
  }));
  const result = coverTargets({
    targets,
    queues,
    height: clear,
    reachability,
    useHold,
    mirror: boolMirror(mirror),
    mode,
  });
  const publicSolutions = congruent.solutions.map(({ variants, ...solution }) => solution);
  return {
    ...congruent,
    solutions: publicSolutions,
    mode: result.mode,
    mirror: boolMirror(mirror),
    covered: result.covered,
    total: result.total,
    failed: result.failed.length,
    failedQueues: result.failed,
    percent: result.total ? result.covered / result.total * 100 : 0,
    coverTargets: result.targets,
  };
}
