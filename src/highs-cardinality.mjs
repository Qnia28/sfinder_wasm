import { numericPrepared } from "./numeric-cover-data.mjs";
import Highs from "./vendor/highs.mjs";
import { minimumCover } from "./min-cover.mjs";
import { assertQualityProvider, requirePositiveQuality } from "./quality-contract.mjs";
import { retryableLoader } from "./promise-utils.mjs";
import { generateTripleCuts, appendCuts, relax } from "./min-cover-rounded-cuts.mjs";

export function normalizePrimaryProof(value = "standard") {
  if (value !== "standard" && value !== "rounded-cuts") {
    throw new Error(`invalid primaryProof: ${String(value)}`);
  }
  return value;
}

// Auto chooses only the *primary cardinality* backend.  Do not use the old
// legacy exact-search timings here: those mixed cardinality proof with exact
// secondary human-quality enumeration and badly misclassified matrices such as
// pcinfo-019.  The exact primary kernel is cheap enough to build first, removes
// duplicate/raw-size inflation, and exposes the structure that matters to the
// Rust cardinality-only search.
//
// The two guards are intentionally conservative and use primary-only data.
// Current full-matrix Rust cardinality-only measurements after kernelization:
//   pcinfo-019  10/8/20       ~8 ms
//   pcinfo-022  232/94/2428   ~44 ms
//   pcinfo-024  456/95/5028   ~38 ms
// BOX-derived sampled kernels such as 239/113/2435 and 712/141/7483 exceeded
// the Rust cardinality-only timeout and are routed to HiGHS. Secondary-quality
// timings are deliberately excluded from these guards.
const AUTO_PRIMARY_WIDE_MIN_CASES = 200;
const AUTO_PRIMARY_WIDE_MIN_SOLUTIONS = 112;
const AUTO_PRIMARY_WIDE_MIN_ENTRIES = 2200;
const AUTO_PRIMARY_LARGE_MIN_CASES = 650;
const AUTO_PRIMARY_LARGE_MIN_SOLUTIONS = 105;
const AUTO_PRIMARY_LARGE_MIN_ENTRIES = 6000;

