// Short synthetic functionality check, never a population performance sample.
import assert from 'node:assert/strict';
import { startSecondaryEngine } from '../../../../src/secondary-engine-runner.mjs';
import { assertORToolsSupported } from '../../../../src/ortools-min-cover.mjs';

const send = record => new Promise((resolve, reject) => process.send(record, e => e ? reject(e) : resolve()));
process.once('message', async ({job}) => {
  let engine, record;
  try {
    assert.equal(process.platform, 'linux'); assertORToolsSupported();
    const compact=job.compactCpTest===true;
    const payload = compact ? {keys:['a','b','c','d'],offsets:new Uint32Array([0,4,8,12,16]),
      ids:new Uint32Array([0,1,2,3,0,1,2,3,0,1,2,3,0,1,2,3]),
      qualities:new Uint32Array([1,6,6,3,1,6,6,3,6,5,5,2,4,2,2,4]),count:1,seedKeys:['a']} : { keys: ['a','b','c'], offsets: new Uint32Array([0,3]),
      ids: new Uint32Array([0,1,2]), qualities: new Uint32Array([1,2,2]), count: 1, seedKeys: ['a'] };
    // The outer synthetic scope is bounded; exercise the unlimited product path.
    engine = startSecondaryEngine('cpsat', payload, { limitMs: null });
    const result = await engine.promise;
    assert.equal(result.completed, true); assert.equal(result.qualityComplete, true); assert.equal(result.tieComplete, true);
    assert.deepEqual(result.keys, ['b']); assert.deepEqual(result.qualityVector, compact?[2,5,6,6]:[2]);
    if(compact)assert.equal(result.stages.filter(s=>s.phase==='quality').length,2);
    await engine.stop();
    record = { status: 'EXACT', cpPreflight: 'PASS', qualityComplete: true, tieComplete: true,
      result, synthetic: true,...(compact?{syntheticCase:'COMPACT_OR_MULTIBATCH_WEIGHTED_TIE'}:{}),populationCalls: 0, cpSolverCalls: 1, node: process.version };
  } catch (error) { record = { status: 'ERROR', cpPreflight: 'FAIL', error: error.message }; }
  finally { await engine?.stop(); }
  await send({ event: 'result', record }); process.disconnect();
});
await send({ event: 'ready' });
