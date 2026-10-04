import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { HERE, ROOT, read, write, sha } from './common.mjs';
import { Journal, Session } from './supervisor.mjs';
import { isRecordedTimeout, validateConsumed, jobCompletion } from './progress.mjs';
const host=Number(process.argv[2]);assert(Number.isInteger(host)&&host>=0&&host<10);assert.equal(process.platform,'linux');
const lock=read(`${ROOT}/.a0-m1-comparison/LOCK.json`),origin=lock.origin,campaign=read(`${HERE}/CAMPAIGN.json`);
assert.equal(lock.commit,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
for(const b of lock.sourceBlobs)if(['100644','100755'].includes(b.mode)&&!lock.rebuilt.includes(b.file))assert.equal(sha(fs.readFileSync(`${ROOT}/${b.file}`)),sha(execFileSync('git',['show',`${lock.commit}:${b.file}`],{maxBuffer:100*2**20})),b.file);
for(const [file,hash] of [['pc_wasm.wasm',lock.referenceWasm],['pc_a0_m1.wasm',lock.candidateWasm],['batch_wasm.wasm',lock.batchWasm]])assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/${file}`)),hash);
const runs=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.host===host);assert.equal(runs.length,2448);
const out=`${ROOT}/.a0-m1-comparison/results/${host}`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
write(`${out}/LOCK.json`,lock);
let verified=0,attempted=0,timeouts=0,stopReason=null,priorRunId=null;
const consumed=new Set();
const resumeFile=`${HERE}/RESUME.json`;
if(fs.existsSync(resumeFile)){
 const resume=read(resumeFile),prior=`${ROOT}/.a0-m1-prior/${host}`,s=read(`${prior}/SUMMARY.json`);
 assert.equal(sha(fs.readFileSync(`${prior}/SUMMARY.json`)),resume.hosts.find(h=>h.host===host).summarySha256);
 assert.equal(s.lock.commit,resume.sourceCommit);assert.equal(s.origin.origin,origin.origin);
 assert.equal(s.lock.referenceWasm,lock.referenceWasm);assert.equal(s.lock.candidateWasm,lock.candidateWasm);
 assert.deepEqual(s.lock.inputs,lock.inputs);
 for(const f of s.files){const b=fs.readFileSync(`${prior}/${f.file}`);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
 const outcomes=fs.readFileSync(`${prior}/outcomes.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
 for(const id of validateConsumed(runs,outcomes))consumed.add(id);
 assert.equal(outcomes.length,s.attemptedCalls);verified=outcomes.filter(o=>o.status==='VERIFIED').length;
 assert.equal(verified,s.verifiedCalls);timeouts=outcomes.length-verified;attempted=outcomes.length;priorRunId=resume.runId;
 for(const file of ['runs.jsonl','outcomes.jsonl','starts.jsonl'])if(fs.existsSync(`${prior}/${file}`))fs.copyFileSync(`${prior}/${file}`,`${out}/${file}`);
 fs.cpSync(`${prior}/raw`,`${out}/raw`,{recursive:true});
 fs.copyFileSync(`${prior}/SUMMARY.json`,`${out}/PRIOR_SUMMARY.json`);fs.copyFileSync(`${prior}/LOCK.json`,`${out}/PRIOR_LOCK.json`);
}
const journal=new Journal();const started=Date.now();const resumedAttempted=attempted;
try{
 for(let i=0;i<runs.length;i++){
   const run=runs[i];
   if(consumed.has(run.runId))continue;
  if(run.position===1&&(Date.now()+campaign.pairAdmissionMs>origin.computeDeadline||Date.now()+campaign.pairAdmissionMs>started+160*60000)){
    stopReason='PAIR_ADMISSION_DEADLINE';break;
  }
  if(Date.now()>=origin.computeDeadline){stopReason='COMPUTE_DEADLINE';break;}
  let session,row;
  try{
    const episodeRun={...run,executionEpisodeRunId:origin.runId};
    attempted++;session=new Session(run.runId,'COLD',false,{journal,out,apiMs:campaign.apiMs,processMs:campaign.processMs,
      startupMs:campaign.startupMs,auditMs:campaign.auditMs,args:[JSON.stringify(episodeRun)]});
    row=await session.call(episodeRun);const resources=await session.close();assert.equal(resources.status,'CLOSED');
    assert.equal(row.status,'VERIFIED');verified++;await journal.append(`${out}/outcomes.jsonl`,{...episodeRun,status:'VERIFIED',resources});
  }catch(error){
    if(session&&!session.terminal)session.kill('ERROR_PARENT',error);
    const resources=session?await session.closed:null;await session?.chain;
    const status=resources?.status??error.failure?.status??'ERROR';
    await journal.append(`${out}/outcomes.jsonl`,{...run,executionEpisodeRunId:origin.runId,status,error:error.stack,resources,
      ...(isRecordedTimeout(status)?{censored:true,timeoutLimitMs:status==='TIMEOUT_API'?campaign.apiMs:status==='TIMEOUT_PROCESS'?campaign.processMs:status==='TIMEOUT_PROBE'?campaign.probeMs:status==='TIMEOUT_AUDIT'?campaign.auditMs:campaign.startupMs}: {})});
    if(isRecordedTimeout(status)){
      if(!resources||resources.killToCloseMs>=campaign.reapMs){stopReason='ERROR_REAP';break;}
      timeouts++;continue;
    }
    stopReason=status;break;
  }
 }
}finally{
 await journal.close();
 const files=fs.readdirSync(out,{recursive:true}).filter(n=>fs.statSync(`${out}/${n}`).isFile()).map(file=>({file:file.replaceAll('\\','/'),bytes:fs.statSync(`${out}/${file}`).size,sha256:sha(fs.readFileSync(`${out}/${file}`))}));
  const status=stopReason&&!['PAIR_ADMISSION_DEADLINE','COMPUTE_DEADLINE'].includes(stopReason)?'STOPPED_INTEGRITY_ERROR':jobCompletion(runs.length,attempted,verified,timeouts,stopReason);
  write(`${out}/SUMMARY.json`,{host,status,expectedCalls:runs.length,attemptedCalls:attempted,verifiedCalls:verified,timeoutCalls:timeouts,
    priorRunId,resumedAttemptedCalls:resumedAttempted,newAttemptedCalls:attempted-resumedAttempted,executionEpisodeRunId:origin.runId,
   stopReason,origin,lock,files,completedAt:new Date().toISOString(),runtime:{node:process.version,v8:process.versions.v8},productDefault:'reference'});
}
if(stopReason&&!['PAIR_ADMISSION_DEADLINE','COMPUTE_DEADLINE'].includes(stopReason))process.exitCode=1;
