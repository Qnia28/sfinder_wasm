import test from 'node:test';import assert from 'node:assert/strict';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {expandPattern} from '../src/pattern.mjs';
const bit=(x,y)=>1n<<BigInt(y*10+x);
test('indexed tiling and suffix engines preserve 5/6-piece broad results with both Hold settings',async()=>{
 const e=await loadBatchWasm(),r=new BatchReachability(e,4,'tetrio');
 try{for(const n of [5,6])for(const useHold of [false,true]){
  const fill=Array.from({length:4},(_,y)=>((1n<<BigInt(n))-1n)<<BigInt(10*y)).reduce((a,b)=>a|b),queues=expandPattern(`*p${n}`);
  e.batch_congruent_set_engines(1,2,200000);const expected=r.congruent({fill,queues,useHold});assert.ok(expected.length);
  for(const order of [2,3,4]){e.batch_congruent_set_engines(2,order,200000);assert.deepEqual(r.congruent({fill,queues,useHold}),expected);}
 }}finally{e.batch_congruent_set_engines(0,0,200000)}
});
test('15 operations use six active rows and preserve original duplicate queue coverage',async()=>{
 const r=new BatchReachability(await loadBatchWasm(),6),operations=[];
 for(let y=0;y<6;y+=2)for(let x=0;x<10;x+=2)operations.push({piece:'O',mask:bit(x,y)|bit(x+1,y)|bit(x,y+1)|bit(x+1,y+1)});
 const cases=['O'.repeat(15),'I'+'O'.repeat(15),'O'.repeat(14),'O'.repeat(15),''];
 for(const useHold of [false,true])assert.deepEqual(r.coverTarget({base:0n,operations,cases,useHold,coverageOnly:true}).covered,[true,useHold,false,true,false]);
});
test('large six-line best and per-save best preserve exact winners and forced-budget fallback',async()=>{
 const s=await createWasmSolver(6),queue='O'.repeat(15);
 try{for(const useHold of [false,true]){
  s.e.solver_set_best_engine(s.ptr,2,200000);const best=s.bestPc(0n,queue,useHold),per=s.perSaveBest(0n,queue,useHold);
  for(const budget of [200000,0,2]){s.e.solver_set_best_engine(s.ptr,1,budget);assert.deepEqual(s.bestPc(0n,queue,useHold),best);assert.deepEqual(s.perSaveBest(0n,queue,useHold),per);}
 }}finally{s.close()}
});
