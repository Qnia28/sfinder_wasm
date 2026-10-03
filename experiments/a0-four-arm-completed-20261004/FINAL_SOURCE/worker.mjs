import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {parentPort,workerData,threadId} from 'node:worker_threads';
import {ROOT,HERE,read,matrix,context,verify,jsonSha,ARMS} from './common.mjs';
parentPort.on('message',()=>{});
const {arm,entry,fixture,diagnostic=false}=workerData;assert(ARMS.includes(arm));assert.deepEqual(process.execArgv,[]);
const synthetic=!!fixture;
if(synthetic)assert.equal(process.env.FOUR_SYNTHETIC_FIXTURE,'1');else assert.equal(process.platform,'linux');
const build=read(`${ROOT}/.a0/four/${diagnostic?'DIAGNOSTIC_BUILD':'BUILD'}.json`);if(!synthetic&&!diagnostic)assert(build.benchmarkEligible);
assert.equal(build.outputs[arm].diagnostics,diagnostic);
const root=`${ROOT}/${build.outputs[arm].runtime}`;
const decode=performance.now();
const m=synthetic?{keys:['000','001','002'],rows:[[[0,1],[1,1]],[[0,2],[1,2]],[[2,3]],[[2,3]]],K:2,seedKeys:['001','002'],
 cases:[0,1,2,3].map(caseId=>({caseId})),primary:{cardinalityProven:true,backend:'SYNTHETIC_ORACLE',searchedStates:0,primaryHard:false,requested:'rust',kernelStats:{}}}:matrix(entry);
