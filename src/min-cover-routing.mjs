import { summarizeSecondaryComponents, createSecondarySession, findTrivialSecondary } from './min-cover-components.mjs';

// Experimental serial policy. Budgets count DFS states, not elapsed time; WASM
// preprocessing cannot be interrupted by a JavaScript timer.
export function solveRoutedSecondary(coverage, {
  solver, qualityFor, count, seedKeys, cardinalityProven = false,
  probeStates = 10000, integratedStates = 100000, minComponents = 3,
  thresholdStates = null, structureFirst = false,
}) {
  if (!cardinalityProven) throw new Error('routing requires proven minimum cardinality');
  if (typeof structureFirst !== 'boolean') throw new Error('invalid routing structure-first flag');
  for (const [name, value] of [['probeStates', probeStates], ['integratedStates', integratedStates]]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid routing ${name}`);
  }
  if (probeStates > integratedStates) throw new Error('routing probe exceeds total integrated budget');
  if (!Number.isSafeInteger(minComponents) || minComponents < 2) throw new Error('invalid routing component threshold');
  if (thresholdStates !== null && (!Number.isSafeInteger(thresholdStates) || thresholdStates < 0)) {
    throw new Error('invalid routing threshold budget');
  }
  const trace = { probeBudget: probeStates, integratedBudget: integratedStates,
    minComponents, wholeProbeStates: 0, splitProbeStates: 0, thresholdStates: 0,
    componentCount: null, largestComponent: null, structureFirst,
    effectiveWholeBudget: probeStates };
  const finish = (result, route) => ({ ...result,
    searchedStates: trace.wholeProbeStates + trace.splitProbeStates + trace.thresholdStates,
    routing: { ...trace, route } });
  const trivial = findTrivialSecondary(coverage, count, qualityFor);
  if (trivial) return finish(trivial, 'trivial');
  let analysis;
  const analyze = () => {
    if (!analysis) analysis = summarizeSecondaryComponents(coverage, qualityFor);
    trace.componentCount = analysis.componentCount;
    trace.largestComponent = analysis.largestComponent;
    return analysis;
  };
  // Alternative to early threshold switching: when decomposition offers few
  // independent problems, keep the original integrated budget in a SINGLE
  // invocation. A second invocation would repeat DFS and WASM preparation.
  if (structureFirst && analyze().componentCount < minComponents) {
    trace.effectiveWholeBudget = integratedStates;
  }
  let incumbent = [...seedKeys];
  function checked(result) {
    if (!result || result.count !== count || result.keys?.length !== count || new Set(result.keys).size !== count) {
      throw new Error('routed fixed-count secondary failed');
    }
    return result;
  }
  if (trace.effectiveWholeBudget) {
    const probe = checked(solver?.minimumCoverAtCount?.(coverage, count, {
      qualityFor, seedKeys: incumbent, integrated: true, stateBudget: trace.effectiveWholeBudget,
    }));
    trace.wholeProbeStates = probe.searchedStates ?? 0;
    if (probe.completed === true) return finish(probe, 'whole-probe-exact');
    incumbent = [...probe.keys];
  }
  // Probe-first avoids graph analysis on early completion. Structure-first
  // reuses its earlier analysis here. Neither creates an owned session until
  // the policy actually selects decomposition.
  const { componentCount } = analyze();
  if (componentCount >= minComponents) {
    const session = createSecondarySession(coverage, { qualityFor, count, seedKeys: incumbent,
      cardinalityProven: true, decomposition: 'on' });
    const remaining = Math.max(0, integratedStates - trace.wholeProbeStates);
    if (remaining) {
      const probe = checked(session.run({ solver, engine: 'integrated', stateBudget: remaining }));
      trace.splitProbeStates = probe.searchedStates ?? 0;
      if (probe.completed === true) return finish(probe, 'split-integrated-exact');
    }
    const result = checked(session.run({ solver, engine: 'threshold', stateBudget: thresholdStates }));
    trace.thresholdStates = result.searchedStates ?? 0;
    if (thresholdStates === null && result.completed !== true) throw new Error('routed exact secondary did not complete');
    return finish(result, 'split-threshold');
  }
  // With only a few components, keep the original problem and avoid the cost
  // of constructing component matrices. A bounded experiment may return an
  // incumbent, but the normal exact call always waits for the final proof.
  if (thresholdStates === 0) {
    const session = createSecondarySession(coverage, { qualityFor, count, seedKeys: incumbent,
      cardinalityProven: true, decomposition: 'off' });
    return finish(session.run({ solver, engine: 'threshold', stateBudget: 0 }), 'whole-threshold');
  }
  const result = checked(solver?.minimumCoverAtCount?.(coverage, count, {
    qualityFor, seedKeys: incumbent, integrated: false, stateBudget: thresholdStates,
  }));
  trace.thresholdStates = result.searchedStates ?? 0;
  if (thresholdStates === null && result.completed !== true) throw new Error('routed exact secondary did not complete');
  return finish(result, 'whole-threshold');
}
