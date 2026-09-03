import { calculateMinimalsFeatureAsync } from '../src/features.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

const sourceFumen = 'v115@DhD8FeD8FeD8FeD8JeAgH';
const pattern = '*!';
const solver = await createWasmSolver(4);
const started = performance.now();
try {
  const result = await calculateMinimalsFeatureAsync({
    sourceFumen,
    pattern,
    wantedSave: '',
    clear: 4,
    solver,
    useHold: true,
  });
  console.log(JSON.stringify({
    seconds: (performance.now() - started) / 1000,
    total: result.total,
    saveSuccess: result.saveSuccess,
    minimalCount: result.minimalCount,
    minimumCoverBackend: result.minimumCoverBackend,
    humanQualityExact: result.humanQualityExact,
    coverageCounts: result.coverageCounts,
  }, null, 2));
} finally {
  solver.close();
}
