import { solveExactSecondary } from './min-cover-exact-secondary.mjs';
import { findTrivialSecondary } from './min-cover-components.mjs';
import { WasmPcSolver } from './wasm-backend.mjs';
import { isORToolsSupported, assertORToolsSupported } from './ortools-min-cover.mjs';
import { prepareSecondaryEngineInput, startSecondaryEngine, raceSecondaryEngines } from './secondary-engine-runner.mjs';
import { normalizeExactProbe, createA0M1ProbeSolver } from './a0-m1-probe.mjs';

export const SECONDARY_CP_DELAY_MS = 60000;
export const SECONDARY_CP_LIMIT_MS = 120000;
export function normalizeSecondary(value = 'auto') {
  const mode = String(value).trim().toLowerCase();
  if (!['auto', 'rust', 'integrated', 'threshold', 'cpsat'].includes(mode)) throw new Error('invalid secondary engine: ' + value);
  return mode;
}

export function validateSecondaryWitness(payload, result) {
  const { keys, offsets, ids, qualities, count } = payload;
  if (result?.completed !== true || result.count !== count || !Array.isArray(result.keys) || result.keys.length !== count || new Set(result.keys).size !== count) throw new Error('invalid exact secondary cardinality');
  const index = new Map(keys.map((key, id) => [key, id]));
  const chosen = new Set(result.keys.map(key => { if (!index.has(key)) throw new Error('unknown secondary candidate'); return index.get(key); }));
  const vector = [];
  for (let row = 0; row < offsets.length - 1; row++) {
    let best = 0;
    for (let e = offsets[row]; e < offsets[row + 1]; e++) if (chosen.has(ids[e])) best = Math.max(best, qualities[e]);
    if (!best) throw new Error('secondary witness misses original row'); vector.push(best);
  }
  vector.sort((a, b) => a - b);
  if (!Array.isArray(result.qualityVector) || result.qualityVector.length !== vector.length || vector.some((q, i) => q !== result.qualityVector[i])) throw new Error('secondary original-row weighted quality mismatch');
  return { ...result, keys: [...chosen].sort((a, b) => a - b).map(id => keys[id]), qualityVector: vector };
}

// Auto keeps the audited integrated100k -> threshold path. CP is a late helper,
// not an early state-budget replacement. Rust progress survives the CP attempt.
export async function solveExactSecondaryAsync(coverage, options) {
  const started = performance.now(), mode = normalizeSecondary(options.secondary);
  options.signal?.throwIfAborted();
  const policy = normalizeExactProbe(options.exactProbe);
  const eligible = (policy === 'a0-m1' || options.exactProbeTiming === true)
    && options.integratedProbe == null && ['auto', 'rust'].includes(mode) && !options.primaryHard
    && (options.decomposition ?? 'off') === 'off'
    && !findTrivialSecondary(coverage, options.primary.count, options.qualityFor);
  let candidate = null, trace = options.integratedProbe?.exactProbeTrace ?? null;
  try {
    if (eligible) {
      let loadMs = 0;
      if (policy === 'a0-m1') {
        const loading = performance.now();
        candidate = await createA0M1ProbeSolver(options.signal);
        loadMs = performance.now() - loading;
      }
      const ordinaryProbe = searchOptions => {
        options.signal?.throwIfAborted();
        const searching = performance.now();
        const value = (candidate ?? options.solver)?.minimumCoverAtCount?.(coverage, options.primary.count,
          candidate ? { ...searchOptions, partitioned: true } : searchOptions);
        const apiMs = performance.now() - searching;
        if (candidate && (typeof value?.completed !== 'boolean' || value.error)) throw new Error('A0+M1 probe failed');
        // Validate both EXACT and CAPPED witnesses against original weighted rows.
        // A feasible capped incumbent is not promoted to an exact proof.
        if (candidate) validateSecondaryWitness(prepareSecondaryEngineInput(coverage, options.qualityFor,
          options.primary.count, options.primaryKeys), { ...value, completed: true });
        candidate?.close(); candidate = null; // Release matrix memory before threshold/CP starts.
        options.signal?.throwIfAborted();
        trace = { policy, status: value == null ? 'UNAVAILABLE' : value.completed ? 'EXACT' : 'CAPPED', stateBudget: 100000,
          searchedStates: value?.searchedStates ?? 0,
          ...(options.exactProbeTiming ? { apiMs, loadMs } : {}) };
        if (value) value.exactProbeTrace = trace;
        return value;
      };
      options = { ...options, ordinaryProbe };
    }
    const result = await solveSelectedSecondary(coverage, options, started, mode);
    return trace ? { ...result, exactProbeTrace: trace } : result;
  } finally { candidate?.close(); }
}

