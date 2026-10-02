import { WasmPcSolver } from './wasm-backend.mjs';
import { solveFilterTask } from './filter-cover-task.mjs';
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const name = 'node:worker_threads';
const port = isNode ? (await import(/* @vite-ignore */ name)).parentPort : null;
const send = value => port ? port.postMessage(value) : postMessage(value);
let solver, active = null, stopping = false;
function stopped() {
  solver?.close(); solver = null;
  send({ stopped: true });
}
async function receive(message) {
  if (message.stop) {
    stopping = true;
    if (active) active.abort(new Error('filter request ended'));
    else stopped();
    return;
  }
  if (stopping) return;
  try {
    if (message.module) {
      const instance = await WebAssembly.instantiate(message.module, {});
      if (stopping) return;
      solver = new WasmPcSolver(instance.exports, 4);
      send({ ready: true }); return;
    }
    if (!solver || active) throw new Error('filter worker is not ready');
    active = new AbortController();
    const start = performance.now();
    try {
      const value = await solveFilterTask(message.payload, solver, active.signal);
      if (!stopping) send({ id: message.id, value, metrics: { solveMs: performance.now() - start,
        wasmMemoryBytes: solver.e.memory.buffer.byteLength,
        processRss: isNode ? process.memoryUsage().rss : null } });
    } finally {
      active = null;
      // ORTools' finally joins its nested worker before this acknowledgement.
      if (stopping) stopped();
    }
  } catch (error) {
    if (!stopping) send({ id: message.id, error: { name: error.name, message: error.message } });
  }
}
if (port) port.on('message', receive); else onmessage = event => receive(event.data);
