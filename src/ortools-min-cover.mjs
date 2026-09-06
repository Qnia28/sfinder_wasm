// Original sfinder-wasm adapter, Apache-2.0. Runtime notices: third_party/.
export const ORTOOLS_PRIMARY_PARAMETERS = Object.freeze({
  numWorkers: 2, subsolvers: Object.freeze(['max_lp']), randomSeed: 1,
  addZeroHalfCuts: false, useSatInprocessing: false,
});

export function isORToolsSupported() {
  return typeof SharedArrayBuffer === 'function'
    && typeof WebAssembly.Suspending === 'function'
    && typeof WebAssembly.promising === 'function'
    // A browser may expose SharedArrayBuffer while its context is not isolated.
    // Node has no crossOriginIsolated property and does not require COOP/COEP.
    && globalThis.crossOriginIsolated !== false;
}

export function assertORToolsSupported() {
  if (!isORToolsSupported()) {
    throw new Error('ORTools requires WebAssembly JSPI, SharedArrayBuffer and browser cross-origin isolation. Use Primary=Auto, Rust or HiGHS; in browsers enable COOP/COEP, or in Node enable --experimental-wasm-stack-switching.');
  }
}

export async function solveORToolsCardinalityKernel(kernel) {
  if (!kernel.cases.length) return {count: kernel.forced.length, selected: [...kernel.forced], backend: 'kernel', searchedStates: 0};
  assertORToolsSupported();
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  const nodeModule = 'node:worker_threads';
  const NodeWorker = isNode ? (await import(/* @vite-ignore */ nodeModule)).Worker : null;
  const worker = isNode
    ? new NodeWorker(new URL('./ortools-primary-worker.mjs', import.meta.url), {execArgv: []})
    : new Worker(new URL('./ortools-primary-worker.mjs', import.meta.url), {type: 'module'});
  try {
    const result = await new Promise((resolve, reject) => {
      const receive = data => data.error ? reject(new Error(data.error)) : resolve(data.result);
      if (isNode) {
        worker.once('message', receive); worker.once('error', reject);
        worker.once('exit', code => reject(new Error('ORTools worker exited before a result: ' + code)));
      } else {
        worker.onmessage = event => receive(event.data);
        worker.onerror = event => reject(new Error(event.message || 'ORTools worker failed'));
        worker.onmessageerror = () => reject(new Error('ORTools result could not be decoded'));
      }
      worker.postMessage(kernel);
    });
    const chosen = new Set(result.selected);
    if (result.status !== 'OPTIMAL' || result.count !== result.proofBound || chosen.size !== result.count
        || !kernel.forced.every(id => chosen.has(id))
        || !result.selected.every(id => kernel.forced.includes(id) || kernel.solutionIds.includes(id))
        || !kernel.cases.every(row => row.some(id => chosen.has(kernel.solutionIds[id])))) {
      throw new Error('ORTools returned an invalid cardinality proof or witness');
    }
    return result;
  } finally { await worker.terminate(); }
}
