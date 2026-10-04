import { minimumCover } from "./min-cover.mjs";
import { inspectTrivialSecondary, createSecondarySession } from './min-cover-components.mjs';
import { solveRoutedSecondary } from './min-cover-routing.mjs';
const FAST_EXACT_STATE_BUDGET = 100000;

export function solveExactSecondary(coverage, options) {
    if (!['off', 'on', 'auto'].includes(options.decomposition ?? 'off')) throw new Error('invalid secondary decomposition mode');
    const { result: trivial, structure } = inspectTrivialSecondary(coverage, options.primary.count, options.qualityFor);
    const attachStructure = result => ({ ...result, secondaryStructure: structure });
    const result = solveInspectedSecondary(coverage, options, trivial);
    return result?.then ? result.then(attachStructure) : attachStructure(result);
}

function solveInspectedSecondary(coverage, options, trivial) {
    const { solver, qualityFor, primary, primaryKeys, primaryHard, requestedPrimary, requested, kernelStats,
      integratedProbe, deferThreshold, decomposition = 'off', routingProbeStates = 10000,
      routingMinComponents = 3, routingStructureFirst = false, ordinaryProbe = null } = options;
    const defer = probe => deferThreshold({ primary, primaryKeys, primaryHard, requestedPrimary,
      requested, kernelStats, integratedProbe: probe, ...(decomposition !== 'off' ? { decomposition } : {}),
      ...(decomposition === 'auto' ? { routingProbeStates, routingMinComponents, routingStructureFirst } : {}) });

    if (trivial) return {
      ...trivial,
      backend: primary.backend === "highs" ? "highs+rust" : primary.backend === "kernel" ? "kernel+rust" : "rust",
      cardinalityBackend: primary.backend, qualityBackend: 'original-row-proof', qualityExact: true,
      primaryRequested: requestedPrimary, primaryResolved: primary.backend,
      useHiGHSRequested: requested, useHiGHSResolved: primary.backend === 'highs',
      minimumCoverKernelCases: kernelStats.cases, minimumCoverKernelSolutions: kernelStats.solutions,
      minimumCoverKernelEntries: kernelStats.entries, primarySearchedStates: primary.searchedStates ?? 0,
      qualitySearchedStates: 0, fastProbeBudget: null, fastProbeStates: null, fastFallback: false,
      qualityDecision: 'trivial-exact',
    };
    // auto is an explicit experimental policy; the production default remains
    // off until short-probe and component thresholds have independent evidence.
    if (decomposition === 'auto') {
      // A legacy probe has no routing budget/ownership metadata. Do not
      // silently discard it and repeat its work under another policy.
      if (integratedProbe != null) throw new Error('routing cannot resume a legacy integrated probe');
      if (deferThreshold) return defer(undefined);
      const routed = solveRoutedSecondary(coverage, { solver, qualityFor, count: primary.count,
        seedKeys: primaryKeys, cardinalityProven: true, probeStates: routingProbeStates,
        minComponents: routingMinComponents, structureFirst: routingStructureFirst });
      return { ...routed,
        backend: primary.backend === 'highs' ? 'highs+rust' : primary.backend === 'kernel' ? 'kernel+rust' : 'rust',
        cardinalityBackend: primary.backend, qualityBackend: 'rust-quality-routing', qualityExact: true,
        primaryRequested: requestedPrimary, primaryResolved: primary.backend,
        useHiGHSRequested: requested, useHiGHSResolved: primary.backend === 'highs',
        minimumCoverKernelCases: kernelStats.cases, minimumCoverKernelSolutions: kernelStats.solutions,
        minimumCoverKernelEntries: kernelStats.entries, primarySearchedStates: primary.searchedStates ?? 0,
        qualitySearchedStates: routed.searchedStates, fastProbeBudget: null, fastProbeStates: null,
        fastFallback: false, qualityDecision: routed.routing.route };
    }
    let session;
    const search = searchOptions => {
      if (decomposition !== 'on') return solver?.minimumCoverAtCount?.(coverage, primary.count, searchOptions);
      if (!session) session = createSecondarySession(coverage, { qualityFor, count: primary.count,
        seedKeys: searchOptions.seedKeys, cardinalityProven: true, decomposition });
      return session.run({ solver, engine: searchOptions.integrated ? 'integrated' : 'threshold',
        stateBudget: searchOptions.stateBudget ?? null });
    };

    // Ordinary fixed-K quality problems are much faster with the canonical
    // integrated BestSetSearch once K is already known. Bound that first
    // attempt so pathological quality structures can fall back to the
    // sequential-threshold exact prover without sacrificing exactness.
    if (!primaryHard) {
       const integrated = integratedProbe ?? (ordinaryProbe && decomposition === 'off' ? ordinaryProbe : search)({
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
      if (deferThreshold) return defer(integrated);
      const sequentialSeed = integrated?.keys?.length === primary.count ? integrated.keys : primaryKeys;
      const exact = search({
        qualityFor, seedKeys: sequentialSeed, lockedPrefix: [],
      }) ?? minimumCover(coverage, { qualityFor, solver });
      if (!Number.isFinite(exact?.count) || exact.count !== primary.count || exact.completed === false) {
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

    if (deferThreshold) return defer(undefined);
    const exact = search({
      qualityFor, seedKeys: primaryKeys, lockedPrefix: [],
    }) ?? minimumCover(coverage, { qualityFor, solver });
    if (!Number.isFinite(exact?.count) || exact.count !== primary.count || exact.completed === false) {
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
