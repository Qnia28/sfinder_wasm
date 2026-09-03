import test from'node:test';
import assert from'node:assert/strict';
import{decoder}from'tetris-fumen';
import{fieldMasks}from'../src/batch-geometry.mjs';
import{expandPattern}from'../src/pattern.mjs';
import{createWasmSolver}from'../src/wasm-backend.mjs';

test('batched canPc matches independent single-queue calls across *p7',async()=>{
 const page=decoder.decode('v115@9gRpHeRpHeilGeglzhOeAgH')[0],{base,fill}=fieldMasks(page,4),board=base|fill,queues=expandPattern('*p7');
 const batched=await createWasmSolver(4),single=await createWasmSolver(4);
 try{
  assert.deepEqual(batched.canPcMany(board,queues,true),queues.map(q=>single.canPc(board,q,true)));
  const noHold=queues.slice(0,256);
  assert.deepEqual(batched.canPcMany(board,noHold,false),noHold.map(q=>single.canPc(board,q,false)));
 }finally{batched.close();single.close()}
});

test('scalar canPcMany and enumeratePcMany preserve duplicate queue multiplicity',async()=>{
 const page=decoder.decode('v115@9gRpHeRpHeilGeglzhOeAgH')[0],{base,fill}=fieldMasks(page,4),board=base|fill,solver=await createWasmSolver(4);
 try{
  const queues=['TILJS','TILJS','OOOOO','TILJS'];
  const can=solver.canPcMany(board,queues,true);
  assert.equal(can.length,queues.length);
  assert.equal(can[0],can[1]);assert.equal(can[0],can[3]);
  const rows=solver.enumeratePcMany(board,queues,true);
  assert.equal(rows.length,queues.length);
  assert.deepEqual(rows[0],rows[1]);assert.deepEqual(rows[0],rows[3]);
 }finally{solver.close()}
});
