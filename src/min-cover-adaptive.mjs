import {primaryRequest, selectPrimaryBackend} from "./primary-backend.mjs";
import {isORToolsSupported, solveORToolsCardinalityKernel} from "./ortools-min-cover.mjs";
import { minimumCover } from "./min-cover.mjs";
import { assertQualityProvider } from "./quality-contract.mjs";
import {
  isHardPrimaryKernel, kernelizeCardinality, prepareCoverageMatrix, primaryKernelStats,
  solvePreparedCardinalityKernel, solvePreparedRustCardinalityKernel,
  normalizePrimaryProof,
} from "./highs-cardinality.mjs";
import { refineMinimumCoverQuality } from "./min-cover-quality-refine.mjs";

// Release 2.1: ordinary fixed-K quality uses canonical-style integrated
// BestSetSearch with a deterministic state budget. Fast falls back to 2x2 on
// budget exhaustion; True falls back to the sequential-threshold exact prover.
export const FAST_EXACT_STATE_BUDGET = 100000;
// Fast-only grace budget for the sequential-threshold exact prover after the
// integrated fixed-K probe exhausts its budget. Keep this separate from the
// exact=True integrated probe budget so improving Fast does not slow exact mode.
export const FAST_THRESHOLD_GRACE_STATE_BUDGET = 5000;
// Speculative candidate-dominance preview. A timeout is never used as an
// incumbent because dominance changes the bounded DFS traversal; only a fully
// proven Exact result can replace the historical Fast path.
export const FAST_DOMINANCE_PREVIEW_STATE_BUDGET = 2500;
// Dominance preprocessing is quadratic in the raw candidate set. Restrict the
// speculative preview to already-compact primary kernels; larger non-hard
// kernels keep the historical Fast path with zero preview overhead.
export const FAST_DOMINANCE_PREVIEW_MAX_KERNEL_ENTRIES = 512;
// Dominance compares candidate pairs, so raw candidate count matters even when
// cardinality kernelization collapses the primary model aggressively. Keep the
// speculative preview out of large-S matrices where O(S^2 * N) preprocessing
// could cost more than the historical Fast search it is meant to accelerate.
export const FAST_DOMINANCE_PREVIEW_MAX_CANDIDATES = 256;
// Bound the temporary Rust quality matrix used by dominance (u32 per cell).
// This keeps speculative memory/preprocessing cost predictable even when an
// aggressively reduced primary kernel came from a very large raw matrix.
export const FAST_DOMINANCE_PREVIEW_MAX_MATRIX_CELLS = 1500000;

export function normalizeUseHiGHS(value = "auto") {
  if (value === true || value === false || value === "auto") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "auto") return "auto";
  }
  throw new Error(`invalid UseHiGHS value: ${String(value)}`);
}

export function normalizeExactHumanQuality(value = "fast") {
  if (value === true) return "true";
  if (value === false || value == null) return "fast";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "exact") return "true";
    if (normalized === "fast" || normalized === "false" || normalized === "auto") return "fast";
  }
  throw new Error(`invalid exactHumanQuality value: ${String(value)}`);
}

export function resolveUseHiGHS(prepared, requested = "auto", primaryKernel = null) {
  const normalized = normalizeUseHiGHS(requested);
  if (normalized !== "auto") return normalized;
  const kernel = primaryKernel ?? kernelizeCardinality(
    prepared.primaryCases ?? prepared.cases.map((row) => row.map(([id]) => id)),
    prepared.keys.length,
  );
  // A fully solved kernel needs neither Rust search nor HiGHS MIP.
  if (!kernel.cases.length) return false;
  return selectPrimaryBackend(kernel, "auto", {ortoolsAvailable: isORToolsSupported()}) === "highs";
}


function candidateCountUpTo(coverage, limit) {
  const keys = new Set();
  for (const solutions of coverage.values()) {
    for (const key of solutions ?? []) {
      keys.add(key);
      if (keys.size > limit) return keys.size;
    }
  }
  return keys.size;
}

