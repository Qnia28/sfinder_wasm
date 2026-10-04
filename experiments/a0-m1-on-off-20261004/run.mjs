import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { HERE, ROOT, read, write, sha } from './common.mjs';
import { Journal, Session } from './supervisor.mjs';
const host=Number(process.argv[2]);assert(Number.isInteger(host)&&host>=0&&host<10);assert.equal(process.platform,'linux');
const lock=read(`${ROOT}/.a0-m1-comparison/LOCK.json`),origin=lock.origin,campaign=read(`${HERE}/CAMPAIGN.json`);
assert.equal(lock.commit,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
for(const b of lock.sourceBlobs)if(['100644','100755'].includes(b.mode)&&!lock.rebuilt.includes(b.file))assert.equal(sha(fs.readFileSync(`${ROOT}/${b.file}`)),sha(execFileSync('git',['show',`${lock.commit}:${b.file}`],{maxBuffer:100*2**20})),b.file);
for(const [file,hash] of [['pc_wasm.wasm',lock.referenceWasm],['pc_a0_m1.wasm',lock.candidateWasm],['batch_wasm.wasm',lock.batchWasm]])assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/${file}`)),hash);
const runs=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.host===host);assert.equal(runs.length,2448);
const out=`${ROOT}/.a0-m1-comparison/results/${host}`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});
write(`${out}/LOCK.json`,lock);const journal=new Journal();const started=Date.now();let verified=0,attempted=0,stopReason=null;
try{
 for(let i=0;i<runs.length;i++){
  const run=runs[i];
  if(run.position===1&&(Date.now()+campaign.pairAdmissionMs>origin.computeDeadline||Date.now()+campaign.pairAdmissionMs>started+160*60000)){
    stopReason='PAIR_ADMISSION_DEADLINE';break;
  }
  if(Date.now()>=origin.computeDeadline){stopReason='COMPUTE_DEADLINE';break;}
  let session,row;
  try{
    attempted++;session=new Session(run.runId,'COLD',false,{journal,out,apiMs:campaign.apiMs,processMs:campaign.processMs,
      startupMs:campaign.startupMs,auditMs:campaign.auditMs,args:[JSON.stringify(run)]});
    row=await session.call(run);const resources=await session.close();assert.equal(resources.status,'CLOSED');
    assert.equal(row.status,'VERIFIED');verified++;await journal.append(`${out}/outcomes.jsonl`,{...run,status:'VERIFIED',resources});
  }catch(error){
    if(session&&!session.terminal)session.kill('ERROR_PARENT',error);
    const resources=session?await session.closed:null;await journal.append(`${out}/outcomes.jsonl`,{...run,status:error.failure?.status??'ERROR',error:error.stack,resources});
    stopReason=error.failure?.status??'ERROR';break;
  }
 }
}finally{
 await journal.close();
 const files=fs.readdirSync(out,{recursive:true}).filter(n=>fs.statSync(`${out}/${n}`).isFile()).map(file=>({file:file.replaceAll('\\','/'),bytes:fs.statSync(`${out}/${file}`).size,sha256:sha(fs.readFileSync(`${out}/${file}`))}));
 write(`${out}/SUMMARY.json`,{host,status:verified===runs.length?'COMPLETE':'PARTIAL',expectedCalls:runs.length,attemptedCalls:attempted,verifiedCalls:verified,
   stopReason,origin,lock,files,completedAt:new Date().toISOString(),runtime:{node:process.version,v8:process.versions.v8},productDefault:'reference'});
}
if(verified!==runs.length)process.exitCode=1;
