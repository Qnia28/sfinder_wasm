import assert from 'node:assert/strict';
import { createWasmSolver } from '../../src/wasm-backend.mjs';
import { minimumCoverAsync } from '../../src/min-cover-adaptive.mjs';
import { prepareFastFixture, runFastFixedK, ARMS } from './adapter.mjs';

const send = message => new Promise((resolve, reject) => process.send(message, e => e ? reject(e) : resolve()));
process.once('message', async ({ job }) => {
  let solver;
  try {
    if (job.mode === 'watchdog') { for (;;) { /* synchronous unresponsive child */ } }
    solver = await createWasmSolver(4, { legal: false });
    const f = job.fixture;
    if (job.mode === 'product-parity') {
      const coverage = new Map(f.rows.map((row, i) => [i, new Set(row.map(([id]) => f.keys[id]))]));
      const qualityFor = (key, row) => f.rows[row].find(([id]) => f.keys[id] === key)[1];
      const primary = await minimumCoverAsync(coverage, { solver, primary: 'rust', qualityFor: null });
      assert.equal(primary.count, f.K);
      f.seed = primary.keys.map(k => f.keys.indexOf(k));
      const context = prepareFastFixture(f, solver);
      const actual = await minimumCoverAsync(coverage, { solver, qualityFor, primary: 'rust',
        exactQuality: job.arm === 'DIRECT' ? '2x2' : 'fast',
        fastStateBudget: ARMS[job.arm][0] });
      const experiment = runFastFixedK(context, solver, job.arm);
      assert.deepEqual(experiment.keys, actual.keys);
      assert.deepEqual(experiment.qualityVector, actual.qualityVector);
      assert.equal(experiment.qualityExact, actual.qualityExact);
      await send({ event: 'result', record: { status: 'PARITY_PASS', actual, experiment, fixture: f } });
    } else {
      const context = prepareFastFixture(f, solver);
      const result = runFastFixedK(context, solver, job.arm, { trace: job.trace });
      await send({ event: 'result', record: { ...result, fixture: f } });
    }
  } catch (error) {
    await send({ event: 'result', record: { status: 'ERROR', error: error.stack } });
    process.exitCode = 1;
  } finally { solver?.close(); process.disconnect(); }
});
await send({ event: 'ready' });
