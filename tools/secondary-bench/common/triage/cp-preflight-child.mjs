// Short synthetic functionality check, never a population performance sample.
import assert from 'node:assert/strict';
import { startSecondaryEngine } from '../../../../src/secondary-engine-runner.mjs';
import { assertORToolsSupported } from '../../../../src/ortools-min-cover.mjs';

const send = record => new Promise((resolve, reject) => process.send(record, e => e ? reject(e) : resolve()));
process.once('message', async () => {
  let engine, record;
  try {
    assert.equal(process.platform, 'linux'); assertORToolsSupported();
    const payload = { keys: ['a','b','c'], offsets: new Uint32Array([0,3]),
      ids: new Uint32Array([0,1,2]), qualities: new Uint32Array([1,2,2]), count: 1, seedKeys: ['a'] };
    // The outer synthetic scope is bounded; exercise the unlimited product path.
    engine = startSecondaryEngine('cpsat', payload, { limitMs: null });
    const result = await engine.promise;
    assert.equal(result.completed, true); assert.equal(result.qualityComplete, true); assert.equal(result.tieComplete, true);
    assert.deepEqual(result.keys, ['b']); assert.deepEqual(result.qualityVector, [2]);
    await engine.stop();
    record = { status: 'EXACT', cpPreflight: 'PASS', qualityComplete: true, tieComplete: true,
      result, synthetic: true, populationCalls: 0, cpSolverCalls: 1, node: process.version };
  } catch (error) { record = { status: 'ERROR', cpPreflight: 'FAIL', error: error.message }; }
  finally { await engine?.stop(); }
  await send({ event: 'result', record }); process.disconnect();
});
await send({ event: 'ready' });
