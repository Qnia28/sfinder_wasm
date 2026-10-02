import { performance } from 'node:perf_hooks';
import { openEngine, validateWitness } from './engine.mjs';
import { loadFixture } from './fixtures.mjs';

// The parent starts the solve timeout only AFTER loading, hashing, instantiating
// and a fixed small warm-up. Hashing and witness serialization are not timed.
let engine;
try {
  const [path, caseId, maskArg] = process.argv.slice(2);
  const mask = Number(maskArg), { entry, matrix } = loadFixture(caseId);
  engine = await openEngine(path);
  const warm = { keys: ['000','001','002'], rows: [[[0,1],[1,3]],[[1,1],[2,3]],[[0,3],[2,1]]], K: 2, seed: [0,1] };
  engine.solve(warm, { mask });
  process.send({ type: 'ready', wasmHash: engine.wasmHash, traceEnabled: engine.traceEnabled });
  process.once('message', () => {
    try {
      const started = performance.now();
      const result = engine.solve(matrix, { mask, timing: true });
      const solverMs = performance.now() - started;
      process.send({ type: 'solved', solverMs, nativeMs: result.nativeMs });
      const witnessHash = validateWitness(matrix, result);
      if (!result.completed) throw new Error('unlimited threshold returned an incomplete result');
      process.send({ type: 'result', result, witnessHash, inputHash: entry.sha256,
        wasmHash: engine.wasmHash, traceEnabled: engine.traceEnabled, solverMs, nativeMs: result.nativeMs,
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
