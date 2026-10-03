import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,HERE,read,write,seal,jsonSha} from './common.mjs';
import {Session,Journal} from '../a0-diagnosis-20261003/supervisor.mjs';
class DiagnosticSession extends Session{message(m){if(m.type==='worker-ready'){this.events.push(m);return;}super.message(m);}}
assert.equal(process.platform,'linux');assert.equal(process.env.FOUR_SYNTHETIC_FIXTURE,undefined);
const schedule=read(`${HERE}/DIAGNOSTIC_SCHEDULE.json`),campaign=read(`${HERE}/CAMPAIGN.json`),origin=read(`${ROOT}/.a0/four/ORIGIN.json`),lock=read(`${ROOT}/.a0/four/LOCK.json`);
assert(lock.build.benchmarkEligible&&lock.diagnosticBuild);assert.equal(lock.commit,process.env.GITHUB_SHA);
const out=`${ROOT}/.a0/four/work-results`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const journal=new Journal(),rows=[],outcomes=[],start=performance.now();let active,reason;
try{
 for(const run of schedule.runs){
  if(Date.now()+167000>=origin.originMs+campaign.computeMinutes*60000||performance.now()-start+167000>=25*60000){reason='NOT_RUN_BUDGET';break;}
  let failure;active=new DiagnosticSession(run.matrixId,'COLD',false,{journal,out,apiMs:schedule.apiMs,processMs:schedule.processMs,startupMs:schedule.startupMs,auditMs:schedule.auditMs,
   script:'../a0-four-arm-20261003/session.mjs',args:[]});
  try{await active.ready;const row=await active.call(run);assert(row.diagnostic&&!row.timingEvidence&&row.counters);rows.push(row);}
  catch(e){failure={status:e.failure?.status??'ERROR',message:e.stack,failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,{...run,...failure});}
  const closed=await active.close();active=null;const status=failure?failure.status:closed.code===0&&closed.status==='CLOSED'?'VERIFIED':'ERROR_CLOSE';
  outcomes.push({...run,status,session:closed});await journal.append(`${out}/outcomes.jsonl`,outcomes.at(-1));
  if(status!=='VERIFIED'||closed.stderr){reason=status;break;}
 }
}catch(e){reason=e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack});}
finally{
 if(active)await active.close();await journal.close();
 write(`${out}/SUMMARY.json`,{stage:'WORK_DIAGNOSTIC',status:!reason&&rows.length===20?'COMPLETE':'PARTIAL',expectedCalls:20,attemptedCalls:outcomes.length,verifiedCalls:rows.length,
  stopReason:reason??null,notRun:schedule.runs.slice(outcomes.length),origin,clockReset:false,timingEvidence:false,lock,lockSha256:jsonSha(lock),actualPrimaryPcThresholdCalls:0});seal(out);
 if(reason)process.exitCode=1;
}
