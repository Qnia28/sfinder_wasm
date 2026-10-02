import test from 'node:test';
import assert from 'node:assert/strict';
import {Field,encoder} from 'tetris-fumen';
import {BatchReachability,loadBatchWasm} from '../src/batch-backend.mjs';
import {findCongruentSolutions,enumerateTilings} from '../src/batch-setup.mjs';
import {calculateCongruentCover} from '../src/batch-congruent-feature.mjs';
import {calculateCoverPercent} from '../src/batch-cover-percent-feature.mjs';
import {expandPattern} from '../src/pattern.mjs';
const fumen=rows=>encoder.encode([{field:Field.create(rows.join(''))}]);
const oneO=fumen(['OO________','OO________']);
test('accepted-solution limit agrees across Rust/JS at exact boundary and exhaustion',async()=>{
 const r=new BatchReachability(await loadBatchWasm(),4,'tetrio');
 const js={placeExact:r.placeExact.bind(r),tSpinKind:r.tSpinKind.bind(r)};
 const base={base:0n,fill:3n|(3n<<10n),queues:['O'],height:4,maxSolutions:1};
 for(const reachability of [r,js]){
  assert.equal(findCongruentSolutions({...base,reachability}).length,1);
  assert.throws(()=>findCongruentSolutions({...base,reachability,fill:15n|(15n<<10n)|(15n<<20n),queues:expandPattern('*p3')}),{name:'CongruentLimitError',limit:1,unit:'accepted-solutions',exhausted:true});
  assert.throws(()=>findCongruentSolutions({...base,reachability,maxSolutions:0}),RangeError);
 }
 assert.equal(enumerateTilings({fill:base.fill,maxSolutions:1}).length,1);
});
test('congruent-cover explicit coverage/count retain exact union and default output',async()=>{
 for(const useHold of [false,true])for(const mirror of ['no','yes']){
  const input={sourceFumen:oneO,pattern:'*p3;*p3',useHold,mirror};
  const full=await calculateCongruentCover(input);
  const coverage=await calculateCongruentCover({...input,outputMode:'coverage'});
  const count=await calculateCongruentCover({...input,outputMode:'count',maxBatchPrefixes:3});
  assert.equal(coverage.covered,full.covered);assert.deepEqual(coverage.failedQueues,full.failedQueues);
  assert.equal(count.covered,full.covered);assert.equal(count.total,full.total);
  assert.equal(count.count,full.count);assert.deepEqual(count.coverTargets.map(t=>t.coverage),full.coverTargets.map(t=>t.coverage));
  assert.ok(full.fumen&&full.solutions);assert.ok(!('fumen'in coverage)&&!('solutions'in coverage));
  assert.ok(coverage.coverTargets.every(t=>!('orders'in t)&&!('variants'in t)));
  assert.ok(!('failedQueues'in count));
 }
 const huge=await calculateCongruentCover({sourceFumen:oneO,pattern:'*!,*!,*!,*!,*!',outputMode:'count'});
 assert.equal(huge.totalExact,(5040n**5n).toString());
 assert.equal(huge.coveredExact,((5040n**5n)*2n/7n).toString());
 assert.equal(huge.evaluatedPrefixes,42);
});
test('cover-percent count matches small concrete output and handles huge suffix space',async()=>{
 const sourceFumen=fumen(['OOOOOOOOOO','OOOOOOOOOO']);
 const input={sourceFumen,clear:2,coverPattern:'OOOOO;IIIII',percentPattern:'*p3;*p3'};
 const full=await calculateCoverPercent(input),count=await calculateCoverPercent({...input,outputMode:'count',maxBatchPrefixes:2});
 assert.equal(count.covered,full.covered);assert.equal(count.total,full.total);assert.equal(count.fumen,full.fumen);
 assert.deepEqual(count.solutions.map(r=>[r.covered,r.solve,r.solveTotal]),full.solutions.map(r=>[r.covered,r.solve,r.solveTotal]));
 const huge=await calculateCoverPercent({...input,percentPattern:'*!,*!,*!,*!,*!',outputMode:'count'});
 assert.ok(huge.solutions.every(r=>r.solveExact===(5040n**5n).toString()&&r.solvePercent===100));
});
