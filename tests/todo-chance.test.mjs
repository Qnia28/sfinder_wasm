import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateChance,calculateChanceCount} from '../src/chance-feature.mjs';
import {expandPattern} from '../src/pattern.mjs';
import {createPatternPrefixSource} from '../src/pattern-prefix-source.mjs';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {solveQueuesExistence} from '../src/pc-enumeration-engine.mjs';
import {decodeAndValidate} from '../src/pc-input.mjs';
const sourceFumen='v115@+gI8AeI8AeI8AeI8JeAgH';

test('prefix completions retain complete constrained/duplicate branch order',()=>{
 for(const pattern of ['I,[IOT]p2;I,[IOT]p2','[IOT]p2,I','[IOT]p3{I<T}','*p3']){
  for(const take of [0,1,2,4]){
   const source=createPatternPrefixSource(pattern,take);
   assert.deepEqual([...source.prefixes()].flatMap(p=>[...p.completions()].map(x=>x.queue)),expandPattern(pattern));
  }
 }
});
test('Chance queues/count agree with concrete full-queue oracle and preserve expansion limit',async()=>{
 const solver=await createWasmSolver(4),{board}=decodeAndValidate(sourceFumen,4);
 try{
  for(const pattern of ['I,*p4','*p3','[IOT]p3;[IOT]p3','[IOT]p3{I<T}','T,*p3'])for(const useHold of [false,true]){
   const queues=expandPattern(pattern),solved=solveQueuesExistence({board,queues,solver,useHold});
   const expected=queues.filter((_,i)=>!solved[i]);
   const input={sourceFumen,pattern,useHold,solver};
   const actual=calculateChance(input);
   assert.deepEqual(actual.failedQueues,expected);assert.equal(actual.total,queues.length);
   const count=calculateChanceCount({...input,maxBatchPrefixes:2});
   assert.equal(count.failed,expected.length);assert.equal(count.success,actual.success);
  }
  assert.throws(()=>calculateChance({sourceFumen,pattern:'*!,*!',solver}),{name:'PatternExpansionError'});
 }finally{solver.close()}
});
test('probability request cache reuses immutable geometry across batches and releases on error/exit',async()=>{
 const solver=await createWasmSolver(4),{board}=decodeAndValidate(sourceFumen,4);
 try{
  const reference=solver.canPcPatternMany(board,['IT','TI'],true);
  solver.withProbabilitySession(()=>{
   assert.deepEqual(solver.canPcPatternMany(board,['IT','TI'],true),reference);
   assert.ok(solver.probabilityStats().requestDagBytes>0);
   assert.deepEqual(solver.canPcPatternMany(board,['TI','IT'],true),[...reference].reverse());
   assert.equal(solver.probabilityStats().requestDagHits,1);
   solver.withProbabilitySession(()=>solver.canPcPatternMany(board,['IT'],true));
   assert.ok(solver.probabilityStats().requestDagBytes>0);
  });
  assert.equal(solver.probabilityStats().requestDagBytes,0);
  assert.throws(()=>solver.withProbabilitySession(()=>{solver.canPcPatternMany(board,['IT'],true);throw new Error('stop')}),/stop/);
  assert.equal(solver.probabilityStats().requestDagBytes,0);
  assert.deepEqual(solver.canPcPatternMany(board,['IT','TI'],true),reference);
 }finally{solver.close()}
});
