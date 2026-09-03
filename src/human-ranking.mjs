import { requirePositiveQuality } from "./quality-contract.mjs";

// Human-friendliness v1 is produced by the structural Rust enumerator:
// orderCount = number of distinct piece-type placement orders that actually
// reach this solution under the concrete queue + Hold rules.
//
// For matrix minimals the same geometry can have a different orderCount in
// different queue cases, so quality is indexed by (caseId, solutionKey).

export function comparePreferredSolutions(left, right) {
  const leftQuality = requirePositiveQuality(left?.orderCount, {
    key: left?.key ?? null,
    label: "playableOrderCount",
  });
  const rightQuality = requirePositiveQuality(right?.orderCount, {
    key: right?.key ?? null,
    label: "playableOrderCount",
  });
  const orderDifference = rightQuality - leftQuality;
  if (orderDifference !== 0) return orderDifference;
  const leftKey = left?.key ?? "";
  const rightKey = right?.key ?? "";
  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
}

export function preferredSolution(solutions) {
  let best = null;
  for (const solution of solutions) {
    if (best === null || comparePreferredSolutions(solution, best) < 0) best = solution;
  }
  return best;
}

export function recordOrderCount(index, caseId, solution) {
  const key = solution?.key;
  if (typeof key !== "string" || key.length === 0) {
    throw new Error(`playableOrderCount record is missing a solution key for ${String(caseId)}`);
  }
  const value = requirePositiveQuality(solution?.orderCount, {
    key,
    caseId,
    label: "playableOrderCount",
  });
  let byKey = index.get(caseId);
  if (!byKey) {
    byKey = new Map();
    index.set(caseId, byKey);
  }
  const previous = byKey.get(key);
  if (previous === undefined || value > previous) byKey.set(key, value);
}

export function makeOrderCountQuality(index) {
  let cachedCaseId;
  let cachedByKey;
  return (key, caseId) => {
    if (caseId !== cachedCaseId) {
      cachedCaseId = caseId;
      cachedByKey = index.get(caseId);
    }
    const value = cachedByKey?.get(key);
    if (value === undefined) {
      throw new Error(`missing playableOrderCount for covered edge ${String(caseId)} / ${String(key)}`);
    }
    return requirePositiveQuality(value, { key, caseId, label: "playableOrderCount" });
  };
}
