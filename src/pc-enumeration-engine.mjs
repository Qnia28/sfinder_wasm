import { PC_ROUTING_PROFILES, shouldUsePatternBackend, EXISTENCE_PROBE, chooseExistenceBackend } from "./pc-routing-policy.mjs";
import { dedupeQueues, mapQueuesCached, remapQueueResults } from "./pc-queue-utils.mjs";

export const PATTERN_BATCH_MIN_CASES = PC_ROUTING_PROFILES.full.tallPatternMinCases;
export const FOUR_LINE_PATTERN_BATCH_MIN_CASES = PC_ROUTING_PROFILES.full.fourLinePatternMinCases;

export function solveQueuesExistence({ board, queues, solver, useHold = true }) {
  const { uniqueQueues, remap, hasDuplicates } = dedupeQueues(queues);
  const patternAvailable = typeof solver.canPcPatternMany === "function";
  let usePattern = shouldUsePatternBackend({
    profile: "existence",
    height: solver.height,
    caseCount: uniqueQueues.length,
    available: patternAvailable,
  });
  const scalarMany = typeof solver.canPcManyScalar === "function"
    ? solver.canPcManyScalar.bind(solver)
    : typeof solver._canPcManyScalar === "function"
      ? solver._canPcManyScalar.bind(solver)
      : null;
  const known = new Map();
  const probeEligible = patternAvailable && scalarMany && typeof solver.probeCanPc === "function"
    && solver.height > 4 && uniqueQueues.length >= 64 && !usePattern;
  if (probeEligible) {
    const multisetCount = new Set(uniqueQueues.map((queue) => [...queue].sort().join(''))).size;
    const probes = [];
    let seed = 41357;
    // Sample across the entire input, including distinct prefixes in sorted
    // bag permutations. Successful/failed completed probes are reused below.
    for (let i = 0; i < EXISTENCE_PROBE.samples; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const index = Math.floor((i + seed / 0x100000000) * uniqueQueues.length / EXISTENCE_PROBE.samples);
      const probe = solver.probeCanPc(board, uniqueQueues[index], useHold, EXISTENCE_PROBE.nodesPerQueue);
      probes.push(probe);
      if (probe.completed) known.set(index, probe.value);
      if (!probe.completed) break;
    }
    usePattern = chooseExistenceBackend({ height: solver.height, caseCount: uniqueQueues.length,
      multisetCount, probes, fallback: usePattern });
  }
  const pending = [], indices = [];
  const results = new Array(uniqueQueues.length);
  for (let i = 0; i < uniqueQueues.length; i += 1) {
    if (known.has(i)) results[i] = known.get(i);
    else { pending.push(uniqueQueues[i]); indices.push(i); }
  }
  const remaining = !pending.length ? [] : usePattern
    ? solver.canPcPatternMany(board, pending, useHold)
    : scalarMany ? scalarMany(board, pending, useHold)
      : pending.map((queue) => solver.canPc(board, queue, useHold));
  for (let i = 0; i < indices.length; i += 1) results[indices[i]] = remaining[i];
  return hasDuplicates ? remapQueueResults(remap, results) : results;
}

export function enumerateQueuesCached({ board, queues, solver, useHold = true }) {
  return mapQueuesCached(queues, (queue) => solver.enumeratePc(board, queue, useHold));
}

export function enumerateQueues({ board, queues, solver, useHold = true }) {
  if (shouldUsePatternBackend({
    profile: "full",
    height: solver.height,
    caseCount: queues.length,
    available: typeof solver.enumeratePcPattern === "function",
  })) {
    const rows = solver.enumeratePcPattern(board, queues, useHold);
    if (Array.isArray(rows)) {
      const output = Array.from({ length: queues.length }, () => []);
      for (const solution of rows) {
        for (const hit of solution.coverage) {
          if (hit.caseIndex >= output.length) continue;
          output[hit.caseIndex].push({
            masks: solution.masks,
            key: solution.key,
            orderCount: hit.orderCount,
            saved: solution.saved,
          });
        }
      }
      for (const row of output) row.sort((left, right) => left.key.localeCompare(right.key));
      return output;
    }
  }
  return enumerateQueuesCached({ board, queues, solver, useHold });
}

export function canUsePatternEnumeration({
  cases,
  solver,
  fourLineMinCases = FOUR_LINE_PATTERN_BATCH_MIN_CASES,
  tallMinCases = PATTERN_BATCH_MIN_CASES,
}) {
  return shouldUsePatternBackend({
    profile: "full",
    height: solver.height,
    caseCount: cases.length,
    available: typeof solver.enumeratePcPattern === "function",
    fourLinePatternMinCases: fourLineMinCases,
    tallPatternMinCases: tallMinCases,
  });
}

// Shared solver dispatch only. Feature-specific interpretation stays outside
// this layer so hot pattern loops do not pay a callback/object allocation per
// coverage hit.
export function enumerateCases({
  board, cases, solver, useHold = true,
  fourLinePatternMinCases = FOUR_LINE_PATTERN_BATCH_MIN_CASES,
  tallPatternMinCases = PATTERN_BATCH_MIN_CASES,
}) {
  if (canUsePatternEnumeration({
    cases,
    solver,
    fourLineMinCases: fourLinePatternMinCases,
    tallMinCases: tallPatternMinCases,
  })) {
    const rows = solver.enumeratePcPattern(board, cases.map((entry) => entry.queue), useHold);
    if (Array.isArray(rows)) return { mode: "pattern", rows };
  }

  return {
    mode: "scalar",
    rows: enumerateQueuesCached({
      board,
      queues: cases.map((entry) => entry.queue),
      solver,
      useHold,
    }),
  };
}

// Convenience adapter for features where callback overhead is insignificant.
// Minimals and other broad-pattern hot paths may consume enumerateCases()
// directly instead.
export function visitCaseSolutions({
  board,
  cases,
  solver,
  useHold = true,
  visit = null,
  collectByKey = true,
  trackCaseSolutions = true,
  fourLinePatternMinCases = FOUR_LINE_PATTERN_BATCH_MIN_CASES,
  tallPatternMinCases = PATTERN_BATCH_MIN_CASES,
}) {
  const caseHasSolution = trackCaseSolutions ? new Uint8Array(cases.length) : null;
  const byKey = collectByKey ? new Map() : null;
  const path = enumerateCases({
    board,
    cases,
    solver,
    useHold,
    fourLinePatternMinCases,
    tallPatternMinCases,
  });

  if (path.mode === "pattern") {
    for (const solution of path.rows) {
      if (byKey) byKey.set(solution.key, solution);
      for (const hit of solution.coverage) {
        const caseIndex = hit.caseIndex;
        const entry = cases[caseIndex];
        if (!entry) throw new Error(`invalid pattern coverage case ${caseIndex}`);
        if (caseHasSolution) caseHasSolution[caseIndex] = 1;
        if (visit) visit(entry, caseIndex, solution, hit.orderCount);
      }
    }
  } else {
    for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
      const entry = cases[caseIndex];
      const solutions = path.rows[caseIndex];
      if (caseHasSolution && solutions.length > 0) caseHasSolution[caseIndex] = 1;
      for (const solution of solutions) {
        if (byKey) byKey.set(solution.key, solution);
        if (visit) visit(entry, caseIndex, solution, solution.orderCount);
      }
    }
  }
  return { mode: path.mode, caseHasSolution, byKey };
}

// Historical names retained only for compatibility with external/internal
// consumers that have not yet moved to the neutral enumeration terminology.
export const canUsePatternPath = canUsePatternEnumeration;
export const enumerateCasePath = enumerateCases;
