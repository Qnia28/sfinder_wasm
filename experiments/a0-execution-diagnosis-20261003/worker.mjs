import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {parentPort,workerData,threadId} from 'node:worker_threads';
import {ROOT,matrix,context,verify,jsonSha} from './common.mjs';
import {profileExports} from '../a0-diagnosis-20261003/profile-adapter.mjs';
import {CpuProfiler,micro,inspect} from './profiler.mjs';
import {TRACE_FLAGS} from './schedule.mjs';
parentPort.on('message',()=>{}); // Reference port during async solver init.
// Only the calling OS thread is pinned. Background compiler threads are not.
assert.equal(process.platform,'linux');assert.equal(typeof process.threadCpuUsage,'function');
const osTid=fs.readlinkSync('/proc/thread-self').split('/').at(-1),cpu=process.env.A0_WORKER_CPU;
assert(/^\d+$/.test(cpu));execFileSync('taskset',['-pc',cpu,osTid]);
const status=fs.readFileSync(`/proc/self/task/${osTid}/status`,'utf8');
const allowed=status.match(/^Cpus_allowed_list:\s*(.+)$/m)[1].trim();assert.equal(allowed,cpu);
const {entry,variant,profile}=workerData,root=variant==='R'?`${ROOT}/.a0/baseline`:ROOT;
assert.deepEqual(process.execArgv,profile?TRACE_FLAGS:[]);
const engine={mode:'DEFAULT',trace:profile,execArgv:process.execArgv,v8:process.versions.v8,pid:process.pid};
const decode=performance.now(),m=matrix(entry),decodeMs=performance.now()-decode;
const imp=performance.now();
const {createWasmSolver}=await import(pathToFileURL(`${root}/src/wasm-backend.mjs`));
const {createNumericCoverage}=await import(pathToFileURL(`${root}/src/numeric-cover-data.mjs`));
const {solveExactSecondary}=await import(pathToFileURL(`${root}/src/min-cover-exact-secondary.mjs`));
const importMs=performance.now()-imp;
const init=performance.now(),solver=await createWasmSolver(4,{legal:false}),initMs=performance.now()-init;
const prep=performance.now(),{coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.cases),coverageMs=performance.now()-prep;
for(const name of ['enumeratePcPatternCompact','enumeratePcPattern','minimumCoverCardinality','primaryKernelize','minimumCover','minimumCoverIds'])solver[name]=()=>{throw Error(`Forbidden actual-input call:${name}`);};
const adapter=profile?profileExports(solver.e):null;if(adapter)solver.e=adapter.facade;
const original=solver.minimumCoverAtCount,awaiters=new Map();let current=null,callCount=0;
solver.minimumCoverAtCount=function(c,k,o){
  assert(current);assert.equal(c,coverage);assert.equal(k,m.K);assert.deepEqual(o.seedKeys,m.seedKeys);assert.equal(o.integrated,true);assert.equal(o.stateBudget,100000);assert.equal(!!o.partitioned,variant==='A');assert(!o.dominance);
  current.calls++;assert.equal(current.calls,1);
  current.options={...o};delete current.options.qualityFor;
  parentPort.postMessage({type:'phase-start',runId:current.run.runId});
   adapter?.start();const pcpu=process.cpuUsage(),tcpu=process.threadCpuUsage(),start=performance.now(),sampleStartUs=micro();
  const r=original.call(this,c,k,o),end=performance.now();
   current.sampleBoundary={startUs:sampleStartUs,endUs:micro()};current.probe=r;current.apiMs=end-start;current.cpu=process.cpuUsage(pcpu);current.threadCpu=process.threadCpuUsage(tcpu);current.profile=adapter?.finish(start,end)??null;
  parentPort.postMessage({type:'phase-result',runId:current.run.runId,raw:r,options:current.options,apiMs:current.apiMs,cpu:current.cpu,threadCpu:current.threadCpu,profile:current.profile,
     worker:{pid:process.pid,threadId,osTid,cpu,allowed,callCount},engine,sampleBoundary:current.sampleBoundary,wasmBytes:solver.e.memory.buffer.byteLength,processPeakRssBytes:process.resourceUsage().maxRSS*1024});
  return r;
};
async function call(run){
  assert.equal(run.actualVariant,variant);assert.equal(++callCount,1,'Every Worker executes exactly one native call');current={run,calls:0};let deferred;
  const ack=new Promise(resolve=>awaiters.set(run.runId,resolve));
   const inspector=profile?new CpuProfiler():null;if(inspector)await inspector.start();
   const t=performance.now(),result=solveExactSecondary(coverage,{...context(m),solver,qualityFor:()=>{throw Error('Numeric only');},deferThreshold:ctx=>{deferred=ctx;return {validationDeferredRecord:true};}}),routeMs=performance.now()-t;
   const wait=performance.now();await ack;const ackWaitMs=performance.now()-wait;
   let inspectorRecord=null;
   if(inspector){
     const data=await inspector.stop(),summary=inspect(data.profile);inspectorRecord={profileSha256:jsonSha(data),summary,clock:data.clock,samplingIntervalUs:data.samplingIntervalUs,sampleBoundary:current.sampleBoundary};
     const profileAck=new Promise(resolve=>awaiters.set(`${run.runId}:profile`,resolve));
     parentPort.postMessage({type:'profile-result',runId:run.runId,data,record:inspectorRecord});await profileAck;
   }
  const audit=performance.now(),witness=verify(m,current.probe,current.options.seedKeys);assert(current.probe.searchedStates>=1&&current.probe.searchedStates<=100000);
  let contract=null;
  if(current.probe.completed){assert(!deferred&&result.qualityExact);assert.deepEqual(result.keys,current.probe.keys);}
  else{
    assert(deferred&&deferred.integratedProbe===current.probe&&result.validationDeferredRecord);
    const sentinel=Error('CONTRACT_ONLY_STOP'),snapshot=jsonSha(current.probe),calls=[];
    const spy={minimumCoverAtCount(c,k,o){assert.equal(c,coverage);assert.equal(k,m.K);assert(!o.integrated&&!o.partitioned&&!o.dominance);assert.equal(o.stateBudget,undefined);assert.deepEqual(o.seedKeys,current.probe.keys);assert.deepEqual(o.lockedPrefix,[]);calls.push({K:k,seedKeys:o.seedKeys,lockedPrefix:o.lockedPrefix});throw sentinel;}};
    for(const ctx of [{...context(m),integratedProbe:current.probe},deferred])assert.throws(()=>solveExactSecondary(coverage,{...ctx,solver:spy,qualityFor:()=>1}),e=>e===sentinel);
    assert.equal(jsonSha(current.probe),snapshot);contract={status:'CONTRACT_ONLY_STOP',calls,nativeThresholdCalls:0,incomingProbeSha256:snapshot};
  }
  const row={...run,status:current.probe.completed?'PROBE_EXACT':'PROBE_CAPPED',probe:current.probe,options:current.options,apiMs:current.apiMs,cpu:current.cpu,threadCpu:current.threadCpu,profile:current.profile,witness,contract,
     worker:{pid:process.pid,threadId,osTid,cpu,allowed,callCount},engine,sampleBoundary:current.sampleBoundary,inspector:inspectorRecord,decodeMs,importMs,initMs,coverageMs,routeBoundaryWithIpcMs:routeMs,ackWaitMs,verificationMs:performance.now()-audit,
    primaryProofSha256:jsonSha(m.primary),seedKeysSha256:jsonSha(m.seedKeys),actualPrimaryCalls:0,actualPcCalls:0,nativeThresholdCalls:0,
    processPeakRssBytes:process.resourceUsage().maxRSS*1024,wasmBytes:solver.e.memory.buffer.byteLength};
  parentPort.postMessage({type:'audit-result',runId:run.runId,row});current=null;
}
parentPort.on('message',async msg=>{
   try{if(msg.type==='ack'){awaiters.get(msg.runId)?.();awaiters.delete(msg.runId);}
     else if(msg.type==='profile-ack'){awaiters.get(`${msg.runId}:profile`)?.();awaiters.delete(`${msg.runId}:profile`);}
    else if(msg.type==='call')await call(msg.run);
    else if(msg.type==='close'){assert(!current);solver.close();parentPort.close();}
  }catch(e){parentPort.postMessage({type:'error',message:e.stack,runId:msg.run?.runId});solver.close();parentPort.close();}
});
parentPort.postMessage({type:'ready',variant,decodeMs,importMs,initMs,coverageMs,engine,worker:{pid:process.pid,threadId,osTid,cpu,allowed}});
