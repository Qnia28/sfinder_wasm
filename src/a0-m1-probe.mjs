import { retryableLoader } from './promise-utils.mjs';
import { WasmPcSolver } from './wasm-backend.mjs';

export function normalizeExactProbe(value = 'reference') {
  if (!['reference', 'a0-m1'].includes(value)) throw new Error('invalid exactProbe policy: ' + value);
  return value;
}

// Only eligible opted-in ordinary Exact probes load this matrix-only module.
const loadCandidateModule = retryableLoader(async () => {
  const url = new URL('../wasm/pc_a0_m1.wasm', import.meta.url);
  let bytes;
  if (typeof process !== 'undefined' && process.versions?.node) {
    const name = 'node:fs/promises';
    bytes = await (await import(/* @vite-ignore */ name)).readFile(url);
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`A0+M1 WASM fetch: ${response.status}`);
    bytes = await response.arrayBuffer();
  }
  const module = await WebAssembly.compile(bytes);
  if (!WebAssembly.Module.exports(module).some(e => e.name === 'solver_min_cover_at_count_integrated_partitioned_bounded')) {
    throw new Error('A0+M1 WASM lacks the partitioned probe export');
  }
  return module;
});

export async function createA0M1ProbeSolver(signal = null) {
  signal?.throwIfAborted();
  const module = await loadCandidateModule();
  signal?.throwIfAborted();
  const instance = await WebAssembly.instantiate(module, {});
  signal?.throwIfAborted();
  return new WasmPcSolver(instance.exports, 4);
}