const decodeMs=performance.now()-decode;
const imports=performance.now();
const {createWasmSolver}=await import(pathToFileURL(`${root}/src/wasm-backend.mjs`));
const {createNumericCoverage}=await import(pathToFileURL(`${root}/src/numeric-cover-data.mjs`));
const {solveExactSecondary}=await import(pathToFileURL(`${root}/src/min-cover-exact-secondary.mjs`));
const importMs=performance.now()-imports,init=performance.now(),solver=await createWasmSolver(4,{legal:false}),initMs=performance.now()-init;
assert.equal(Object.keys(solver.e).some(k=>k.includes('four_arm_diag')),diagnostic);
const prep=performance.now(),{coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.cases),coverageMs=performance.now()-prep;
const osTid=synthetic?'SYNTHETIC':fs.readlinkSync('/proc/thread-self').split('/').at(-1);
const allowed=synthetic?'SYNTHETIC':fs.readFileSync(`/proc/self/task/${osTid}/status`,'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)[1].trim();
for(const name of ['enumeratePcPatternCompact','enumeratePcPattern','minimumCoverCardinality','primaryKernelize','minimumCover','minimumCoverIds'])solver[name]=()=>{throw Error(`Forbidden actual-input call:${name}`);};
const original=solver.minimumCoverAtCount;let current=null,callCount=0;const awaiters=new Map();
solver.minimumCoverAtCount=function(c,k,o){
 assert(current);assert.equal(c,coverage);assert.equal(k,m.K);assert.deepEqual(o.seedKeys,m.seedKeys);
 assert(o.integrated&&!o.dominance);assert.equal(o.stateBudget,100000);assert.equal(!!o.partitioned,arm!=='R');
 assert.equal(++current.calls,1);
 if(synthetic)o={...o,stateBudget:fixture.budget};
 current.options={...o};delete current.options.qualityFor;
 if(diagnostic)solver.e.solver_four_arm_diag_reset();
 parentPort.postMessage({type:'phase-start',runId:current.run.runId});
 const pcpu=process.cpuUsage(),tcpu=process.threadCpuUsage(),start=performance.now();
 const probe=original.call(this,c,k,o);current.apiMs=performance.now()-start;current.cpu=process.cpuUsage(pcpu);current.threadCpu=process.threadCpuUsage(tcpu);current.probe=probe;
 if(diagnostic){const names=build.counterNames;current.counters=Object.fromEntries(names.map((name,i)=>[name,solver.e.solver_four_arm_diag_get(i)]));assert(Object.values(current.counters).every(Number.isSafeInteger));}
 parentPort.postMessage({type:'phase-result',runId:current.run.runId,raw:probe,options:current.options,apiMs:current.apiMs,cpu:current.cpu,threadCpu:current.threadCpu,
   profile:null,diagnostic,timingEvidence:!diagnostic,counters:current.counters??null,worker:{pid:process.pid,threadId,osTid,cpu:'UNPINNED',allowed,callCount},wasmBytes:solver.e.memory.buffer.byteLength,wasmSha256:build.outputs[arm].wasmSha256});
 return probe;
};
async function call(run){
 assert.equal(run.arm,arm);assert.equal(++callCount,1);current={run,calls:0};let deferred;
 const ack=new Promise(resolve=>awaiters.set(run.runId,resolve));
 const start=performance.now(),result=solveExactSecondary(coverage,{...context(m),solver,qualityFor:()=>{throw Error('numeric only');},deferThreshold:ctx=>{deferred=ctx;return {validationDeferredRecord:true};}}),routeBoundaryWithIpcMs=performance.now()-start;
 const wait=performance.now();await ack;const ackWaitMs=performance.now()-wait,audit=performance.now(),witness=verify(m,current.probe);let contract=null;
 if(current.probe.completed){assert(!deferred&&result.qualityExact);assert.deepEqual(result.keys,current.probe.keys);}
 else{
  assert(deferred&&deferred.integratedProbe===current.probe&&result.validationDeferredRecord);
  const sentinel=Error('CONTRACT_ONLY_STOP'),snapshot=jsonSha(current.probe),calls=[];
  const spy={minimumCoverAtCount(c,k,o){assert.equal(c,coverage);assert.equal(k,m.K);assert(!o.integrated&&!o.partitioned&&!o.dominance);assert.equal(o.stateBudget,undefined);assert.deepEqual(o.seedKeys,current.probe.keys);assert.deepEqual(o.lockedPrefix,[]);calls.push({K:k,seedKeys:o.seedKeys,lockedPrefix:o.lockedPrefix});throw sentinel;}};
  for(const ctx of [{...context(m),integratedProbe:current.probe},deferred])assert.throws(()=>solveExactSecondary(coverage,{...ctx,solver:spy,qualityFor:()=>1}),e=>e===sentinel);
  assert.equal(jsonSha(current.probe),snapshot);contract={status:'CONTRACT_ONLY_STOP',calls,nativeThresholdCalls:0,incomingProbeSha256:snapshot};
 }
 if(!synthetic){const expected=read(`${HERE}/REFERENCES.json`).references[entry.id][arm==='R'?'R':'A0'];assert.deepEqual(current.probe,expected,`${arm} state/quality/stable-ID/completion mismatch`);}
 const row={...run,status:current.probe.completed?'PROBE_EXACT':'PROBE_CAPPED',probe:current.probe,options:current.options,apiMs:current.apiMs,cpu:current.cpu,threadCpu:current.threadCpu,
   profile:null,diagnostic,timingEvidence:!diagnostic,counters:current.counters??null,witness,contract,worker:{pid:process.pid,threadId,osTid,cpu:'UNPINNED',allowed,callCount},wasmSha256:build.outputs[arm].wasmSha256,
  decodeMs,importMs,initMs,coverageMs,routeBoundaryWithIpcMs,ackWaitMs,verificationMs:performance.now()-audit,
  primaryProofSha256:jsonSha(m.primary),seedKeysSha256:jsonSha(m.seedKeys),actualPrimaryCalls:0,actualPcCalls:0,nativeThresholdCalls:0,
  synthetic,processPeakRssBytes:process.resourceUsage().maxRSS*1024,wasmBytes:solver.e.memory.buffer.byteLength};
 parentPort.postMessage({type:'audit-result',runId:run.runId,row});current=null;
}
parentPort.on('message',async msg=>{
 try{if(msg.type==='ack'){awaiters.get(msg.runId)?.();awaiters.delete(msg.runId);}
 else if(msg.type==='call')await call(msg.run);
 else if(msg.type==='close'){assert(!current);solver.close();parentPort.close();}
 }catch(e){parentPort.postMessage({type:'error',message:e.stack,runId:msg.run?.runId});solver.close();parentPort.close();}
});
parentPort.postMessage({type:'ready',arm,decodeMs,importMs,initMs,coverageMs});