export async function minimumCoverAdaptiveAsync(coverage, {
  qualityFor = null,
  solver = null,
  exactQuality = "true",
  primary: primaryOption = undefined, Primary = undefined,
  useHiGHS = "auto",
  fastStateBudget = FAST_EXACT_STATE_BUDGET,
  tinyExactMaxCandidates = 48,
  primaryProof = "standard",
} = {}) {
  normalizePrimaryProof(primaryProof);
  assertQualityProvider(qualityFor);
  const qualityMode = normalizeExactHumanQuality(exactQuality);
  const requestedPrimary = primaryRequest({primary: primaryOption, Primary, useHiGHS});
  const requested = requestedPrimary === "highs" ? true : requestedPrimary === "rust" ? false : "auto";
  const tinyLimit = Math.max(0, Math.floor(Number(tinyExactMaxCandidates) || 0));
  if (requestedPrimary === "auto" && tinyLimit > 0 && candidateCountUpTo(coverage, tinyLimit) <= tinyLimit) {
    const legacy = minimumCover(coverage, { qualityFor, solver });
    const hasQuality = qualityFor !== null;
    return {
      ...legacy,
      backend: "rust-legacy",
      cardinalityBackend: hasQuality ? "rust-legacy-integrated" : "rust-legacy-cardinality",
      qualityBackend: hasQuality ? "rust-legacy-exact" : "none",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: "rust", useHiGHSRequested: requested,
      useHiGHSResolved: false,
      minimumCoverKernelCases: null,
      minimumCoverKernelSolutions: null,
      minimumCoverKernelEntries: null,
      primarySearchedStates: legacy.searchedStates ?? 0,
      qualitySearchedStates: hasQuality ? legacy.searchedStates ?? 0 : 0,
      fastProbeBudget: hasQuality && qualityMode === "fast" ? fastStateBudget : null,
      fastProbeStates: 0,
      fastFallback: false,
      fastDecision: hasQuality ? "tiny-legacy-exact" : "cardinality-only",
      qualityDecision: hasQuality ? "tiny-legacy-exact" : "cardinality-only",
    };
  }
  return minimumCoverAsync(coverage, {
    qualityFor,
    solver,
    exactQuality: qualityMode,
    primary: requestedPrimary,
    useHiGHS: requested,
    fastStateBudget,
    primaryProof,
  });
}

