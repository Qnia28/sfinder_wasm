import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ROOT,HERE,read,matrix,verify,jsonSha,MATRIX_ID} from './common.mjs';
assert.equal(process.platform,'linux');assert.equal(process.execArgv.length,0);
assert(fs.readFileSync('/proc/self/cgroup','utf8').includes(process.env.A0_CHILD_CGROUP.split('/').at(-1)));
// IPC handle keeps asynchronous module compilation alive.
let solver,current,probe,start,cpu,threadCpu;process.on('message',async m=>{
 try{
  if(m.type==='call'){
   assert(!current);current=m.run;assert.equal(current.matrixId,MATRIX_ID);
    const options={seedKeys:input.seedKeys,stateBudget:2000000,integrated:false,partitioned:false,dominance:false,qualityFor:()=>{throw Error('Numeric coverage only; quality fallback forbidden');}};
   process.send({type:'phase-start',runId:current.runId});
   const pcpu=process.cpuUsage(),tcpu=process.threadCpuUsage();start=performance.now();probe=solver.minimumCoverAtCount(coverage,input.K,options);
   const apiMs=performance.now()-start;cpu=process.cpuUsage(pcpu);threadCpu=process.threadCpuUsage(tcpu);
    const recordedOptions={...options};delete recordedOptions.qualityFor;
    process.send({type:'phase-result',runId:current.runId,raw:probe,options:recordedOptions,apiMs,cpu,threadCpu,backend:'baseline-fixed-K-threshold'});
  }else if(m.type==='ack'){
   assert.equal(m.runId,current.runId);const audit=performance.now(),witness=verify(input,probe),expected=read(`${HERE}/EXPECTED.json`);
   assert(probe.searchedStates>=1&&probe.searchedStates<=2000000);
   const same=jsonSha(probe.qualityVector)===jsonSha(expected.qualityVector)&&jsonSha(witness.selectedIDs)===jsonSha(expected.selectedIDs);
   const verdict=probe.completed?(same?'INDEPENDENT_EXACT_VERIFIED':'MISMATCH'):'PROOF_PENDING';
   process.send({type:'audit-result',runId:current.runId,row:{...current,status:probe.completed?'EXACT':'CAPPED',verdict,probe,witness,contract:null,
     verificationMs:performance.now()-audit,primaryProofSha256:jsonSha(input.primary),seedSha256:jsonSha(input.seedKeys),
     actualPrimaryCalls:0,actualPcCalls:0,nativeThresholdCalls:1,integratedCalls:0,expectedSha256:jsonSha(expected)}});
   process.send({type:'call-done',runId:current.runId});
  }else if(m.type==='close'){solver.close();process.disconnect();}
 }catch(e){console.error(e.stack);process.exit(1);}
});
const entry=read(`${HERE}/INPUT.json`),input=matrix(entry);
const {createWasmSolver}=await import(pathToFileURL(`${ROOT}/.a0/baseline/src/wasm-backend.mjs`));
const {createNumericCoverage}=await import(pathToFileURL(`${ROOT}/.a0/baseline/src/numeric-cover-data.mjs`));
solver=await createWasmSolver(4,{legal:false});
for(const name of ['enumeratePcPatternCompact','enumeratePcPattern','minimumCoverCardinality','primaryKernelize','minimumCover','minimumCoverIds'])solver[name]=()=>{throw Error(`Forbidden actual-input call:${name}`);};
const {coverage}=createNumericCoverage(input.keys,new Map(input.rows.map((r,i)=>[i,r])),input.cases);
process.send({type:'session-ready'});
