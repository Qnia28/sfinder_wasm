import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {HERE,ROOT,MATRIX_ID,read,write,seal,sha,jsonSha} from './common.mjs';
import {schedule,profileSchedule,evaluate} from './schedule.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
class OrderSession extends Session{
  message(m){if(m.type==='worker-ready'){this.events.push(m);return;}super.message(m);}
}
const lock=read(`${ROOT}/.a0/order/LOCK.json`);assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),lock.wasmSha256);
assert.equal(process.platform,'linux');
const allowed=fs.readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)[1].trim();
process.env.A0_WORKER_CPU=allowed.split(/[,-]/)[0];
const out=`${ROOT}/.a0/order/results`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const journal=new Journal(),start=performance.now(),stop=Number(process.env.A0_COMPUTE_DEADLINE_MS),rows=[],sessions=[];let active,decision,reason;
assert(Number.isFinite(stop));
async function closeSession(){if(!active)return;const s=active;active=null;const result=await s.close();sessions.push(result);if(result.status!=='CLOSED'||result.code!==0||result.stderr)throw Object.assign(Error('Session close failed'),{failure:result});}
async function execute(sessionsToRun){
  for(const s of sessionsToRun){
    if(Date.now()+s.runs.length*92000>=stop||performance.now()-start+s.runs.length*92000>=10*60000){reason='NOT_RUN_BUDGET';return;}
    active=new OrderSession(MATRIX_ID,'SHARED_PROCESS_FRESH_WORKER',s.profile,{journal,out,script:'../a0-order-diagnosis-20261003/session.mjs'});await active.ready;
    for(const r of s.runs){const row=await active.call(r);rows.push(row);console.log(JSON.stringify({runId:r.runId,apiMs:row.apiMs,threadCpu:row.threadCpu,worker:row.worker,profile:row.profile}));}
    await closeSession();
  }
}
try{
  await execute(schedule);decision=evaluate(rows);await journal.append(`${out}/DECISIONS.jsonl`,decision);
  if(!reason&&decision.profileRequired)await execute(profileSchedule);
}catch(e){reason=e.failure?.status??e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack,failure:e.failure??null,observedRuns:rows.length});process.exitCode=1;}
finally{
  try{await closeSession();}catch(e){reason??=e.failure?.status??e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack,failure:e.failure??null});process.exitCode=1;}
  await journal.close();
  write(`${out}/SUMMARY.json`,{status:reason?'PARTIAL':'COMPLETE',stopReason:reason??null,expectedBaseRuns:24,observedBaseRuns:rows.filter(r=>r.stage==='order-diagnosis').length,
    observedProfileRuns:rows.filter(r=>r.stage==='order-profile').length,decision:decision??null,scheduled:schedule,conditionalProfiles:profileSchedule,
    lock,lockSha256:jsonSha(lock),sessions,runtime:{node:process.version,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,allowedCpuList:allowed,workerCpu:process.env.A0_WORKER_CPU,platform:process.platform,runId:process.env.GITHUB_RUN_ID},
    operationalWallMs:performance.now()-start,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0,confirmationCalls:0});seal(out);
}
