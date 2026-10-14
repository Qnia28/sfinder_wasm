import { WasmPcSolver } from './wasm-backend.mjs';
import { registerNumericCoverage } from './numeric-cover-data.mjs';
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const name = 'node:worker_threads';
const port = isNode ? (await import(/* @vite-ignore */ name)).parentPort : null;
const send = data => port ? port.postMessage(data) : postMessage(data);
async function run({ engine, module, payload, limitMs }) {
  let solver, api, response, diagnostic;
  try {
    if (isNode && process.env.SECONDARY_MEMORY_DIRECTORY) {
      const { installMemoryTrace } = await import(process.env.SECONDARY_MEMORY_MODULE);
      diagnostic = installMemoryTrace(engine);
    }
    const trace = globalThis.__secondaryMemoryTrace;
    trace?.('worker-payload-ready');
    const { keys, offsets, ids, qualities, count, seedKeys } = payload;
    if (engine === 'cpsat') {
      const { assertORToolsSupported } = await import('./ortools-min-cover.mjs'); assertORToolsSupported();
      const started = performance.now(), nodeApi = './vendor/ortools/node/cp-sat.js';
      api = isNode ? await import(/* @vite-ignore */ nodeApi) : await import('./vendor/ortools/browser/cp-sat.js');
      const { solveCpSecondaryModel } = await import('./cpsat-secondary-model.mjs');
      trace?.('rows-expand-begin');
      const rows = Array.from({ length: offsets.length - 1 }, (_, r) => {
        const row = []; for (let i = offsets[r]; i < offsets[r + 1]; i++) row.push([ids[i], qualities[i]]); return row;
      });
      trace?.('rows-expand-end', { rows: rows.length, edges: ids.length });
      const keyIndex = new Map(keys.map((key, id) => [key, id]));
       const remaining = limitMs === null ? null : limitMs - (performance.now() - started);
       const result = remaining === null || remaining > 0 ? await solveCpSecondaryModel({ keys, rows, count, seed: seedKeys.map(key => keyIndex.get(key)) }, api, { limitMs: remaining }) : { completed: false };
      response = { result };
    } else {
      const instance = await WebAssembly.instantiate(module, {}); solver = new WasmPcSolver(instance.exports, 4);
      const rawCases = Array.from({ length: offsets.length - 1 }, (_, caseId) => ({ caseId }));
      const prepared = { keys, keyIndex: new Map(keys.map((key, id) => [key, id])), rawCases, primaryCases: [] };
      const coverage = { size: rawCases.length };
      registerNumericCoverage(coverage, prepared, { offsets, ids, qualities, caseCount: rawCases.length, entryCount: ids.length });
      send({ started: true });
      trace?.('threshold-native-enter', { wasmBytes:instance.exports.memory.buffer.byteLength });
      const result = solver.minimumCoverAtCount(coverage, count, { integrated: engine === 'integrated', seedKeys,
        qualityFor: () => { throw new Error('secondary requires packed qualities'); } });
      trace?.('threshold-native-return', { wasmBytes:instance.exports.memory.buffer.byteLength });
      response = { result };
    }
  } catch (error) { response = { error: { name: error.name, message: error.message } }; }
  finally {
    solver?.close();
    try { await api?.terminateLoadedRuntimeThreads(); } catch (error) { response = { error: { message: 'CP cleanup failed: ' + String(error) } }; }
    diagnostic?.close();
  }
  send(response);
}
if (port) port.once('message', run); else onmessage = event => run(event.data);
