import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmSolver} from '../src/wasm-backend.mjs';

const BOARD=0x3c0f03c0fn;
const QUEUE='OJILSZT';

// BOX 4P fixture with enough alternative PCs to exercise exact per-save ranking.
test('WASM single-queue per-save fast path matches full exact quality and stable-key ranking',async()=>{
  const solver=await createWasmSolver(4);
  try{
    const all=solver.enumeratePc(BOARD,QUEUE,true);
    assert.equal(all.length,44);

    const grouped=new Map();
    for(const solution of all){
      const saved=solution.masks.findIndex(mask=>mask===0n);
      assert.ok(saved>=0);
      let rows=grouped.get(saved);
      if(!rows){rows=[];grouped.set(saved,rows)}
      rows.push(solution);
    }

    const direct=solver.perSaveBest(BOARD,QUEUE,true,{candidateLimit:16});
    assert.deepEqual(direct.map(x=>x.saved),[0,3,4,5,6]);
    assert.deepEqual(direct.map(x=>x.orderCount),[1,1,4,7,13]);

    for(const selected of direct){
      const candidates=grouped.get(selected.saved);
      const expected=[...candidates].sort((a,b)=>
        b.orderCount-a.orderCount||a.key.localeCompare(b.key))[0];
      assert.equal(selected.orderCount,expected.orderCount);
      assert.equal(selected.key,expected.key);
    }

    const tricky='OZILJST';
    const trickyAll=solver.enumeratePc(BOARD,tricky,true);
    const expectedS=trickyAll
      .filter(x=>x.saved===5)
      .sort((a,b)=>b.orderCount-a.orderCount||a.key.localeCompare(b.key))[0];
    const directS=solver.perSaveBest(BOARD,tricky,true,{candidateLimit:16})
      .find(x=>x.saved===5);
    assert.equal(expectedS.orderCount,5);
    assert.equal(directS.orderCount,expectedS.orderCount);
    assert.equal(directS.key,expectedS.key);
  }finally{
    solver.close();
  }
});
