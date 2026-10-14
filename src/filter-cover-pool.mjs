import { compiledCoverModule } from './exact-secondary-pool.mjs';
import { packFilterTask } from './filter-cover-task.mjs';

// Two slots reserve two solver tokens each, even for Auto: ORTools stays at 2,
// Rust/HiGHS at 1. Never compose this pool with the secondary-only pool.
export class FilterCoverPool {
  constructor({ signal = null } = {}) {
    this.size = 2; this.queue = []; this.slots = []; this.nextId = 1;
    this.disposed = false; this.error = null; this.starting = null; this.metrics = [];
    this.signal = signal;
    this.abort = () => this.fail(signal.reason ?? new Error('filter request aborted'));
    signal?.addEventListener('abort', this.abort, { once: true });
    if (signal?.aborted) this.abort();
  }
  submit(coverage, qualityFor, options = {}) {
    if (this.disposed) throw this.error ?? new Error('filter pool is disposed');
    // A per-save request has at most seven pending filter jobs.
    if (this.queue.length + this.slots.filter(slot => slot.active).length >= 7) {
      throw new RangeError('filter request exceeds seven outstanding jobs');
    }
    const id = this.nextId++, enqueued = performance.now();
    const promise = new Promise((resolve, reject) => this.queue.push({ id, coverage, qualityFor, options, enqueued, resolve, reject }));
    promise.catch(() => {});
    this.start(); this.pump(); return promise;
  }
  start() {
    if (this.starting || this.disposed) return;
    this.starting = (async () => {
      const module = await compiledCoverModule();
      const isNode = typeof process !== 'undefined' && !!process.versions?.node;
      const name = 'node:worker_threads';
      const NodeWorker = isNode ? (await import(/* @vite-ignore */ name)).Worker : null;
      if (this.disposed) return;
      for (let index = 0; index < this.size; index++) {
        const worker = isNode ? new NodeWorker(new URL('./filter-cover.worker.mjs', import.meta.url))
          : new Worker(new URL('./filter-cover.worker.mjs', import.meta.url), { type: 'module' });
        const slot = { worker, ready: false, active: null, started: performance.now() };
        slot.stopped = new Promise(resolve => { slot.stopAck = resolve; });
        this.slots.push(slot);
        const receive = data => {
          if (data.stopped) { slot.stopAck(); return; }
          if (this.disposed) return;
          if (data.ready) { slot.ready = true; slot.initMs = performance.now() - slot.started; this.pump(); return; }
          if (!slot.active || data.id !== slot.active.id) { this.fail(new Error('filter worker protocol mismatch')); return; }
          if (data.error) { this.fail(Object.assign(new Error(data.error.message), { name: data.error.name })); return; }
          const job = slot.active; slot.active = null;
          this.metrics.push({ id: job.id, ...data.metrics, transferBytes: job.transferBytes, initMs: slot.initMs,
            queueMs: job.started - job.enqueued, elapsedMs: performance.now() - job.enqueued });
          job.resolve(data.value); this.pump();
        };
        if (isNode) {
          worker.on('message', receive); worker.on('error', error => this.fail(error));
          worker.on('exit', code => { slot.stopAck(); if (!this.disposed) this.fail(new Error(`filter worker exited: ${code}`)); });
        } else {
          worker.onmessage = event => receive(event.data);
          worker.onerror = event => { event.preventDefault?.(); this.fail(new Error(event.message || 'filter worker failed')); };
          worker.onmessageerror = () => this.fail(new Error('filter worker message decode failed'));
        }
        worker.postMessage({ module });
      }
    })().catch(error => this.fail(error));
  }
  pump() {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (!slot.ready || slot.active || !this.queue.length) continue;
      const job = this.queue.shift(); slot.active = job;
      try {
        const payload = packFilterTask(job.coverage, job.qualityFor, job.options);
        const buffers = [payload.offsets.buffer, payload.ids.buffer, ...(payload.qualities ? [payload.qualities.buffer] : [])];
        job.transferBytes = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        job.started = performance.now();
        slot.worker.postMessage({ id: job.id, payload }, buffers);
      } catch (error) { this.fail(error); return; }
    }
  }
  fail(error) { this.error ??= error; void this.dispose(error); }
  async dispose(reason = new Error('filter request ended')) {
    if (this.disposed) return this.termination;
    this.disposed = true;
    this.signal?.removeEventListener('abort', this.abort);
    for (const job of this.queue.splice(0)) job.reject(reason);
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

export async function withFilterCoverPool(options, callback) {
  const pool = new FilterCoverPool(options);
  try { return await callback((coverage, qualityFor, settings) => pool.submit(coverage, qualityFor, settings), pool); }
  finally { await pool.dispose(); }
}
