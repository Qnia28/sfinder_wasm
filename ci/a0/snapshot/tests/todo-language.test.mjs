import test from 'node:test';
import assert from 'node:assert/strict';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {decodeAndValidate} from '../src/pc-input.mjs';
import {expandPattern} from '../src/pattern.mjs';
const normalize=rows=>rows.map(r=>({masks:r.operations.reduce((m,op)=>{m[op.piece]=(m[op.piece]??0n)|op.mask;return m},{}),orders:r.orders}));
test('all Congruent order and tiling engines preserve exact geometry and distinct order sets',async()=>{
 const e=await loadBatchWasm(),r=new BatchReachability(e,4,'tetrio');
 const fills=[3n|(3n<<10n),15n|(15n<<10n)|(15n<<20n),15n|(15n<<10n)|(15n<<20n)|(15n<<30n),
  3n|(3n<<10n)|(3n<<6n)|(3n<<16n), // disconnected 4+4 components
  7n|(1n<<20n)]; // impossible component areas
 try{
  for(const fill of fills)for(const useHold of [false,true]){
   const n=fill.toString(2).replaceAll('0','').length/4;
   const queues=expandPattern(`*p${n}`);
   e.batch_congruent_set_engines(1,2,200000);
   const expected=normalize(r.congruent({fill,queues,useHold}));
   for(const tiling of [1,2])for(const orders of [1,2,3,4]){
    e.batch_congruent_set_engines(tiling,orders,200000);
    assert.deepEqual(normalize(r.congruent({fill,queues,useHold})),expected,`${fill} ${tiling} ${orders}`);
   }
   for(const budget of [0,2]){
    e.batch_congruent_set_engines(2,4,budget);
    assert.deepEqual(normalize(r.congruent({fill,queues,useHold})),expected);
    if(expected.length)assert.equal(e.batch_congruent_order_fallback(),1);
   }
  }
 }finally{e.batch_congruent_set_engines(0,0,200000)}
});
test('exact preferred solutions and per-save winners match full order sets, including forced fallback',async()=>{
 const fixtures=[
  [4,'v115@+gI8AeI8AeI8AeI8JeAgH','IT'],
  [4,'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH','TILJSZO'],
  [5,'v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH','TOILJSZ'],
 ];
 for(const [height,source,queue] of fixtures){
  const solver=await createWasmSolver(height),{board}=decodeAndValidate(source,height);
  try{
   for(const hold of [false,true]){
    solver.e.solver_set_best_engine(solver.ptr,2,200000);
    const best=solver.bestPc(board,queue,hold),per=solver.perSaveBest(board,queue,hold);
    for(const budget of [200000,0,2]){
     solver.e.solver_set_best_engine(solver.ptr,1,budget);
     assert.deepEqual(solver.bestPc(board,queue,hold),best);
     assert.deepEqual(solver.perSaveBest(board,queue,hold),per);
     if(best&&budget===0)assert.equal(solver.e.solver_best_language_stat(solver.ptr,1),1);
    }
   }
  }finally{solver.close()}
 }
});
