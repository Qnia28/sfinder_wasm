import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmSolver} from '../src/wasm-backend.mjs';

test('4-line LGB2 legal pack has locked counts, compact stage-7 storage, and late-game oracles',async()=>{
  const solver=await createWasmSolver(4);
  try{
    assert.equal(solver.legalPackVersion(),2);
    assert.deepEqual([7,8,9,10].map(stage=>solver.legalCount(stage)),[2015406,24748,100,1]);
    assert.equal(solver.stage8OracleEntries(),24748*7);
    assert.equal(solver.stage9OracleEntries(),100*7);
    assert.ok(solver.legalMemoryBytes()<7_000_000,`expected <7 MB legal lookup storage, got ${solver.legalMemoryBytes()}`);
  }finally{solver.close()}
});
