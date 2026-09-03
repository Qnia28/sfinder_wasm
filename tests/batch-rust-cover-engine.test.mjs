import test from'node:test';
import assert from'node:assert/strict';
import{decoder}from'tetris-fumen';
import{coloredOperationSets}from'../src/batch-geometry.mjs';
import{coverTargets}from'../src/batch-cover.mjs';
import{expandPatternCases}from'../src/pattern.mjs';
import{loadBatchWasm,BatchReachability}from'../src/batch-backend.mjs';

function targetsOf(fumen,height=4){const out=[];for(const page of decoder.decode(fumen)){const{base,operationSets}=coloredOperationSets(page,height,{assembleOperation:true});for(const operations of operationSets)out.push({base,operations})}return out}
function publicShape(result){return{covered:result.covered,total:result.total,failed:[...result.failed].sort(),targets:result.targets.map(t=>({coverage:t.coverage,orders:[...t.orders].sort()}))}}

test('Rust cover engine matches legacy JS/WASM traversal on representative modes',async()=>{
 const e=await loadBatchWasm(),fast=new BatchReachability(e,4,'jstris');
 const legacy={placeExact:fast.placeExact.bind(fast),tSpinKind:fast.tSpinKind.bind(fast)};
 const fixtures=[
  ['v115@ThR4BeBtCeR4zhBtKeAgH','*p7','normal'],
  ['v115@IhwwA8HexwGeA8wwH8JeAgH','T','tss'],
  ['v115@KhA8wwEeC8ywD8CeA8AeA8NeAgH','T','b2b'],
 ];
 for(const[fumen,pattern,mode]of fixtures){const targets=targetsOf(fumen),queues=expandPatternCases(pattern);const a=coverTargets({targets,queues,height:4,reachability:fast,mode}),b=coverTargets({targets,queues,height:4,reachability:legacy,mode});assert.deepEqual(publicShape(a),publicShape(b),`${mode}/${pattern}`)}
});

test('Rust cover engine preserves duplicate branch cases',async()=>{
 const reachability=new BatchReachability(await loadBatchWasm(),4,'jstris'),targets=targetsOf('v115@9gD8whI8whI8whI8whE8JeAgH'),queues=expandPatternCases('I;I');
 const r=coverTargets({targets,queues,height:4,reachability,mode:'tetris'});assert.equal(r.total,2);assert.equal(r.covered,2);assert.equal(r.failed.length,0);
});
