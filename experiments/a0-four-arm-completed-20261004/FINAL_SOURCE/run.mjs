import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import {ROOT,HERE,read,write,seal,jsonSha} from './common.mjs';
import {Session,Journal} from '../a0-diagnosis-20261003/supervisor.mjs';
class FourSession extends Session{message(m){if(m.type==='worker-ready'){this.events.push(m);return;}super.message(m);}}
assert.equal(process.platform,'linux');assert.equal(process.env.FOUR_SYNTHETIC_FIXTURE,undefined);
const host=Number(process.argv[2]);assert(Number.isInteger(host)&&host>=0&&host<5);
const campaign=read(`${HERE}/CAMPAIGN.json`),lock=read(`${ROOT}/.a0/four/LOCK.json`),origin=read(`${ROOT}/.a0/four/ORIGIN.json`);
assert(lock.build.benchmarkEligible);assert.equal(lock.commit,process.env.GITHUB_SHA);
const schedule=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.host===host),deadline=origin.originMs+campaign.computeMinutes*60000;
assert.equal(schedule.length,992);
const out=`${ROOT}/.a0/four/results/${host}`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const start=performance.now(),journal=new Journal(),outcomes=[],rows=[];let active,reason;
try{
 for(let i=0;i<schedule.length;i++){
  const run=schedule[i];
  // Admit whole 4-arm block (or same-variant environment pair), not just its first call.
  if(i===0||schedule[i-1].blockId!==run.blockId){
   const blockCalls=run.kind==='ENVIRONMENT_CONTROL'?2:4,admission=blockCalls*campaign.perCallAdmissionSeconds*1000;
   if(Date.now()+admission>=deadline||performance.now()-start+admission>=campaign.benchComputeGuardMinutes*60000){reason='NOT_RUN_BUDGET';break;}
  }
  let row,failure;active=new FourSession(run.matrixId,'COLD',false,{journal,out,apiMs:campaign.apiMs,processMs:campaign.processMs,startupMs:campaign.startupMs,auditMs:campaign.auditMs,
   script:'../a0-four-arm-20261003/session.mjs',args:[]});
  try{await active.ready;row=await active.call(run);rows.push(row);}catch(e){failure={message:e.stack,status:e.failure?.status??'ERROR',failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,{...run,...failure});}
  const closed=await active.close();active=null;
  const status=failure?failure.status:closed.code===0&&closed.status==='CLOSED'?'VERIFIED':'ERROR_CLOSE';outcomes.push({...run,status,session:closed});
  await journal.append(`${out}/outcomes.jsonl`,outcomes.at(-1));console.log(JSON.stringify({runId:run.runId,status,apiMs:row?.apiMs}));
  if(!['VERIFIED','TIMEOUT_API','TIMEOUT_PROCESS','TIMEOUT_STARTUP'].includes(status)||closed.stderr){reason=status==='VERIFIED'?'UNEXPECTED_STDERR':status;break;}
 }
}catch(e){reason=e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack});}
finally{
 if(active)await active.close();await journal.close();
 write(`${out}/SUMMARY.json`,{status:!reason&&outcomes.length===schedule.length&&outcomes.every(o=>o.status==='VERIFIED')?'COMPLETE':'PARTIAL',host,stopReason:reason??null,
  expectedCalls:schedule.length,attemptedCalls:outcomes.length,verifiedCalls:rows.length,notRun:schedule.slice(outcomes.length),origin,clockReset:false,lock,lockSha256:jsonSha(lock),
  runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,runId:process.env.GITHUB_RUN_ID},
  actualPrimaryCalls:0,actualPcCalls:0,nativeThresholdCalls:0,operationalWallMs:performance.now()-start});seal(out);
 if(reason||outcomes.some(o=>o.status!=='VERIFIED'))process.exitCode=1;
}
