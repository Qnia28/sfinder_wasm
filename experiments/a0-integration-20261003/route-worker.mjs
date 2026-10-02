import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import { ROOT, matrixInput, context, verify } from './common.mjs';
const { entry, variant, phase } = workerData;
if (!['R', 'A'].includes(variant) || !['smoke', 'reserved'].includes(phase)) throw Error('Unknown route condition');
if (entry.partition === 'reserved-validation' && phase !== 'reserved') throw Error('Reserved input before freeze');
const start = performance.now(), m = matrixInput(entry), inputMs = performance.now() - start;
const root = variant === 'R' ? path.join(ROOT, '.a0/baseline') : ROOT;
const { createWasmSolver } = await import(pathToFileURL(path.join(root, 'src/wasm-backend.mjs')));
const { createNumericCoverage } = await import(pathToFileURL(path.join(root, 'src/numeric-cover-data.mjs')));
const { solveExactSecondary } = await import(pathToFileURL(path.join(root, 'src/min-cover-exact-secondary.mjs')));
const init = performance.now(), solver = await createWasmSolver(4, { legal: false }), initMs = performance.now() - init;
const trace = [];
let witnessVerifyMs = 0;
try {
  for (const name of ['enumeratePcPatternCompact', 'minimumCoverCardinality', 'primaryKernelize', 'minimumCover', 'minimumCoverIds']) solver[name] = () => { throw Error(`FORBIDDEN:${name}`); };
  const { coverage } = createNumericCoverage(m.keys, new Map(m.rows.map((r, i) => [i, r])), m.cases);
  const original = solver.minimumCoverAtCount;
  solver.minimumCoverAtCount = function(cov, k, options) {
    const engine = options.integrated ? 'integrated' : 'threshold';
    if (engine === 'integrated' && (options.stateBudget !== 100000 || !!options.partitioned !== (variant === 'A') || options.dominance)) throw Error('A0 product scope drift');
    const actual = engine === 'threshold' ? { ...options, stateBudget: 2000000 } : options;
    parentPort.postMessage({ type: 'phase-start', engine });
    const t = performance.now(), result = original.call(this, cov, k, actual), apiMs = performance.now() - t;
    parentPort.postMessage({ type: 'phase-done', engine });
    const verifyStart = performance.now(), witness = verify(m, result, options.seedKeys);
    witnessVerifyMs += performance.now() - verifyStart;
    trace.push({ engine, stateBudget: actual.stateBudget, partitioned: !!actual.partitioned, completed: result.completed, states: result.searchedStates, apiMs, inputSeedKeys: options.seedKeys, ...witness });
    return result;
  };
  const routeStart = performance.now(); let final, status = 'EXACT', reason = null;
  try { final = solveExactSecondary(coverage, { ...context(m), solver, qualityFor: () => { throw Error('Must use original numeric qualities'); } }); }
  catch (error) { if (trace.at(-1)?.engine === 'threshold' && trace.at(-1)?.completed === false) { status = 'INCONCLUSIVE'; reason = 'THRESHOLD_VALIDATION_STATE_CAP'; } else throw error; }
  const routeGrossMs = performance.now() - routeStart, routeWallMs = routeGrossMs - witnessVerifyMs;
  if (final && (!final.qualityExact || final.count !== m.K)) throw Error('Product final proof contract');
  const proof = final ? verify(m, final) : null;
  parentPort.postMessage({ type: 'result', result: { status, reason, finalWitness: proof, decision: final?.qualityDecision ?? null, finalStates: final?.qualitySearchedStates ?? null,
    trace, routeWallMs, routeGrossMs, witnessVerifyMs, inputMs, initMs, wasmBytes: solver.e.memory.buffer.byteLength, K: m.K, inputIdentitySha256: entry.identitySha256, primaryProof: m.primary.proof,
    actualInputPrimaryCalls: 0, actualInputPcCalls: 0 } });
} finally { solver.close(); }
