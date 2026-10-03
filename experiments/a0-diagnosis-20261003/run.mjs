import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {HERE,ROOT,read,write,seal,jsonSha,sha} from './common.mjs';
import {Journal,Session} from './supervisor.mjs';
const [hostArg,shardArg]=process.argv.slice(2),host=Number(hostArg),shard=Number(shardArg);
assert([0,1].includes(host)&&Number.isInteger(shard)&&shard>=0&&shard<16);
const lock=read(`${ROOT}/.a0/build/LOCK.json`);assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),lock.wasmSha256);
const runs=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.hostBlock===host&&r.shard===shard),out=`${ROOT}/.a0/results/h${host}-s${shard}`;
assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
const journal=new Journal(),start=performance.now(),stop=Number(process.env.A0_COMPUTE_DEADLINE_MS),rows=[],sessions=[];let session,key,stopReason;
assert(Number.isFinite(stop));
async function closeCurrent(){if(!session)return;const s=session;session=null;const result=await s.close();sessions.push(result);if(result.status!=='CLOSED'||result.code!==0||result.stderr)throw Object.assign(Error('Session close failed'),{failure:result});}
try{
  for(const r of runs){
    if(Date.now()+92000>=stop||performance.now()-start+92000>=17*60000){stopReason='NOT_RUN_BUDGET';break;}
    const newKey=r.mode==='COLD'?r.runId:`${r.stage}:${r.matrixId}:${r.mode}`;
    if(newKey!==key){await closeCurrent();key=newKey;session=new Session(r.matrixId,r.mode,r.instrumented,{journal,out});await session.ready;}
    const row=await session.call(r);rows.push(row);console.log(JSON.stringify({runId:r.runId,apiMs:row.apiMs,status:row.status,profile:row.profile}));
  }
}catch(e){stopReason=e.failure?.status??e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack,failure:e.failure??null,observedRuns:rows.length});process.exitCode=1;}
finally{
  try{await closeCurrent();}catch(e){stopReason??=e.failure?.status??e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack,failure:e.failure??null});process.exitCode=1;}await journal.close();
  write(`${out}/SHARD.json`,{host,shard,status:stopReason?'PARTIAL':'COMPLETE',stopReason:stopReason??null,expectedRuns:runs.length,observedRuns:rows.length,scheduled:runs,notRun:runs.slice(rows.length),lock,lockSha256:jsonSha(lock),sessions,runtime:{node:process.version,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,platform:process.platform,job:process.env.GITHUB_JOB,runId:process.env.GITHUB_RUN_ID},operationalWallMs:performance.now()-start,confirmationCalls:0,nativeThresholdCalls:0});seal(out);
}