export async function minimumCoverAsync(coverage, {
  qualityFor = null,
  solver = null,
  exactQuality = "fast",
  primary: primaryOption = undefined, Primary = undefined,
  useHiGHS = "auto",
  fastStateBudget = FAST_EXACT_STATE_BUDGET,
  primaryProof = "standard",
} = {}) {
  normalizePrimaryProof(primaryProof);
  assertQualityProvider(qualityFor);
  const qualityMode = normalizeExactHumanQuality(exactQuality);
  const prepared = prepareCoverageMatrix(coverage, qualityFor);
  const requestedPrimary = primaryRequest({primary: primaryOption, Primary, useHiGHS});
  const requested = requestedPrimary === "highs" ? true : requestedPrimary === "rust" ? false : "auto";
  if (!prepared.cases.length) {
    return {
      count: 0, keys: [], qualityVector: [], searchedStates: 0,
      backend: "kernel", cardinalityBackend: "kernel",
      qualityBackend: qualityFor === null ? "none" : qualityMode === "true" ? "rust-quality-bnb" : "fast-exact-probe",
      qualityExact: true, primaryRequested: requestedPrimary, primaryResolved: "kernel", useHiGHSRequested: requested, useHiGHSResolved: false,
      fastProbeBudget: qualityFor !== null && qualityMode === "fast" ? fastStateBudget : null,
      fastProbeStates: 0, fastFallback: false,
    };
  }

  const primaryCases = prepared.primaryCases ?? prepared.cases.map((row) => row.map(([id]) => id));
  const primaryKernel = solver?.primaryKernelize?.(primaryCases, prepared.keys.length)
    ?? kernelizeCardinality(primaryCases, prepared.keys.length);
  const primaryHard = isHardPrimaryKernel(primaryKernel);
  const resolved = selectPrimaryBackend(primaryKernel, requestedPrimary, {
    ortoolsAvailable: isORToolsSupported(),
  });
  const kernelStats = primaryKernelStats(primaryKernel);
  const primary = resolved === "ortools"
    ? await solveORToolsCardinalityKernel(primaryKernel)
    : resolved === "highs"
      ? await solvePreparedCardinalityKernel(primaryKernel, { primaryProof })
      : solvePreparedRustCardinalityKernel(prepared, primaryKernel, solver);
  const primaryKeys = primary.selected.map((id) => prepared.keys[id]);

  if (qualityFor === null) {
    return {
      count: primary.count,
      keys: primaryKeys,
      qualityVector: [],
      searchedStates: primary.searchedStates ?? 0,
      backend: primary.backend,
      cardinalityBackend: primary.backend,
      qualityBackend: "none",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: 0,
      fastProbeBudget: null,
      fastProbeStates: 0,
      fastFallback: false,
      fastDecision: "cardinality-only",
      qualityDecision: "cardinality-only",
    };
  }

  if (qualityMode === "true") {
    // Ordinary fixed-K quality problems are much faster with the canonical
    // integrated BestSetSearch once K is already known. Bound that first
    // attempt so pathological quality structures can fall back to the
    // sequential-threshold exact prover without sacrificing exactness.
    if (!primaryHard) {
      const integrated = solver?.minimumCoverAtCount?.(coverage, primary.count, {
        qualityFor, seedKeys: primaryKeys, stateBudget: FAST_EXACT_STATE_BUDGET, integrated: true,
      });
      if (integrated?.completed && Number.isFinite(integrated.count) && integrated.count === primary.count) {
        return {
          ...integrated,
          backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
          cardinalityBackend: primary.backend,
          qualityBackend: "rust-quality-integrated",
          qualityExact: true,
          primaryRequested: requestedPrimary, primaryResolved: primary.backend,
          useHiGHSRequested: requested,
          useHiGHSResolved: primary.backend === "highs",
          minimumCoverKernelCases: kernelStats.cases,
          minimumCoverKernelSolutions: kernelStats.solutions,
          minimumCoverKernelEntries: kernelStats.entries,
          primarySearchedStates: primary.searchedStates ?? 0,
          qualitySearchedStates: integrated.searchedStates ?? 0,
          fastProbeBudget: null,
          fastProbeStates: null,
          fastFallback: false,
          qualityDecision: "integrated-exact",
        };
      }
      const sequentialSeed = integrated?.keys?.length === primary.count ? integrated.keys : primaryKeys;
      const exact = solver?.minimumCoverAtCount?.(coverage, primary.count, {
        qualityFor, seedKeys: sequentialSeed, lockedPrefix: [],
      }) ?? minimumCover(coverage, { qualityFor, solver });
      if (!Number.isFinite(exact?.count) || exact.count !== primary.count) {
        throw new Error(`fixed-count exact quality search failed for K=${primary.count}`);
      }
      return {
        ...exact,
        backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
        cardinalityBackend: primary.backend,
        qualityBackend: "rust-quality-threshold-fallback",
        qualityExact: true,
        primaryRequested: requestedPrimary, primaryResolved: primary.backend,
        useHiGHSRequested: requested,
        useHiGHSResolved: primary.backend === "highs",
        minimumCoverKernelCases: kernelStats.cases,
        minimumCoverKernelSolutions: kernelStats.solutions,
        minimumCoverKernelEntries: kernelStats.entries,
        primarySearchedStates: primary.searchedStates ?? 0,
        qualitySearchedStates: (integrated?.searchedStates ?? 0) + (exact.searchedStates ?? 0),
        fastProbeBudget: null,
        fastProbeStates: null,
        fastFallback: false,
        qualityDecision: "integrated-budget-to-threshold",
        integratedProbeStates: integrated?.searchedStates ?? 0,
      };
    }

    const exact = solver?.minimumCoverAtCount?.(coverage, primary.count, {
      qualityFor, seedKeys: primaryKeys, lockedPrefix: [],
    }) ?? minimumCover(coverage, { qualityFor, solver });
    if (!Number.isFinite(exact?.count) || exact.count !== primary.count) {
      throw new Error(`fixed-count exact quality search failed for K=${primary.count}`);
    }
    return {
      ...exact,
      backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
      cardinalityBackend: primary.backend,
      qualityBackend: "rust-quality-bnb",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: exact.searchedStates ?? 0,
      fastProbeBudget: null,
      fastProbeStates: null,
      fastFallback: false,
      qualityDecision: "primary-hard-threshold-exact",
    };
  }

  if (primaryHard) {
    const refined = refineMinimumCoverQuality(prepared, primary.selected);
    return {
      count: primary.count,
      keys: refined.selected.map((id) => prepared.keys[id]),
      qualityVector: refined.qualityVector,
      searchedStates: primary.searchedStates ?? 0,
      backend: primary.backend,
      cardinalityBackend: primary.backend,
      qualityBackend: "fast-2x2",
      qualityExact: false,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: 0,
      fastProbeBudget: FAST_EXACT_STATE_BUDGET,
      fastProbeStates: 0,
      fastFallback: true,
      fastDecision: "primary-hard",
      qualityRefinementPasses: refined.passes,
    };
  }

  const budget = Math.max(1, Math.floor(Number(fastStateBudget) || FAST_EXACT_STATE_BUDGET));

  // Exact-only speculative preview. Candidate dominance is sound for the final
  // fixed-K objective, but it changes bounded DFS traversal. Therefore only a
  // completed proof is accepted; a timeout is discarded before restarting the
  // historical integrated search from the original primary seed.
  const dominancePreviewEligible = kernelStats.entries <= FAST_DOMINANCE_PREVIEW_MAX_KERNEL_ENTRIES
    && prepared.keys.length <= FAST_DOMINANCE_PREVIEW_MAX_CANDIDATES
    && prepared.keys.length * prepared.cases.length <= FAST_DOMINANCE_PREVIEW_MAX_MATRIX_CELLS;
  const dominancePreviewBudget = dominancePreviewEligible
    ? Math.max(1, Math.min(
      FAST_DOMINANCE_PREVIEW_STATE_BUDGET,
      Math.floor(budget / 20),
    ))
    : null;
  const dominancePreview = dominancePreviewEligible
    ? solver?.minimumCoverAtCount?.(coverage, primary.count, {
      qualityFor,
      seedKeys: primaryKeys,
      stateBudget: dominancePreviewBudget,
      integrated: true,
      dominance: true,
    })
    : null;
  if (dominancePreview?.completed
      && Number.isFinite(dominancePreview.count)
      && dominancePreview.count === primary.count) {
    return {
      ...dominancePreview,
      searchedStates: (primary.searchedStates ?? 0) + (dominancePreview.searchedStates ?? 0),
      backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
      cardinalityBackend: primary.backend,
      qualityBackend: "fast-dominance-exact",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: dominancePreview.searchedStates ?? 0,
      fastDominancePreviewBudget: dominancePreviewBudget,
      fastDominancePreviewStates: dominancePreview.searchedStates ?? 0,
      fastProbeBudget: budget,
      fastProbeStates: 0,
      fastFallback: false,
      fastDecision: "dominance-preview-exact",
    };
  }

  const probe = solver?.minimumCoverAtCount?.(coverage, primary.count, {
    qualityFor, seedKeys: primaryKeys, stateBudget: budget, integrated: true,
  });
  if (probe?.completed && Number.isFinite(probe.count) && probe.count === primary.count) {
    return {
      ...probe,
      searchedStates: (primary.searchedStates ?? 0) + (dominancePreview?.searchedStates ?? 0) + (probe.searchedStates ?? 0),
      backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
      cardinalityBackend: primary.backend,
      qualityBackend: "fast-integrated-exact",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: (dominancePreview?.searchedStates ?? 0) + (probe.searchedStates ?? 0),
      fastDominancePreviewBudget: dominancePreviewBudget,
      fastDominancePreviewStates: dominancePreview?.searchedStates ?? 0,
      fastProbeBudget: budget,
      fastProbeStates: probe.searchedStates ?? 0,
      fastFallback: false,
      fastDecision: "integrated-exact",
    };
  }

  // The integrated search and the sequential-threshold prover have very
  // different hard cases. A small bounded threshold pass can often finish
  // exactly after the integrated probe times out, and is cheaper than spending
  // the same extra states on the integrated tree. Scale the grace down when a
  // caller deliberately requests a tiny Fast budget (tests/custom callers).
  const thresholdGraceBudget = Math.max(1, Math.min(
    FAST_THRESHOLD_GRACE_STATE_BUDGET,
    Math.floor(budget / 10),
  ));
  const thresholdSeedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;
  const thresholdProbe = solver?.minimumCoverAtCount?.(coverage, primary.count, {
    qualityFor,
    seedKeys: thresholdSeedKeys,
    stateBudget: thresholdGraceBudget,
    integrated: false,
  });
  if (thresholdProbe?.completed
      && Number.isFinite(thresholdProbe.count)
      && thresholdProbe.count === primary.count) {
    return {
      ...thresholdProbe,
      searchedStates: (primary.searchedStates ?? 0) + (dominancePreview?.searchedStates ?? 0) + (probe?.searchedStates ?? 0) + (thresholdProbe.searchedStates ?? 0),
      backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
      cardinalityBackend: primary.backend,
      qualityBackend: "fast-threshold-exact",
      qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested,
      useHiGHSResolved: primary.backend === "highs",
      minimumCoverKernelCases: kernelStats.cases,
      minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries,
      primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: (dominancePreview?.searchedStates ?? 0) + (probe?.searchedStates ?? 0) + (thresholdProbe.searchedStates ?? 0),
      fastDominancePreviewBudget: dominancePreviewBudget,
      fastDominancePreviewStates: dominancePreview?.searchedStates ?? 0,
      fastProbeBudget: budget,
      fastProbeStates: probe?.searchedStates ?? 0,
      fastThresholdBudget: thresholdGraceBudget,
      fastThresholdStates: thresholdProbe.searchedStates ?? 0,
      fastFallback: false,
      fastDecision: "threshold-exact-after-integrated-budget",
    };
  }

  const fallbackKeys = thresholdProbe?.keys?.length === primary.count
    ? thresholdProbe.keys
    : thresholdSeedKeys;
  const idByKey = new Map(prepared.keys.map((key, id) => [key, id]));
  const fallbackIds = fallbackKeys.map((key) => idByKey.get(key));
  if (fallbackIds.some((id) => id === undefined)) {
    throw new Error("Fast fixed-K probe returned an unknown candidate");
  }
  const refined = refineMinimumCoverQuality(prepared, fallbackIds);
  return {
    count: primary.count,
    keys: refined.selected.map((id) => prepared.keys[id]),
    qualityVector: refined.qualityVector,
    searchedStates: (primary.searchedStates ?? 0) + (dominancePreview?.searchedStates ?? 0) + (probe?.searchedStates ?? 0) + (thresholdProbe?.searchedStates ?? 0),
    backend: primary.backend,
    cardinalityBackend: primary.backend,
    qualityBackend: "fast-2x2",
    qualityExact: false,
    primaryRequested: requestedPrimary, primaryResolved: primary.backend,
    useHiGHSRequested: requested,
    useHiGHSResolved: primary.backend === "highs",
    minimumCoverKernelCases: kernelStats.cases,
    minimumCoverKernelSolutions: kernelStats.solutions,
    minimumCoverKernelEntries: kernelStats.entries,
    primarySearchedStates: primary.searchedStates ?? 0,
    qualitySearchedStates: (dominancePreview?.searchedStates ?? 0) + (probe?.searchedStates ?? 0) + (thresholdProbe?.searchedStates ?? 0),
    fastDominancePreviewBudget: dominancePreviewBudget,
    fastDominancePreviewStates: dominancePreview?.searchedStates ?? 0,
    fastProbeBudget: budget,
    fastProbeStates: probe?.searchedStates ?? 0,
    fastThresholdBudget: thresholdGraceBudget,
    fastThresholdStates: thresholdProbe?.searchedStates ?? 0,
    fastFallback: true,
    fastDecision: "integrated-budget-exceeded",
    qualityRefinementPasses: refined.passes,
  };
}