async function bytesFor(url) {
  if (typeof process !== "undefined" && process.versions?.node) {
    const moduleName = "node:fs/promises";
    const { readFile } = await import(/* @vite-ignore */ moduleName);
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const loadHighs = retryableLoader(async () => {
  const wasmBinary = await bytesFor(new URL("../wasm/highs.wasm", import.meta.url));
  return Highs({ wasmBinary, print: () => {}, printErr: () => {} });
});

function variableLines(names, maxLength = 100) {
  const lines = [];
  let current = "";
  for (const name of names) {
    const next = current ? `${current} ${name}` : ` ${name}`;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = ` ${name}`;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

export function prepareCoverageMatrix(coverage, qualityFor = null) {
  assertQualityProvider(qualityFor);
  if (qualityFor !== null && numericPrepared(coverage)) return numericPrepared(coverage);
  const rawCases = [];
  const keySet = new Set();
  for (const [caseId, solutions] of coverage) {
    if (!solutions?.size) continue;
    const row = [...solutions];
    for (const key of row) keySet.add(key);
    rawCases.push({ caseId, row });
  }
  const keys = [...keySet].sort();
  const keyIndex = new Map(keys.map((key, index) => [key, index]));
  const cases = new Array(rawCases.length);
  const primaryCases = new Array(rawCases.length);
  let entryCount = 0;
  let maxQuality = 0;
  for (let caseIndex = 0; caseIndex < rawCases.length; caseIndex += 1) {
    const raw = rawCases[caseIndex];
    // `coverage` rows are Sets, so key IDs are already unique. Avoid rebuilding
    // every row through a Map + sort just to deduplicate it again.
    const entries = new Array(raw.row.length);
    const ids = new Array(raw.row.length);
    let position = 0;
    for (const key of raw.row) {
      const id = keyIndex.get(key);
      const quality = qualityFor === null
        ? 0
        : requirePositiveQuality(qualityFor(key, raw.caseId), { key, caseId: raw.caseId });
      ids[position] = id;
      entries[position] = [id, quality];
      position += 1;
      if (quality > maxQuality) maxQuality = quality;
    }
    entryCount += entries.length;
    cases[caseIndex] = entries;
    primaryCases[caseIndex] = ids;
  }
  return { keys, cases, primaryCases, entryCount, maxQuality };
}

export function primaryKernelStats(kernel) {
  return {
    cases: kernel?.cases?.length ?? 0,
    solutions: kernel?.solutionIds?.length ?? 0,
    entries: kernel?.entryCount ?? kernel?.cases?.reduce((sum, row) => sum + row.length, 0) ?? 0,
    forced: kernel?.forced?.length ?? 0,
  };
}

export function isHardPrimaryKernel(kernel) {
  const stats = primaryKernelStats(kernel);
  return (stats.cases >= AUTO_PRIMARY_WIDE_MIN_CASES
      && stats.solutions >= AUTO_PRIMARY_WIDE_MIN_SOLUTIONS
      && stats.entries >= AUTO_PRIMARY_WIDE_MIN_ENTRIES)
    || (stats.cases >= AUTO_PRIMARY_LARGE_MIN_CASES
      && stats.solutions >= AUTO_PRIMARY_LARGE_MIN_SOLUTIONS
      && stats.entries >= AUTO_PRIMARY_LARGE_MIN_ENTRIES);
}

// Kept as a compatibility/exported helper for callers that only have a raw
// prepared matrix. Production Auto always supplies the exact primary kernel.
export function isHardMinimumCover(prepared) {
  return isHardPrimaryKernel(kernelizeCardinality(prepared.primaryCases ?? prepared.cases.map((row) => row.map(([id]) => id)), prepared.keys.length));
}

export function buildCardinalityLp(rawCases, solutionCount) {
  const names = Array.from({ length: solutionCount }, (_, i) => `x${i}`);
  const parts = ["Minimize", ` obj: ${names.join(" + ")}`, "Subject To"];
  for (let ci = 0; ci < rawCases.length; ci += 1) {
    const ids = rawCases[ci];
    if (!ids.length) throw new Error(`uncoverable case ${ci}`);
    parts.push(` c${ci}: ${ids.map((id) => `x${id}`).join(" + ")} >= 1`);
  }
  parts.push("Binary", variableLines(names), "End", "");
  return parts.join("\n");
}

export async function solveCardinality(rawCases, solutionCount, options = {}) {
  const { primaryProof = "standard", ...solverOptions } = options;
  normalizePrimaryProof(primaryProof);
  if (rawCases.length === 0) return { count: 0, selected: [], result: null };
  const highs = await loadHighs();
  let lp = buildCardinalityLp(rawCases, solutionCount);
  // Explicit opt-in: added cuts preserve exact K but may change the incumbent
  // used by bounded Fast quality. Some medium inputs are slower with cuts.
  if (primaryProof === "rounded-cuts" && rawCases.length >= 3) {
    const root = highs.solve(relax(lp, solutionCount), {
      output_flag: false, random_seed: 0,
      ...(solverOptions.time_limit === undefined ? {} : { time_limit: solverOptions.time_limit }),
    });
    const x = Array.from({ length: solutionCount }, (_, j) => Number(root.Columns?.[`x${j}`]?.Primal));
    if (root.Status === "Optimal" && x.every(Number.isFinite)) {
      const generated = generateTripleCuts(rawCases, solutionCount, x);
      lp = appendCuts(lp, generated.cuts);
    }
  }
  const result = highs.solve(lp, {
    output_flag: false,
    random_seed: 0,
    mip_rel_gap: 0,
    ...solverOptions,
  });
  if (result.Status !== "Optimal") throw new Error(`HiGHS cardinality status: ${result.Status}`);
  const selected = [];
  for (let i = 0; i < solutionCount; i += 1) {
    if (Number(result.Columns[`x${i}`]?.Primal ?? 0) > 0.5) selected.push(i);
  }
  const chosen = new Set(selected);
  if (selected.length !== Math.round(result.ObjectiveValue)
      || !rawCases.every((row) => row.some((id) => chosen.has(id)))) {
    throw new Error("HiGHS cardinality witness does not cover the original matrix");
  }
  return { count: Math.round(result.ObjectiveValue), selected, result };
}

function subsetMask(a, b) {
  return (a & ~b) === 0n;
}

// Exact primary-objective reductions. Quality is intentionally ignored here;
// all original candidates are restored for the post-MIP human-quality pass.
export function kernelizeCardinality(rawCases, solutionCount) {
  let activeCases = rawCases.map((row, original) => ({
    original,
    ids: [...new Set(row)].sort((a, b) => a - b),
  }));
  let activeSolutions = new Set(Array.from({ length: solutionCount }, (_, i) => i));
  const forced = [];
  let changed = true;

  while (changed) {
    changed = false;
    const forcedSet = new Set(forced);
    const nextCases = [];
    for (const entry of activeCases) {
      if (entry.ids.some((id) => forcedSet.has(id))) {
        changed = true;
        continue;
      }
      const ids = entry.ids.filter((id) => activeSolutions.has(id));
      if (!ids.length) throw new Error(`cardinality kernel made case ${entry.original} uncoverable`);
      if (ids.length !== entry.ids.length) changed = true;
      nextCases.push({ original: entry.original, ids });
    }
    activeCases = nextCases;
    if (!activeCases.length) break;

    // Every singleton is mandatory. Force all currently visible singleton
    // candidates in one round instead of rescanning thousands of cases once per
    // forced solution.
    const singletonIds = new Set();
    for (const entry of activeCases) {
      if (entry.ids.length === 1) singletonIds.add(entry.ids[0]);
    }
    if (singletonIds.size) {
      for (const id of singletonIds) {
        if (activeSolutions.delete(id)) {
          forced.push(id);
          changed = true;
        }
      }
      continue;
    }

    const caseMasks = activeCases.map((entry) => {
      let mask = 0n;
      for (const id of entry.ids) mask |= 1n << BigInt(id);
      return mask;
    });
    const order = activeCases.map((_, i) => i).sort((a, b) =>
      activeCases[a].ids.length - activeCases[b].ids.length
      || activeCases[a].original - activeCases[b].original);
    const keep = new Uint8Array(activeCases.length);
    const kept = [];
    const exactMasks = new Set();
    let removedCase = false;
    // Rows are visited from smallest candidate set to largest. A row can be
    // discarded as soon as one already-kept row is a subset; there is no need
    // to compare every kept row against every later row.
    for (const index of order) {
      const mask = caseMasks[index];
      if (exactMasks.has(mask)) {
        removedCase = true;
        continue;
      }
      let dominated = false;
      for (const prior of kept) {
        if (activeCases[prior].ids.length > activeCases[index].ids.length) break;
        if (subsetMask(caseMasks[prior], mask)) {
          dominated = true;
          break;
        }
      }
      if (dominated) {
        removedCase = true;
        continue;
      }
      keep[index] = 1;
      kept.push(index);
      exactMasks.add(mask);
    }
    if (removedCase) {
      activeCases = activeCases.filter((_, i) => keep[i]);
      changed = true;
    }

    const coverage = new Map();
    for (const id of activeSolutions) coverage.set(id, 0n);
    for (let ci = 0; ci < activeCases.length; ci += 1) {
      const bit = 1n << BigInt(ci);
      for (const id of activeCases[ci].ids) {
        if (activeSolutions.has(id)) coverage.set(id, (coverage.get(id) ?? 0n) | bit);
      }
    }
    const ids = [...activeSolutions].filter((id) => coverage.get(id));
    const remove = new Set();
    for (let i = 0; i < ids.length; i += 1) {
      const a = ids[i];
      if (remove.has(a)) continue;
      const ca = coverage.get(a);
      for (let j = 0; j < ids.length; j += 1) {
        if (i === j) continue;
        const b = ids[j];
        if (remove.has(b)) continue;
        const cb = coverage.get(b);
        if (subsetMask(ca, cb) && (ca !== cb || a > b)) {
          remove.add(a);
          break;
        }
      }
    }
    for (const id of activeSolutions) if (!coverage.get(id)) remove.add(id);
    if (remove.size) {
      for (const id of remove) activeSolutions.delete(id);
      changed = true;
    }
  }

  const solutionIds = [...activeSolutions].sort((a, b) => a - b);
  const remap = new Map(solutionIds.map((id, i) => [id, i]));
  const cases = activeCases.map((entry) => entry.ids
    .filter((id) => activeSolutions.has(id))
    .map((id) => remap.get(id)));
  return {
    cases,
    solutionIds,
    forced: [...new Set(forced)].sort((a, b) => a - b),
  };
}

export async function solvePreparedCardinalityKernel(kernel, options = {}) {
  if (!kernel.cases.length) {
    return { count: kernel.forced.length, selected: kernel.forced, kernel, result: null, backend: "kernel" };
  }
  const solved = await solveCardinality(kernel.cases, kernel.solutionIds.length, options);
  const selected = [...kernel.forced, ...solved.selected.map((id) => kernel.solutionIds[id])]
    .sort((a, b) => a - b);
  return { count: selected.length, selected, kernel, result: solved.result, backend: "highs" };
}

export function solvePreparedRustCardinalityKernel(prepared, kernel, solver = null) {
  if (!kernel.cases.length) {
    return { count: kernel.forced.length, selected: kernel.forced, kernel, searchedStates: 0, backend: "kernel" };
  }

  // The primary kernel is already a compact numeric-ID matrix. Pass it directly
  // to WASM instead of rebuilding string-key Maps/Sets and then converting them
  // back to numeric CSR in the backend.
  const numeric = solver?.minimumCoverCardinalityIds?.(kernel.cases, kernel.solutionIds.length);
  if (numeric) {
    if (!Number.isFinite(numeric.count)) throw new Error("Rust cardinality-only kernel solve failed");
    const selected = [...kernel.forced];
    for (const localId of numeric.selectedIds) {
      const originalId = kernel.solutionIds[localId];
      if (originalId === undefined) throw new Error(`Rust kernel result contains an unknown candidate ID: ${localId}`);
      selected.push(originalId);
    }
    selected.sort((a, b) => a - b);
    return {
      count: selected.length,
      selected,
      kernel,
      searchedStates: numeric.searchedStates ?? 0,
      backend: "rust",
    };
  }

  // Compatibility fallback for non-WASM/custom solvers.
  const kernelKeys = kernel.solutionIds.map((id) => prepared.keys[id]);
  const coverage = new Map();
  for (let ci = 0; ci < kernel.cases.length; ci += 1) {
    coverage.set(ci, new Set(kernel.cases[ci].map((id) => kernelKeys[id])));
  }
  const solved = solver?.minimumCoverCardinality?.(coverage)
    ?? minimumCover(coverage, { qualityFor: null, solver });
  if (!Number.isFinite(solved.count)) throw new Error("Rust cardinality-only kernel solve failed");
  const remap = new Map(kernelKeys.map((key, id) => [key, kernel.solutionIds[id]]));
  const selected = [...kernel.forced];
  for (const key of solved.keys) {
    const id = remap.get(key);
    if (id === undefined) throw new Error(`Rust kernel result contains an unknown candidate: ${key}`);
    selected.push(id);
  }
  selected.sort((a, b) => a - b);
  return {
    count: selected.length,
    selected,
    kernel,
    searchedStates: solved.searchedStates ?? 0,
    backend: "rust",
  };
}

export async function solveCardinalityKernel(rawCases, solutionCount, options = {}) {
  return solvePreparedCardinalityKernel(kernelizeCardinality(rawCases, solutionCount), options);
}