async function solveSelectedSecondary(coverage, options, started, mode) {
  const { solver, qualityFor, primary, primaryKeys, signal = null } = options;
  signal?.throwIfAborted();
  const elapsedBefore = options.secondaryElapsedMs ?? 0;
  const externalDefer = options.deferThreshold;
  const forward = context => externalDefer({ ...context, exactProbe: options.exactProbe ?? 'reference',
    exactProbeTiming: options.exactProbeTiming ?? false, secondary: mode,
    secondaryElapsedMs: elapsedBefore + performance.now() - started });
  if (mode === 'rust' || (mode === 'auto' && ((options.decomposition ?? 'off') !== 'off' || !(solver instanceof WasmPcSolver) || !isORToolsSupported()))) {
    return solveExactSecondary(coverage, { ...options, deferThreshold: externalDefer ? forward : null });
  }
  if (mode !== 'auto' && findTrivialSecondary(coverage, primary.count, qualityFor)) return solveExactSecondary(coverage, options);
  if (mode !== 'auto' && externalDefer) return forward({ ...options, solver: undefined, qualityFor: undefined, deferThreshold: undefined, signal: undefined });

  const format = (result, engine, probe = null, cpStarted = false) => {
    const baseline = solveExactSecondary(coverage, { ...options, deferThreshold: null,
      primaryHard: engine !== 'integrated', integratedProbe: engine === 'integrated' ? result : undefined,
      solver: { minimumCoverAtCount: () => result } });
    const probeStates = probe?.searchedStates ?? 0;
    return { ...baseline,
      backend: engine === 'cpsat' ? `${primary.backend}+cpsat` : baseline.backend,
      qualityBackend: engine === 'cpsat' ? 'ortools-quality-cpsat' : engine === 'integrated' ? 'rust-quality-integrated' : options.primaryHard ? 'rust-quality-bnb' : 'rust-quality-threshold-fallback',
      qualityDecision: engine === 'cpsat' ? (mode === 'auto' ? 'late-cpsat-exact' : 'explicit-cpsat-exact')
        : engine === 'integrated' ? 'integrated-exact' : mode === 'threshold' ? 'explicit-threshold-exact' : options.primaryHard ? 'primary-hard-threshold-exact' : 'integrated-budget-to-threshold',
      qualitySearchedStates: probeStates + (result.searchedStates ?? 0),
      ...(probe ? { integratedProbeStates: probeStates } : {}),
      secondaryRequested: mode, secondaryResolved: engine, secondaryCpStarted: cpStarted };
  };
  if (mode === 'integrated' || mode === 'threshold') {
    const result = solver?.minimumCoverAtCount?.(coverage, primary.count, { qualityFor, seedKeys: primaryKeys, integrated: mode === 'integrated' });
    const payload = prepareSecondaryEngineInput(coverage, qualityFor, primary.count, primaryKeys);
    return format(validateSecondaryWitness(payload, result), mode);
  }
  if (mode === 'cpsat') {
    assertORToolsSupported();
    const payload = prepareSecondaryEngineInput(coverage, qualityFor, primary.count, primaryKeys);
    const engine = startSecondaryEngine('cpsat', payload, { limitMs: SECONDARY_CP_LIMIT_MS, signal });
    try {
      const result = await engine.promise;
      if (!result?.completed || !result.qualityComplete || !result.tieComplete) throw new Error('CP-SAT did not prove exact quality and stable IDs within its limit');
      return format(validateSecondaryWitness(payload, result), 'cpsat', null, true);
    } finally { await engine.stop(); }
  }
  return solveExactSecondary(coverage, { ...options, deferThreshold: async context => {
    if (externalDefer) return forward(context);
    const probe = context.integratedProbe;
    const seedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;
    const payload = prepareSecondaryEngineInput(coverage, qualityFor, primary.count, seedKeys);
    const cpAfterMs = Math.max(0, SECONDARY_CP_DELAY_MS - elapsedBefore - (performance.now() - started));
    const winner = await raceSecondaryEngines({
      startRust: () => startSecondaryEngine('threshold', payload, { signal }),
      startCp: () => startSecondaryEngine('cpsat', payload, { limitMs: SECONDARY_CP_LIMIT_MS, signal }),
      cpAfterMs, signal, validate: value => validateSecondaryWitness(payload, value),
    });
    return { ...format(winner.result, winner.engine === 'cpsat' ? 'cpsat' : 'threshold', probe, winner.cpStarted),
      ...(winner.cpFailure ? { secondaryCpFailure: winner.cpFailure } : {}) };
  } });
}
