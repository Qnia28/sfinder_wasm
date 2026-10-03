import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {ROOT,HERE,read,write,seal,jsonSha,MATRIX_ID} from './common.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
const campaign=read(`${HERE}/CAMPAIGN.json`),lock=read(`${ROOT}/.a0/proof/LOCK.json`),origin=Number(process.env.CAMPAIGN_ORIGIN_MS);
assert(Number.isFinite(origin));const deadline=origin+campaign.computeMinutes*60000;
const out=`${ROOT}/.a0/proof/results`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const journal=new Journal();let session,row,failure,closed;
const run={runId:'proof-board111-threshold-once',matrixId:MATRIX_ID,variant:'THRESHOLD',stateBudget:2000000};
try{
 if(Date.now()+197000>=deadline)failure={status:'NOT_RUN_BUDGET'};
 else{
  session=new Session(MATRIX_ID,'COLD',false,{journal,out,apiMs:30000,processMs:45000,startupMs:45000,auditMs:30000,
    script:'../a0-proof-retest-20261003/proof-session.mjs',args:[]});
  await session.ready;row=await session.call(run);
 }
}catch(e){failure={message:e.stack,status:e.failure?.status??'ERROR',failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,failure);}
finally{
 if(session)closed=await session.close();await journal.close();
 const verdict=failure?'PROOF_PENDING':row.verdict;
 write(`${out}/SUMMARY.json`,{status:verdict,row:row??null,failure:failure??null,session:closed??null,lock,lockSha256:jsonSha(lock),
   originMs:origin,deadlineMs:deadline,campaign,clockResetWithinCampaign:false,
   expectedCalls:1,attemptedCalls:session?1:0,actualPrimaryCalls:0,actualPcCalls:0,integratedCalls:0,
   runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,runId:process.env.GITHUB_RUN_ID}});seal(out);
 if(verdict!=='INDEPENDENT_EXACT_VERIFIED')process.exitCode=1;console.log(JSON.stringify({verdict,completed:row?.probe.completed,searchedStates:row?.probe.searchedStates}));
}
