// R16 anchor stage: orchestration only. Calls run in the existing common executor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest,sha256,writeJson,readJson} from '../contracts.mjs';
import {executeTask} from '../executor.mjs';
import {FOLLOWUP_JOB,worstCall} from '../budget.mjs';
import {profileForTriage} from './protocol.mjs';
import {seal} from '../evidence.mjs';
const mode=process.argv[2],campaignId='RC_REGRESSION_R16_ANCHOR_20261011';
const inputZip='tools/secondary-bench/common/triage/regression-inputs-r16.zip';
const job={...FOLLOWUP_JOB,parts:1,jobMs:40*60000,jobMinutes:60,finalTransportMs:10*60000};
function inputs(){
  execFileSync('python',['tools/secondary-bench/followup-extract.py',inputZip,'bundle',String(4*1024**3)]);
  return readJson('bundle/INPUTS.json').inputs;
}
if(mode==='plan') {
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','new invocation required; no measurement rerun');
  const marker=readJson('.github/secondary-triage/R16_START.json');assert.equal(marker.confirm,'RUN_R16_12VM');
  assert.equal(marker.inputZipSha256,sha256(fs.readFileSync(inputZip)));assert.equal(marker.maxParallel,12);
  const refs=inputs(),originMs=Date.now();
  const manifest={campaignId,revision:16,diagnostic:{id:'rc-regression-anchor-v1'},inputs:refs,job,maxParallel:12,maxCalls:16,
    overallMs:48*3600000,maxRunnerHours:9,approval:'USER_12VM_20261011',parentRunId:38072016117,
    inputZipSha256:sha256(fs.readFileSync(inputZip)),stage:'ANCHOR_LOCALIZATION_ONLY',factorialCalls:0};
  const profile=profileForTriage(manifest);manifest.profileContract=profile;
  const lock={manifest,manifestHash:digest(manifest),profileHash:digest(profile),invocationId:process.env.GITHUB_RUN_ID,
    originMs,endMs:originMs+manifest.overallMs,endUtc:new Date(originMs+manifest.overallMs).toISOString(),commit:process.env.GITHUB_SHA};
  writeJson('activation/LOCK.json',lock);writeJson('activation/MANIFEST.json',manifest);
  const matrix=[];
  for(let input=0;input<4;input++)for(let repeat=1;repeat<=2;repeat++)matrix.push({input,repeat,index:matrix.length});
  writeJson('activation/MATRIX.json',matrix);
  await seal('activation',{campaignId,invocationId:lock.invocationId,name:'activation'});
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(matrix)+'\n');
  console.log(JSON.stringify({campaignId,calls:16,workers:8,maxParallel:12,maxRunnerHours:9,solverCalls:0}));
} else if(mode==='run') {
  const lock=readJson('activation/LOCK.json');assert.equal(digest(lock.manifest),lock.manifestHash);assert.equal(lock.commit,process.env.GITHUB_SHA);
  assert.equal(lock.invocationId,process.env.GITHUB_RUN_ID);assert.equal(sha256(fs.readFileSync(inputZip)),lock.manifest.inputZipSha256);
  const refs=inputs();assert.deepEqual(refs,lock.manifest.inputs);
  execFileSync('python',['tools/secondary-bench/common/triage/prepare-regression.py'],{stdio:'inherit'});
  const index=Number(process.env.R16_INPUT),repeat=Number(process.env.R16_REPEAT),chunk=Number(process.env.R16_CHUNK);
  assert(index>=0&&index<4&&[1,2].includes(repeat));process.env.INPUT_ARTIFACT_ID='r16-'+chunk;
  const ref=refs[index],phase='R16_ANCHOR',id=`${phase}-${index}-${repeat}`,limits={startupMs:10000,callMs:600000,reapMs:5000};
  let arms=['DEV','RC'];if((parseInt(digest(ref.id).slice(0,8),16)%2)===repeat%2)arms.reverse();
  const calls=arms.map((variant,position)=>{
    const identity={campaignId,phase,taskId:id,inputId:ref.id,inputHash:ref.sha256,variant,repeat,block:repeat,position,role:ref.metadata.dataset,measurementEpoch:16};
    return {...identity,callId:digest(identity),limits};
  });
  const task={id,phase,adapter:'triage-fixture',calls,worstMs:2*worstCall(limits,job)};
  fs.mkdirSync('evidence');writeJson('evidence/TASK.json',task);writeJson('evidence/LOCK.json',lock);
  fs.copyFileSync('PRODUCT_PATCHES.json','evidence/PRODUCT_PATCHES.json');
  writeJson('evidence/ENVIRONMENT.json',{node:process.version,platform:process.platform,commit:process.env.GITHUB_SHA,chunk,runnerName:process.env.RUNNER_NAME});
  assert.equal(process.version,'v24.13.0');
  const quarantine={oom:[],fatal:null};
  const rows=await executeTask(lock,{phase,index:chunk},task,'bundle','evidence/part',quarantine,{jobStartedMs:Number(process.env.JOB_STARTED_MS),checkpointsRemaining:1});
  if(fs.existsSync('diagnostic-traces'))fs.renameSync('diagnostic-traces','evidence/diagnostic-traces');
  writeJson('evidence/RESULT.json',{statuses:rows.map(r=>r.status),state:quarantine});
  await seal('evidence',{campaignId,invocationId:lock.invocationId,phase,chunk});
  assert(!quarantine.fatal,'unsafe/invalid result');assert(rows.every(r=>['EXACT','TIMEOUT_CALL','OOM'].includes(r.status)),'incomplete admission');
} else throw Error('unknown mode');
