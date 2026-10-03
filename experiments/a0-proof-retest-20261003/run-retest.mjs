import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {ROOT,HERE,read,write,seal,sha,jsonSha} from './common.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
class RetestSession extends Session{message(m){if(m.type==='worker-ready'){this.events.push(m);return;}super.message(m);}}
const host=Number(process.argv[2]),campaign=read(`${HERE}/CAMPAIGN.json`),proof=read(`${HERE}/PROOF_AUDIT.json`),lock=read(`${ROOT}/.a0/proof/LOCK.json`);
assert.equal(proof.status,'INDEPENDENT_EXACT_VERIFIED');assert(host>=0&&host<5);
assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),lock.wasmSha256);
const schedule=read(`${HERE}/RETEST_SCHEDULE.json`).runs.filter(r=>r.host===host),origin=Date.parse(proof.origin),deadline=origin+campaign.computeMinutes*60000;
const out=`${ROOT}/.a0/retest/${host}`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const start=performance.now(),journal=new Journal(),rows=[],outcomes=[];let reason,active;
try{
 for(const run of schedule){
  if(Date.now()+167000>=deadline||performance.now()-start+167000>=42*60000){reason='NOT_RUN_BUDGET';break;}
  let row,failure;active=new RetestSession(run.matrixId,'COLD',false,{journal,out,apiMs:10000,processMs:30000,startupMs:30000,auditMs:30000,
   script:'../a0-proof-retest-20261003/retest-session.mjs',args:[]});
  try{await active.ready;row=await active.call(run);rows.push(row);}catch(e){failure={message:e.stack,status:e.failure?.status??'ERROR',failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,{...run,...failure});}
  const closed=await active.close();active=null;
  const status=failure?failure.status:closed.code===0&&closed.status==='CLOSED'?'VERIFIED':'ERROR_CLOSE';outcomes.push({...run,status,session:closed});
  await journal.append(`${out}/outcomes.jsonl`,outcomes.at(-1));
  console.log(JSON.stringify({runId:run.runId,status,apiMs:row?.apiMs}));
  if(!['VERIFIED','TIMEOUT_API','TIMEOUT_PROCESS','TIMEOUT_STARTUP'].includes(status)||closed.stderr){reason=status==='VERIFIED'?'UNEXPECTED_STDERR':status;break;}
 }
}catch(e){reason=e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack});}
finally{
 if(active)await active.close();await journal.close();
 write(`${out}/SUMMARY.json`,{status:!reason&&outcomes.length===schedule.length&&outcomes.every(o=>o.status==='VERIFIED')?'COMPLETE':'PARTIAL',host,stopReason:reason??null,
  expectedCalls:schedule.length,attemptedCalls:outcomes.length,verifiedCalls:rows.length,outcomes,notRun:schedule.slice(outcomes.length),scheduled:schedule,
  lock,lockSha256:jsonSha(lock),proof,originMs:origin,clockReset:false,runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,runId:process.env.GITHUB_RUN_ID},
  actualPrimaryCalls:0,actualPcCalls:0,nativeThresholdCalls:0,operationalWallMs:performance.now()-start});seal(out);if(reason||outcomes.some(o=>o.status!=='VERIFIED'))process.exitCode=1;
}
