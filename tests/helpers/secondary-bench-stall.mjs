import { Worker } from 'node:worker_threads';
process.send({ event: 'ready' });
process.once('message', ({ job }) => {
  if (job.mode === 'busy') {
    const worker = new Worker('while (true) {}', { eval: true });
    process.send({ event: 'nested-worker', threadId: worker.threadId });
    while (true) {} // Parent timeout must still fire and reclaim nested worker.
  }
  if (job.mode === 'phase-stall') {
    process.send({ event: 'phase', name: 'enumeration' });
    while (true) {}
  }
  if (job.mode === 'cleanup-stall') {
    process.send({ event: 'result', record: { status: 'EXACT', responseMs: 1 } });
    setInterval(() => {}, 1000);
    return;
  }
  process.send({ event: 'result', record: { status: 'EXACT', responseMs: 1 } }, () => process.disconnect());
});
