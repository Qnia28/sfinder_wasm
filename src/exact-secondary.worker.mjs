import { WasmPcSolver } from './wasm-backend.mjs';
import { registerNumericCoverage } from './numeric-cover-data.mjs';
import { solveExactSecondaryAsync } from './min-cover-three-engine.mjs';
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const name = 'node:worker_threads';
const port = isNode ? (await import(/* @vite-ignore */ name)).parentPort : null;
const send = value => port ? port.postMessage(value) : postMessage(value);
let solver, active = null, stopping = false;
function stopped() { solver?.close(); solver = null; send({ stopped: true }); }
async function receive(message) {
  if (message.stop) {
    stopping = true;
    if (active) active.abort(new Error('secondary request ended')); else stopped();
    return;
  }
  if (stopping) return;
  try {
    if (message.module) {
      const instance = await WebAssembly.instantiate(message.module, {});
      solver = new WasmPcSolver(instance.exports, 4); // Matrix-only: no legal pack or enumeration state.
      send({ ready: true }); return;
    }
    if (!solver) throw new Error('secondary worker is not initialized');
    const { keys, offsets, ids, qualities, context } = message.payload;
    const rawCases = Array.from({ length: offsets.length - 1 }, (_, caseId) => ({ caseId }));
    const prepared = { keys, keyIndex: new Map(keys.map((key, id) => [key, id])), rawCases, primaryCases: [] };
    const coverage = { size: rawCases.length };
    registerNumericCoverage(coverage, prepared, { offsets, ids, qualities, caseCount: rawCases.length, entryCount: ids.length });
    const qualityFor = () => { throw new Error('secondary must use the packed original quality matrix'); };
    active = new AbortController();
    try {
      // Legacy direct pool clients carry no engine field; keep their exact
      // metadata contract. Production adaptive requests explicitly send auto.
      const value = await solveExactSecondaryAsync(coverage, { ...context, secondary: context.secondary ?? 'rust', solver, qualityFor, signal: active.signal });
      if (!stopping) send({ id: message.id, value });
    } finally { active = null; if (stopping) stopped(); }
  } catch (error) { if (!stopping) send({ id: message.id, error: { name: error.name, message: error.message } }); }
}
if (port) port.on('message', receive); else onmessage = event => receive(event.data);
