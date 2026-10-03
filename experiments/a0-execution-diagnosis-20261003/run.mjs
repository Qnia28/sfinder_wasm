import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {ROOT,read,write,seal,sha,jsonSha} from './common.mjs';
import {schedule,CAMPAIGN,LIMITS} from './schedule.mjs';
import {Journal} from '../a0-diagnosis-20261003/supervisor.mjs';
import {ExecutionSession} from './supervisor.mjs';
const lock=read(`${ROOT}/.a0/execution/LOCK.json`),capability=read(`${ROOT}/.a0/execution/CAPABILITY.json`);assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),lock.wasmSha256);
assert.equal(process.platform,'linux');
const allowed=fs.readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)[1].trim();process.env.A0_WORKER_CPU=allowed.split(/[,-]/)[0];
const out=`${ROOT}/.a0/execution/results`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});fs.mkdirSync(`${out}/logs`);fs.mkdirSync(`${out}/profiles`);
const journal=new Journal(),start=performance.now(),stop=Date.parse(CAMPAIGN.originCreated)+CAMPAIGN.computeMinutes*60000,rows=[],outcomes=[];let active,reason;
try{
  if(capability.capability==='UNUSABLE')reason='UNUSABLE_INSTRUMENT';
  for(const run of reason?[]:schedule){
    if(Date.now()+LIMITS.admissionWorstMs>=stop||performance.now()-start+LIMITS.admissionWorstMs>=LIMITS.computeMinutes*60000){reason='NOT_RUN_BUDGET';break;}
    let failure=null,row=null;active=new ExecutionSession(run,{journal,out});
    try{await active.ready;row=await active.call(run);rows.push(row);}catch(e){failure={message:e.stack,failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,{...run,...failure});}
    const closed=await active.close();active=null;
    const status=failure?(closed.status??'ERROR'):closed.status==='CLOSED'&&closed.code===0?'VERIFIED':'ERROR_CLOSE';
    const outcome={...run,status,failure,apiMs:row?.apiMs??null,session:closed};outcomes.push(outcome);await journal.append(`${out}/outcomes.jsonl`,outcome);
    console.log(JSON.stringify({runId:run.runId,status,apiMs:row?.apiMs,inspectorSamples:row?.inspector?.summary.samples}));
    // API/process/startup timeout evidence may continue. Profile timeout/error,
    // quality/OOM/protocol/persistence failure stops without correction/retry.
    if(!['VERIFIED','TIMEOUT_API','TIMEOUT_PROCESS','TIMEOUT_STARTUP'].includes(status)||(!run.profile&&closed.stderr)){reason=status==='VERIFIED'?'UNEXPECTED_STDERR':status;break;}
  }
}catch(e){reason=e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack});process.exitCode=1;}
finally{
  if(active)await active.close();await journal.close();
  write(`${out}/SUMMARY.json`,{status:reason?'PARTIAL':outcomes.length===16&&outcomes.every(o=>o.status==='VERIFIED')?'COMPLETE':'PARTIAL',stopReason:reason??null,
    expectedCalls:16,attemptedCalls:outcomes.length,verifiedCalls:rows.length,outcomes,notRun:schedule.slice(outcomes.length),scheduled:schedule,capability,
    lock,lockSha256:jsonSha(lock),runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,allowedCpuList:allowed,workerCpu:process.env.A0_WORKER_CPU,runId:process.env.GITHUB_RUN_ID},
    campaign:CAMPAIGN,clockReset:false,limits:LIMITS,operationalWallMs:performance.now()-start,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0,performanceConfirmationCalls:0});seal(out);
  if(reason||outcomes.some(o=>o.status!=='VERIFIED'))process.exitCode=1;
}
