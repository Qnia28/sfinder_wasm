import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {decodeAndValidate} from '../src/pc-input.mjs';
test('PATH queue-state budget exhaustion retries full exact enumeration',async()=>{
 const solver=await createWasmSolver(4),{board}=decodeAndValidate('v115@+gI8AeI8AeI8AeI8JeAgH',4);
 try{
  const expected=solver.enumeratePcPath(board,['IT','TI','TT','IT'],true);
  for(const budget of [0,2]){
   solver.e.solver_set_geometry_budget(solver.ptr,budget);
   assert.deepEqual(solver.enumeratePcPath(board,['IT','TI','TT','IT'],true),expected);
   assert.equal(solver.e.solver_geometry_fallback(solver.ptr),1);
  }
  solver.e.solver_set_geometry_budget(solver.ptr,200000);
  assert.deepEqual(solver.enumeratePcPath(board,['IT','TI','TT','IT'],true),expected);
  assert.equal(solver.e.solver_geometry_fallback(solver.ptr),0);
 }finally{solver.close()}
});
test('PC completion rejection cannot replace general batch exact-lock reachability',async()=>{
 const solver=await createWasmSolver(4),e=await loadBatchWasm();
 try{
  assert.equal(solver.canPc(0n,'O',false),false);
  for(const physics of ['jstris','tetrio']){
   const reachability=new BatchReachability(e,4,physics);
   const result=reachability.coverTarget({base:0n,operations:[{piece:'O',mask:3n|(3n<<10n)}],cases:['O'],useHold:false,coverageOnly:true});
   assert.deepEqual(result.covered,[true]);
  }
 }finally{solver.close()}
});
