import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { STAGE, signature } from './common.mjs';
import { resourceTrace } from './resource.mjs';

let solver, calculateSaves, input, api, resource, phase = 'init';
const send = message => process.send?.(message);
function cleanup() {
  solver?.close();
  send({ kind: 'CLEAN', closed: !solver || solver.ptr === 0 });
  process.disconnect?.();
}
process.on('message', async message => {
  try {
    if (message.kind === 'INIT') {
      const { variant, cell, trace } = message;
      if (!['REF', 'P', 'R', 'M', 'A5', 'A4_REF', 'A4', 'A6'].includes(variant)) throw new Error('Unknown immutable variant');
      const directory = path.join(STAGE, variant);
      resource = trace;
      if (trace) api = await import(pathToFileURL(path.join(directory, 'src/saves.mjs')));
      else {
        ({ calculateSaves } = await import(pathToFileURL(path.join(directory, 'src/saves-feature.mjs'))));
        const { createWasmSolver } = await import(pathToFileURL(path.join(directory, 'src/wasm-backend.mjs')));
        solver = await createWasmSolver(cell.clear ?? 4);
        input = { sourceFumen: cell.sourceFumen, pattern: cell.pattern, wantedSave: cell.wantedSave, clear: cell.clear ?? 4,
          useHold: cell.useHold ?? true, outcomeCache: false, singleSaveMask: true, solver, stats: Boolean(message.stats) };
      }
      send({ kind: 'READY' });
    } else if (message.kind === 'WARM') {
      phase = 'warmup'; calculateSaves(input); send({ kind: 'WARMED' });
    } else if (message.kind === 'RUN') {
      phase = 'run';
      if (resource) {
        const result = resourceTrace(api, resource);
        send({ kind: 'DONE' }); send({ kind: 'RESULT', result }); cleanup(); return;
      }
      const memoryBefore = process.memoryUsage(), wasmBefore = solver.e.memory.buffer.byteLength;
      const cpuBefore = process.cpuUsage(), started = performance.now();
      const value = calculateSaves(input);
      const wallMs = performance.now() - started, cpu = process.cpuUsage(cpuBefore);
      const memoryAfter = process.memoryUsage(), usage = process.resourceUsage();
      const metrics = { wallMs, cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000,
        rssBefore: memoryBefore.rss, rssAfter: memoryAfter.rss, heapBefore: memoryBefore.heapUsed, heapAfter: memoryAfter.heapUsed,
        processLifetimeMaxRSSKiB: usage.maxRSS, wasmBefore, wasmAfter: solver.e.memory.buffer.byteLength };
      send({ kind: 'DONE', metrics });
      // Result serialization/hashing and close are outside the measured call.
      const { stats, ...withoutStats } = value;
      const result = { ...metrics, signature: signature(withoutStats), total: value.total, stats,
        resultSchema: 'canonical-object-keys; array order/multiplicity retained; stats excluded',
        peakCaveat: 'Process-lifetime high-water RSS includes initialization/warmup; not an isolated request peak.' };
      send({ kind: 'RESULT', result }); cleanup();
    }
  } catch (error) {
    send({ kind: 'ERROR', phase, error: { name: error.name, message: error.message, stack: error.stack } });
    try { cleanup(); } catch { process.exitCode = 1; process.disconnect?.(); }
  }
});
