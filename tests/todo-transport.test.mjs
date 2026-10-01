import test from 'node:test';
import assert from 'node:assert/strict';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';

const op={piece:'O',mask:3n|(3n<<10n)};
const counts={};
const original=await loadBatchWasm();
const e=Object.fromEntries(Object.entries(original).map(([key,value])=>[key,typeof value==='function'? (...args)=>{counts[key]=(counts[key]??0)+1;return value(...args)}:value]));
const r=new BatchReachability(e,4);
const cases=['OI','II','OI','TT','OI'];
const cover=(reach=r,queues=cases)=>reach.coverTarget({operations:[op],cases:queues,coverageOnly:true});

test('one staging per session, exact duplicate remap and sparse/dense coverage',()=>{
 counts.batch_engine_add_queue=0;
 r.withSession(()=>{
  for(let i=0;i<8;i++)assert.deepEqual(cover().covered,[true,false,true,false,true]);
  assert.equal(counts.batch_engine_add_queue,3);
  const sparse=Array.from({length:64},(_,i)=>i===0?'O':'I'+i.toString(2).replaceAll('0','I').replaceAll('1','T'));
  assert.deepEqual(cover(r,sparse).covered,sparse.map((_,i)=>i===0));
  assert.ok(counts.batch_engine_covered_indices_ptr>0);
 });
});
test('handles reject reset, mutation and ended lifetime; wrappers recover after interleaving/errors',()=>{
 let expired;
 r.withSession(()=>{
  cover();expired=e.batch_engine_queue_handle();
  assert.equal(e.batch_engine_reset_with_queues(expired),1);
  e.batch_engine_reset();assert.equal(e.batch_engine_reset_with_queues(expired),0);
  assert.deepEqual(cover().covered,[true,false,true,false,true]);
  new BatchReachability(original,2).withSession(()=>cover(new BatchReachability(original,2),['II']));
  assert.deepEqual(cover().covered,[true,false,true,false,true]);
  assert.throws(()=>cover(r,['?']),/bad piece/);
  assert.deepEqual(cover().covered,[true,false,true,false,true]);
  const mutable=['II'];assert.deepEqual(cover(r,mutable).covered,[false]);mutable[0]='OO';assert.deepEqual(cover(r,mutable).covered,[true]);
  expired=e.batch_engine_queue_handle();
 });
 assert.equal(e.batch_engine_reset_with_queues(expired),0);
 assert.throws(()=>r.withSession(()=>{cover();throw new Error('stop')}),/stop/);
 r.withSession(()=>assert.deepEqual(cover().covered,[true,false,true,false,true]));
});
test('bulk congruent matches getter fallback, survives growth and subsequent calls',()=>{
 const args={fill:op.mask|(op.mask<<2n),queues:['OOI','IOO'],useHold:true};
 const result=r.congruent(args);
 const getterExports={...original,batch_congruent_words_ptr:undefined};
 const fallback=new BatchReachability(getterExports,4).congruent(args);
 assert.deepEqual(result,fallback);assert.ok(result.length>0);
 assert.equal(counts.batch_congruent_operation_piece??0,0);
 const saved=structuredClone(result);original.memory.grow(2);cover();assert.deepEqual(result,saved);
});
