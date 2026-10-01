import { numericPacked } from './numeric-cover-data.mjs';
import { packNumericQualityRows } from './pc-wasm-cover-matrix.mjs';

let modulePromise;
export function compiledCoverModule() {
  if (!modulePromise) modulePromise = (async () => {
    const url = new URL('../wasm/pc_wasm.wasm', import.meta.url);
    let bytes;
    if (typeof process !== 'undefined' && process.versions?.node) {
      const name = 'node:fs/promises';
      bytes = await (await import(/* @vite-ignore */ name)).readFile(url);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`secondary WASM fetch: ${response.status}`);
      bytes = await response.arrayBuffer();
    }
    return WebAssembly.compile(bytes);
  })().catch(error => { modulePromise = null; throw error; });
  return modulePromise;
}

export class ExactSecondaryPool {
  constructor(size) {
    if (!Number.isInteger(size) || size < 1 || size > 4) throw new RangeError('secondaryWorkers must be an integer in 0..4');
    this.size = size; this.queue = []; this.slots = []; this.nextId = 1;
    this.disposed = false; this.error = null; this.starting = null;
  }
  submit(prepared, context) {
    if (this.disposed || this.error) throw this.error ?? new Error('secondary pool is disposed');
    const matrix = numericPacked(prepared.rawCases) ?? packNumericQualityRows(prepared.cases, prepared.keys.length);
    // These buffers belong to the job. Never detach the owner's cached CSR.
    const payload = { keys: prepared.keys, offsets: matrix.offsets.slice(), ids: matrix.ids.slice(),
      qualities: matrix.qualities.slice(), context };
    const id = this.nextId++;
    const pending = new Promise((resolve, reject) => { this.queue.push({ id, payload, resolve, reject }); });
    pending.catch(() => {});
    this.start(); this.pump();
    return { secondaryPending: pending };
  }
  start() {
    if (this.starting) return;
    this.starting = (async () => {
      const module = await compiledCoverModule();
      const isNode = typeof process !== 'undefined' && !!process.versions?.node;
      const name = 'node:worker_threads';
      const NodeWorker = isNode ? (await import(/* @vite-ignore */ name)).Worker : null;
      if (this.disposed) return;
      for (let index = 0; index < this.size; index++) {
        const worker = isNode ? new NodeWorker(new URL('./exact-secondary.worker.mjs', import.meta.url))
          : new Worker(new URL('./exact-secondary.worker.mjs', import.meta.url), { type: 'module' });
         const slot = { worker, ready: false, active: null }; this.slots.push(slot);
         slot.stopped = new Promise(resolve => { slot.stopAck = resolve; });
         const receive = data => {
           if (data.stopped) { slot.stopAck(); return; }
          if (this.disposed) return;
          if (data.ready) { slot.ready = true; this.pump(); return; }
          if (data.error) { this.fail(Object.assign(new Error(data.error.message), { name: data.error.name })); return; }
          const task = slot.active;
          if (!task || task.id !== data.id) { this.fail(new Error('secondary worker protocol mismatch')); return; }
          slot.active = null; task.resolve(data.value); this.pump();
        };
        if (isNode) {
          worker.on('message', receive); worker.on('error', error => this.fail(error));
          worker.on('exit', code => { slot.stopAck(); if (!this.disposed) this.fail(new Error(`secondary worker exited: ${code}`)); });
        } else {
          worker.onmessage = event => receive(event.data);
          worker.onerror = event => { event.preventDefault?.(); this.fail(new Error(event.message || 'secondary worker failed')); };
          worker.onmessageerror = () => this.fail(new Error('secondary worker message decode failed'));
        }
        worker.postMessage({ module });
      }
    })().catch(error => this.fail(error));
  }
  pump() {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (!slot.ready || slot.active || !this.queue.length) continue;
      const task = this.queue.shift(); slot.active = task;
      const { offsets, ids, qualities } = task.payload;
      try { slot.worker.postMessage({ id: task.id, payload: task.payload }, [offsets.buffer, ids.buffer, qualities.buffer]); }
      catch (error) { this.fail(error); return; }
    }
  }
  fail(error) { if (!this.error) this.error = error; void this.dispose(error); }
  async dispose(reason = new Error('secondary request ended')) {
    if (this.disposed) return this.termination;
    this.disposed = true;
    for (const task of this.queue.splice(0)) task.reject(reason);
    for (const slot of this.slots) if (slot.active) { slot.active.reject(reason); slot.active = null; }
    this.termination = Promise.allSettled(this.slots.map(async slot => {
      let timer;
      try {
        slot.worker.postMessage({ stop: true });
        await Promise.race([slot.stopped, new Promise(resolve => { timer = setTimeout(resolve, 1500); })]);
      } finally { clearTimeout(timer); await slot.worker.terminate(); }
    }));
    await this.termination;
  }
}

export async function withSecondaryPool(size, callback, { signal = null } = {}) {
  signal?.throwIfAborted();
  const onlyHeavy = size === 'auto';
  if (onlyHeavy) size = 2;
  if (!Number.isInteger(size) || size < 0 || size > 4) throw new RangeError('secondaryWorkers must be auto or an integer in 0..4');
  if (!size) return callback(null);
  const pool = new ExactSecondaryPool(size);
  const abort = () => { void pool.dispose(signal.reason ?? new Error('secondary request cancelled')); };
  signal?.addEventListener('abort', abort, { once: true });
  const dispatch = (prepared, context) => pool.submit(prepared, context);
  dispatch.onlyHeavy = onlyHeavy;
  try { return await callback(dispatch); }
  finally { signal?.removeEventListener('abort', abort); await pool.dispose(); }
}
