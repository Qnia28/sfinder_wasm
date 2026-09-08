import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCover,calculateCoverCount} from '../src/batch-cover-feature.mjs';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {findCongruentSolutions} from '../src/batch-setup.mjs';
import {expandPattern} from '../src/pattern.mjs';
import {modes,fumen,oSix} from './batch-fixtures.mjs';

for(const mode of modes) test(`compressed frontier exact fallback: ${mode}`,async()=>{
 const e=await loadBatchWasm();
 assert.equal(typeof e.batch_engine_set_frontier_budget,'function','rebuild WASM before testing');
 for(const useHold of [false,true]){
  const input={sourceFumen:fumen(Array(4).fill('XXXXXXXXXI')),pattern:'I;O;I',mode,useHold,mirror:'yes',outputMode:'coverage'};
  const fast=await calculateCover(input);
  e.batch_engine_set_frontier_budget(0);
  try {assert.deepEqual(await calculateCover(input),fast);assert.equal(e.batch_engine_frontier_fallback(),1);}
  finally {e.batch_engine_set_frontier_budget(200000);}
 }
});

test('frontier budget exhausted partway through a graph remains exact',async()=>{
 const e=await loadBatchWasm(),input={sourceFumen:oSix,pattern:'OOOOOO;IOOOOOO;OOOOOO',mirror:'yes',outputMode:'coverage'};
 // Pattern branches must have a common length.
 input.pattern='OOOOOOO;IOOOOOO;OOOOOOO';
 const fast=await calculateCover(input);
 e.batch_engine_set_frontier_budget(3);
 try {assert.deepEqual(await calculateCover(input),fast);assert.equal(e.batch_engine_frontier_fallback(),1);}
 finally {e.batch_engine_set_frontier_budget(200000);}
});

for(const height of [5,6]) test(`tall congruent Rust/JS solution and order sets ${height}`,async()=>{
 const e=await loadBatchWasm();assert.equal(e.batch_congruent_max_height(),6);
 for(const physics of ['jstris','tetrio'])for(const useHold of [false,true]){
  const backend=new BatchReachability(e,height,physics);
  const legacyExports={...e};delete legacyExports.batch_congruent_max_height;
  const fallback=new BatchReachability(legacyExports,height,physics);
  assert.equal(fallback.congruent({}),null);
  const fills=[15n|(15n<<10n)|(15n<<20n),3n|(3n<<10n)|(3n<<20n)|(3n<<30n)];
  if(height===6)fills.push(3n|(3n<<10n)|(3n<<20n)|(3n<<30n)|(3n<<40n)|(3n<<50n));
  for(const fill of fills){
   const args={base:0n,fill,height,queues:expandPattern('*p4;OOOO'),useHold};
   const normalize=xs=>xs.map(s=>({key:s.key,orders:[...s.orders].sort()})).sort((a,b)=>a.key.localeCompare(b.key));
   assert.deepEqual(normalize(findCongruentSolutions({...args,reachability:backend})),normalize(findCongruentSolutions({...args,reachability:fallback})));
  }
 }
});

test('six rows and twelve operations use the Rust congruent path',async()=>{
 const backend=new BatchReachability(await loadBatchWasm(),6,'tetrio');
 let fill=0n;for(let y=0;y<6;y++)fill|=255n<<BigInt(y*10);
 const solutions=backend.congruent({fill,queues:['O'.repeat(12)]});
 assert.equal(solutions.length,1);assert.equal(solutions[0].operations.length,12);
 assert.deepEqual(solutions[0].orders,['O'.repeat(12)]);
});

for(const useHold of [false,true])test(`count equals expanded cases with chunking, Hold=${useHold}`,async()=>{
 const sourceFumen=fumen(['OO........','OO........']);
 for(const pattern of ['*p3','*p3;*p3','[IOT]p3{I<T}','[^SZ]p3','IOO;OIO;III']){
  const input={sourceFumen,pattern,useHold,mirror:'yes'};
  const full=await calculateCover({...input,outputMode:'coverage'});
  for(const maxBatchPrefixes of [1,17,65536]){
   const count=await calculateCoverCount({...input,maxBatchPrefixes});
   assert.equal(count.total,full.total);assert.equal(count.covered,full.covered);assert.equal(count.failed,full.failed);
   assert.deepEqual(count.targets.map(t=>t.coverage),full.targets.map(t=>t.coverage));
   assert.ok(!('failedQueues' in count));assert.ok(!('covered' in count.targets[0]));
  }
 }
});

test('count evaluates huge suffixes with exact multiplicity and mirror union',async()=>{
 const sourceFumen=fumen(['OO........','OO........']);
 const count=await calculateCover({sourceFumen,pattern:'*!,*!',mirror:'yes',outputMode:'count'});
 assert.equal(count.total,25401600);assert.equal(count.covered,7257600);assert.equal(count.evaluatedPrefixes,42);
 assert.equal(count.targets[0].coverage,count.covered);assert.equal(count.targets[1].coverage,count.covered);
 const pattern=Array(5).fill('*!').join(',');
 const huge=await calculateCoverCount({sourceFumen,pattern});
 const total=5040n**5n;
 assert.equal(huge.totalExact,total.toString());assert.equal(huge.coveredExact,(total*2n/7n).toString());
 assert.equal(typeof huge.total,'string');
 await assert.rejects(calculateCoverCount({sourceFumen,pattern:'O',maxBatchPrefixes:0}),RangeError);
});

test('frontier compression preserves mode-sensitive multi-order targets',async()=>{
 const backend=new BatchReachability(await loadBatchWasm(),4,'jstris');
 let fill=0n,base=0n;for(let y=0;y<4;y++){fill|=15n<<BigInt(y*10);base|=1008n<<BigInt(y*10);}
 const queues=expandPattern('*p4'),cases=queues.map((queue,i)=>({queue,caseId:String(i)}));
 const solutions=backend.congruent({base,fill,queues});
 assert.ok(solutions.length>0);
 for(const solution of solutions.slice(0,8))for(const mode of modes)for(const useHold of [false,true]){
  const args={base,operations:solution.operations,cases,mode,useHold};
  assert.deepEqual(backend.coverTarget({...args,coverageOnly:true}).covered,backend.coverTarget(args).covered);
 }
});

test('existing batch worker dispatch accepts Cover count input',async()=>{
 const {runBatchWorkerRequest}=await import('../src/batch-worker-runtime.mjs');
 const input={sourceFumen:fumen(['OO........','OO........']),pattern:'*!,*!',outputMode:'count'};
 assert.deepEqual(await runBatchWorkerRequest({kind:'cover',input}),await calculateCover(input));
});
