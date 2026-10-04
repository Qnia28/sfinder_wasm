import { performance } from 'node:perf_hooks';
import { openEngine, validateWitness } from './engine.mjs';
import { loadFixture } from './fixtures.mjs';
import { createNumericCoverage } from '../../src/numeric-cover-data.mjs';
import { minCoverMethods } from '../../src/pc-wasm-min-cover.mjs';

// The parent starts the solve timeout only AFTER loading, hashing, instantiating
// and a fixed small warm-up. Hashing and witness serialization are not timed.
let engine;
try {
  const [path, caseId, maskArg] = process.argv.slice(2);
  const mask = Number(maskArg), { entry, matrix } = loadFixture(caseId);
  engine = await openEngine(path);
  if (mask !== 0 || engine.experimental || engine.traceEnabled) throw Error('performance samples require unchanged product ABI with no experiment/trace');
  let nativeMs = 0, calls = 0;
  const exports = { ...engine.exports };
  const exact = exports.solver_min_cover_at_count_locked;
  exports.solver_min_cover_at_count_locked = (...args) => {
    const start = performance.now();
    try { return exact(...args); } finally { nativeMs += performance.now() - start; calls++; }
  };
  // Same owner ABI as WasmPcSolver, using the UNCHANGED product JS method and
  // request-owned numeric matrix metadata. No second search is performed.
  const product = Object.assign({ e: exports, ptr: engine.pointer }, minCoverMethods);
  const prepare = m => {
    const view = createNumericCoverage(m.keys, new Map(m.rows.map((r, id) => [id, r])), m.rows.map((_, caseId) => ({ caseId })));
    return { coverage: view.coverage, options: { qualityFor: (key, id) => view.qualityIndex.get(id)?.get(key), seedKeys: m.seed.map(i => m.keys[i]) } };
  };
  const prepared = prepare(matrix);
  const warm = { keys: ['000','001','002'], rows: [[[0,1],[1,3]],[[1,1],[2,3]],[[0,3],[2,1]]], K: 2, seed: [0,1] };
  const warmPrepared = prepare(warm);
  product.minimumCoverAtCount(warmPrepared.coverage, warm.K, warmPrepared.options);
  process.send({ type: 'ready', wasmHash: engine.wasmHash, traceEnabled: engine.traceEnabled });
  process.once('message', () => {
    try {
      const started = performance.now();
      nativeMs = 0; calls = 0;
      const response = product.minimumCoverAtCount(prepared.coverage, matrix.K, prepared.options);
      const productMs = performance.now() - started, solverMs = productMs;
      if (calls !== 1) throw Error(`product threshold export executed ${calls} times, expected exactly one`);
      const index = new Map(matrix.keys.map((key, i) => [key, i]));
      const result = { completed: response.completed, count: response.count,
        selected: response.keys.map(key => index.get(key)), quality: response.qualityVector, searchedStates: response.searchedStates };
      process.send({ type: 'solved', solverMs, productMs, nativeMs });
      const witnessHash = validateWitness(matrix, result);
      if (!result.completed) throw new Error('unlimited threshold returned an incomplete result');
      process.send({ type: 'result', result, witnessHash, inputHash: entry.sha256,
        wasmHash: engine.wasmHash, traceEnabled: engine.traceEnabled, solverMs, productMs, nativeMs,
        productRoute: 'minimumCoverAtCount/solver_min_cover_at_count_locked', productExportCalls: calls,
        processPeakRssKiB: process.resourceUsage().maxRSS, wasmMemoryBytes: engine.memoryBytes() }, () => {
        engine.close(); process.disconnect();
      });
    } catch (error) {
      process.send({ type: 'error', error: String(error.stack || error) }, () => {
        engine.close(); process.disconnect(); process.exitCode = 1;
      });
    }
  });
} catch (error) {
  engine?.close();
  if (process.send) process.send({ type: 'error', error: String(error.stack || error) }, () => {
    process.disconnect(); process.exitCode = 1;
  });
  else throw error;
}
