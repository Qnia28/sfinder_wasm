import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { parentPort, workerData } from 'node:worker_threads';
import { ROOT, matrix, context, verify, jsonSha } from './common.mjs';
const {entry,variant,phase}=workerData;
assert(['R','A'].includes(variant));assert(['development','reserved'].includes(phase));
assert.equal(entry.partition==='reserved-validation',phase==='reserved');
const t0=performance.now(),m=matrix(entry),decodeMs=performance.now()-t0;
const root=variant==='R'?path.join(ROOT,'.a0/baseline'):ROOT;
const {createWasmSolver}=await import(pathToFileURL(path.join(root,'src/wasm-backend.mjs')));
const {createNumericCoverage}=await import(pathToFileURL(path.join(root,'src/numeric-cover-data.mjs')));
const {solveExactSecondary}=await import(pathToFileURL(path.join(root,'src/min-cover-exact-secondary.mjs')));
const init=performance.now(),solver=await createWasmSolver(4,{legal:false}),initMs=performance.now()-init;
const prep=performance.now(),{coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.cases),coverageMs=performance.now()-prep;
const ack=new Promise(resolve=>parentPort.on('message',msg=>{if(msg.type==='ack'&&msg.id==='integrated-raw')resolve();}));
let probe,options,apiMs,calls=0,deferredContext;
try{
  for(const name of ['enumeratePcPatternCompact','enumeratePcPattern','minimumCoverCardinality','primaryKernelize','minimumCover','minimumCoverIds'])solver[name]=()=>{throw Error(`FORBIDDEN:${name}`);};
  const original=solver.minimumCoverAtCount;
  solver.minimumCoverAtCount=function(c,k,o){
    calls++;assert.equal(calls,1);assert.equal(c,coverage);assert.equal(k,m.K);assert.equal(o.integrated,true);assert.equal(o.stateBudget,100000);assert.equal(!!o.partitioned,variant==='A');assert(!o.dominance);
    options={...o};delete options.qualityFor;
    parentPort.postMessage({type:'phase-start',engine:'integrated'});
    const t=performance.now();probe=original.call(this,c,k,o);apiMs=performance.now()-t;
    parentPort.postMessage({type:'phase-result',engine:'integrated',id:'integrated-raw',raw:probe,options,apiMs,wasmBytes:solver.e.memory.buffer.byteLength,processPeakRssBytes:process.resourceUsage().maxRSS*1024});
    return probe;
  };
  const routeStart=performance.now();
  const final=solveExactSecondary(coverage,{...context(m),solver,qualityFor:()=>{throw Error('Original numeric only');},deferThreshold:ctx=>{assert(!deferredContext);deferredContext=ctx;return {validationDeferredRecord:true};}});
  const probeBoundaryWallMs=performance.now()-routeStart;
  const ipcStart=performance.now();await ack;const persistenceAckWaitMs=performance.now()-ipcStart;
  const auditStart=performance.now(),witness=verify(m,probe,options.seedKeys);
  assert.equal(options.seedKeys.join('\0'),m.seedKeys.join('\0'));assert(probe.searchedStates>=1&&probe.searchedStates<=100000);
  let contract=null;
  if(probe.completed){assert(!deferredContext);assert(final.qualityExact);assert.equal(final.qualityDecision,'integrated-exact');assert.equal(jsonSha(final.keys),jsonSha(probe.keys));}
  else{
    assert(deferredContext);assert.equal(deferredContext.integratedProbe,probe);assert.equal(final.qualityExact,undefined);assert.equal(final.validationDeferredRecord,true);
    const snapshot=jsonSha(probe),sentinel=new Error('CONTRACT_ONLY_STOP'),thresholdCalls=[];
    const spy={minimumCoverAtCount(c,k,o){assert.equal(c,coverage);assert.equal(k,m.K);assert(!o.integrated&&!o.partitioned&&!o.dominance);assert.equal(o.stateBudget,undefined);assert.deepEqual(o.lockedPrefix,[]);assert.deepEqual(o.seedKeys,probe.keys);const clean={...o};delete clean.qualityFor;thresholdCalls.push({K:k,options:clean});throw sentinel;}};
    for(const ctx of [{...context(m),integratedProbe:probe},deferredContext]){
      try{solveExactSecondary(coverage,{...ctx,solver:spy,qualityFor:()=>{throw Error('Original numeric only');}});throw Error('Sentinel not reached');}catch(e){assert.equal(e,sentinel);}
    }
    assert.equal(thresholdCalls.length,2);assert.equal(jsonSha(probe),snapshot);assert.equal(calls,1);
    contract={status:'CONTRACT_ONLY_STOP',nativeThresholdCalls:0,additionalIntegratedCalls:0,directAndDeferred:thresholdCalls,incomingProbeSha256:snapshot};
  }
  const verificationMs=performance.now()-auditStart;
  const result={status:probe.completed?'PROBE_EXACT':'PROBE_CAPPED',probe,options,witness,contract,apiMs,probeBoundaryWallMs,decodeMs,initMs,coverageMs,verificationMs,persistenceAckWaitMs,
    actualInputPrimaryCalls:0,actualInputPcCalls:0,nativeThresholdCalls:0,integratedCalls:calls,processPeakRssBytes:process.resourceUsage().maxRSS*1024,wasmBytes:solver.e.memory.buffer.byteLength};
  parentPort.postMessage({type:'audit-result',result:{status:result.status,witness,contract,verificationMs}});
  parentPort.postMessage({type:'result',result});
}finally{solver.close();parentPort.close();}
