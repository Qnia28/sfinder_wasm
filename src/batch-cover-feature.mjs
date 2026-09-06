import { coverTargets } from "./batch-cover.mjs";
import { batchReachability, boolMirror, decodedTargets } from "./batch-feature-common.mjs";
import { expandPatternCases, queuesForFinder } from "./pattern.mjs";
import { validateTargetLines } from "./pc-input.mjs";

export async function calculateCover({
  sourceFumen,
  pattern,
  clear = 4,
  mode = "normal",
  mirror = "no",
  useHold = true,
  outputMode = "variants",
}) {
  validateTargetLines(clear);
  if (!['variants', 'coverage'].includes(outputMode)) throw new RangeError(`unsupported cover outputMode '${outputMode}'`);
  const finderPattern = queuesForFinder(pattern);
  const queues = expandPatternCases(finderPattern);
  const targets = decodedTargets(sourceFumen, clear);
  const heights = [...new Set(targets.map((target) => target._batchHeight ?? clear))];
  const reachabilityByHeight = new Map();
  for (const height of heights) {
    reachabilityByHeight.set(height, await batchReachability(height, "jstris"));
  }
  const reachability = reachabilityByHeight.get(clear) ?? reachabilityByHeight.values().next().value;
  const result = coverTargets({
    targets,
    queues,
    height: clear,
    reachability,
    reachabilityForHeight: (height) => reachabilityByHeight.get(height),
    useHold,
    mirror: boolMirror(mirror),
    mode,
    coverageOnly: outputMode === "coverage",
  });
  return {
    pathPattern: finderPattern,
    analysisPattern: pattern,
    mode: result.mode,
    mirror: boolMirror(mirror),
    covered: result.covered,
    total: result.total,
    failed: result.failed.length,
    failedQueues: result.failed,
    percent: result.total ? result.covered / result.total * 100 : 0,
    targets: result.targets,
  };
}
