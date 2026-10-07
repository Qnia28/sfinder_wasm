import { solveExactSecondary } from './min-cover-exact-secondary.mjs';
import { findTrivialSecondary } from './min-cover-components.mjs';
import { WasmPcSolver } from './wasm-backend.mjs';
import { isORToolsSupported, assertORToolsSupported } from './ortools-min-cover.mjs';
import { prepareSecondaryEngineInput, startSecondaryEngine, raceSecondaryEngines } from './secondary-engine-runner.mjs';

export const SECONDARY_CP_DELAY_MS = 60000;
// null means no product deadline. Benchmarks own a separate whole-call watchdog.
export const SECONDARY_CP_LIMIT_MS = null;
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

// Auto uses the bounded structural probe before threshold. CP joins late without
// a product time limit; either exact engine may finish and Rust survives CP failure.
export async function solveExactSecondaryAsync(coverage, options) {
  const started = performance.now(), mode = normalizeSecondary(options.secondary);
  const { solver, qualityFor, primary, primaryKeys, signal = null } = options;
  const trace = options.secondaryTrace;
  const emit = (name, details = {}) => trace?.({ name, ...details });
  if ((options.experimentalTriagePolicy ?? 'baseline') !== 'baseline' && mode !== 'auto' && mode !== 'rust') {
    throw new Error('experimental triage only supports Auto/Rust policy');
  }
  signal?.throwIfAborted();
  const elapsedBefore = options.secondaryElapsedMs ?? 0;
  const cpLimitMs = options.secondaryCpLimitMs === undefined ? SECONDARY_CP_LIMIT_MS : options.secondaryCpLimitMs;
  if (cpLimitMs !== null && (!Number.isFinite(cpLimitMs) || cpLimitMs <= 0)) throw new Error('invalid CP time limit');
  const externalDefer = options.deferThreshold;
  const forward = context => externalDefer({ ...context, secondary: mode, secondaryCpLimitMs: cpLimitMs,
    secondaryElapsedMs: elapsedBefore + performance.now() - started });
  if (mode === 'rust' || (mode === 'auto' && ((options.decomposition ?? 'off') !== 'off' || !(solver instanceof WasmPcSolver) || !isORToolsSupported()))) {
    return solveExactSecondary(coverage, { ...options, deferThreshold: externalDefer ? forward : null });
  }
  if (mode !== 'auto' && findTrivialSecondary(coverage, primary.count, qualityFor)) return solveExactSecondary(coverage, options);
  if (mode !== 'auto' && externalDefer) return forward({ ...options, solver: undefined, qualityFor: undefined, deferThreshold: undefined, signal: undefined });

  const format = (result, engine, probe = null, cpStarted = false) => {
    const baseline = solveExactSecondary(coverage, { ...options, deferThreshold: null,
       primaryHard: engine !== 'integrated', integratedProbe: engine === 'integrated' ? result : undefined,
       experimentalTriagePolicy: 'baseline', secondaryTrace: undefined,
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
    emit('cp-start', { limitMs:cpLimitMs, explicit:true });
    const engine = startSecondaryEngine('cpsat', payload, { limitMs: cpLimitMs, signal });
    try {
      const result = await engine.promise;
      if (!result?.completed || !result.qualityComplete || !result.tieComplete) throw new Error('CP-SAT did not prove exact quality and stable IDs within its limit');
      emit('cp-end', { kind:'EXACT', explicit:true });
      return format(validateSecondaryWitness(payload, result), 'cpsat', null, true);
    } finally { await engine.stop(); }
  }
  return solveExactSecondary(coverage, { ...options, deferThreshold: async context => {
    if (externalDefer) return forward(context);
    const probe = context.integratedProbe;
    const seedKeys = probe?.keys?.length === primary.count ? probe.keys : primaryKeys;
    const payload = prepareSecondaryEngineInput(coverage, qualityFor, primary.count, seedKeys);
    const cpAfterMs = Math.max(0, SECONDARY_CP_DELAY_MS - elapsedBefore - (performance.now() - started));
    emit('threshold-worker-start', { seedSource: probe?.keys?.length === primary.count ? 'probe' : 'primary',
      seedKeys, cpAfterMs, cpLimitMs });
    const winner = await raceSecondaryEngines({
      startRust: () => startSecondaryEngine('threshold', payload, { signal }),
      startCp: () => { emit('cp-start', { limitMs: cpLimitMs });
        return startSecondaryEngine('cpsat', payload, { limitMs: cpLimitMs, signal }); },
       cpAfterMs, signal, validate: value => validateSecondaryWitness(payload, value),
       ...(trace ? { onCpOutcome: outcome => emit('cp-end', outcome) } : {}),
    });
    emit('engines-reaped', { winner: winner.engine, cpStarted: winner.cpStarted, cpFailure: winner.cpFailure });
    return { ...format(winner.result, winner.engine === 'cpsat' ? 'cpsat' : 'threshold', probe, winner.cpStarted),
      ...(winner.rustFailure ? { secondaryRustFailure:winner.rustFailure } : {}),
      ...(winner.cpFailure ? { secondaryCpFailure: winner.cpFailure } : {}) };
  } });
}
