import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {parentPort,workerData} from 'node:worker_threads';
import {ROOT,compare,verify,jsonSha} from './common.mjs';
const {fixture,variant}=workerData,n=fixture>=29?63+fixture-29:3+fixture%7,K=fixture>=29?1:2;
const keys=Array.from({length:n},(_,i)=>String(i).padStart(3,'0'));
let rows;
if(K===1)rows=Array.from({length:3},(_,j)=>keys.map((_,i)=>[i,1+(n-i)*(j+1)]));
else{
  const q=(i,j)=>1+(i*7+j*11+fixture*3)%13;
  rows=[[[0,q(0,0)],[1,q(1,0)]],Array.from({length:n-2},(_,j)=>[j+2,q(j+2,1)]),[[0,q(0,2)],...Array.from({length:n-2},(_,j)=>[j+2,q(j+2,2)])]];
  rows.push(rows[fixture%3].map(e=>[...e]));rows.push(rows[0].map(e=>[...e]));
}
const m={keys,rows,K,seedKeys:K===1?[keys.at(-1)]:[keys[0],keys[2]]};
const score=ids=>rows.map(row=>row.reduce((q,[id,v])=>ids.includes(id)?Math.max(q,v):q,0)).sort((a,b)=>a-b);
let expected=null;
for(let i=0;i<n;i++)for(let j=K===1?i:i+1;j<(K===1?i+1:n);j++){
  const ids=K===1?[i]:[i,j],q=score(ids);if(!q[0])continue;
  if(!expected||compare(q,expected.q)>0||(compare(q,expected.q)===0&&compare(ids,expected.ids)<0))expected={ids,q};
}
assert(expected);
const root=variant==='R'?path.join(ROOT,'.a0/baseline'):ROOT;
const {createWasmSolver}=await import(pathToFileURL(path.join(root,'src/wasm-backend.mjs')));
const {createNumericCoverage}=await import(pathToFileURL(path.join(root,'src/numeric-cover-data.mjs')));
const {solveExactSecondary}=await import(pathToFileURL(path.join(root,'src/min-cover-exact-secondary.mjs')));
const solver=await createWasmSolver(4,{legal:false}),{coverage}=createNumericCoverage(keys,new Map(rows.map((r,i)=>[i,r])),rows.map((_,caseId)=>({caseId})));
const acks=new Map();parentPort.on('message',m=>{if(m.type==='ack'){acks.get(m.id)?.();acks.delete(m.id);}});
let calls=0,raw=[];
try{
  const original=solver.minimumCoverAtCount;
  solver.minimumCoverAtCount=function(c,k,o){
    calls++;const engine=o.integrated?'integrated':'threshold',id=`raw-${calls}`;
    parentPort.postMessage({type:'phase-start',engine});const t=performance.now(),r=original.call(this,c,k,o),apiMs=performance.now()-t;
    // Synthetic-only injected capped marker; never described as natural100K cap.
    const delivered=engine==='integrated'?{...r,completed:false}:r;
    const options={...o};delete options.qualityFor;
    parentPort.postMessage({type:'phase-result',engine,id,raw:r,deliveredCompleted:delivered.completed,options,apiMs});raw.push({engine,r,delivered,options,id});
    return delivered;
  };
  // Execute initial real probe, persist it, then resume product with transferred
  // synthetic-only capped marker. No second native integrated call is allowed.
  let ctx;
  const base={primary:{count:K,backend:'rust'},primaryKeys:m.seedKeys,primaryHard:false,requestedPrimary:'rust',requested:false,kernelStats:{cases:rows.length,solutions:n,entries:rows.flat().length},decomposition:'off',solver,qualityFor:()=>{throw Error('numeric');}};
  solveExactSecondary(coverage,{...base,deferThreshold:c=>{ctx=c;return {validationDeferredRecord:true};}});
  assert(ctx);await new Promise(r=>acks.set('raw-1',r));verify(m,raw[0].delivered);
  const final=solveExactSecondary(coverage,{...base,...ctx});await new Promise(r=>acks.set('raw-2',r));
  assert.equal(calls,2);assert(final.qualityExact&&raw[1].r.completed);assert.equal(raw[1].options.integrated,undefined);assert.equal(raw[1].options.partitioned,undefined);assert.deepEqual(raw[1].options.seedKeys,raw[0].delivered.keys);
  const witness=verify(m,final);assert.deepEqual(witness.selectedIDs,expected.ids);assert.deepEqual(final.qualityVector,expected.q);
  assert.equal(final.qualitySearchedStates,raw[0].r.searchedStates+raw[1].r.searchedStates);
  parentPort.postMessage({type:'result',result:{status:'SYNTHETIC_PASS',fixture,variant,n,K,expected,witness,raw,forcedCappedMarker:true,nativeIntegratedCalls:1,nativeThresholdCalls:1,actualInputPrimaryCalls:0,actualInputPcCalls:0}});
}finally{solver.close();parentPort.close();}
