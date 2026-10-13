import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {digest,sha256,writeJson,readJson} from '../contracts.mjs';
import {executeTask} from '../executor.mjs';
import {profileForTriage} from './protocol.mjs';
import {seal,verifySnapshot,deliver,deadlineClient} from '../evidence.mjs';
import {CAMPAIGN,PHASE,ARMS,JOB,tasksFor,validateReservation} from './qb015-plan.mjs';
import {optionalFile} from './factorial-environment.mjs';
const inputZip='tools/secondary-bench/common/triage/qb015-inputs-r19.zip';
const prepare=()=>execFileSync('python',['tools/secondary-bench/common/triage/prepare-qb015.py'],{stdio:'inherit'});
const inputs=()=>{execFileSync('python',['tools/secondary-bench/followup-extract.py',inputZip,'bundle',String(4*1024**3)]);return readJson('bundle/INPUTS.json').inputs;};
const summary=v=>{console.log(JSON.stringify(v));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## QB015 R19\n\n\`\`\`json\n${JSON.stringify(v,null,2)}\n\`\`\`\n`);};
validateReservation();assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','no measurement rerun');
if(process.argv[2]==='plan'){
  const marker=readJson('.github/secondary-triage/R19_START.json');assert.equal(marker.confirm,'RUN_QB015_R19');
  assert.equal(sha256(fs.readFileSync(inputZip)),marker.inputZipSha256);prepare();
  assert.equal(sha256(fs.readFileSync('QB015_PATCHES.json')),marker.productPatchSha256);
  const refs=inputs();assert.equal(refs.length,1);const originMs=Date.now();
  const manifest={schemaVersion:1,campaignId:CAMPAIGN,revision:19,diagnostic:{id:'qb015-causal-v1'},inputs:refs,job:JOB,maxParallel:2,maxCalls:16,maxRunnerHours:6,overallMs:48*3600000,
    approval:'USER_QB015_CAUSE_AND_LOW_COST_INVESTIGATION_20261013',parentRunId:38241601404,newCampaign:true,priorExperiments:'PRESERVED_IN_LEDGER',inputZipSha256:marker.inputZipSha256,productPatchSha256:marker.productPatchSha256,arms:ARMS,productionCpDeadline:null,automaticPromotion:false};
  manifest.profileContract=profileForTriage(manifest);
  const lock={manifest,manifestHash:digest(manifest),profileHash:digest(manifest.profileContract),invocationId:process.env.GITHUB_RUN_ID,commit:process.env.GITHUB_SHA,originMs,endMs:originMs+manifest.overallMs,endUtc:new Date(originMs+manifest.overallMs).toISOString()};
  const blocks=[1,2].map(repeat=>({index:repeat-1,repeat,tasks:tasksFor(refs[0],repeat)}));
  writeJson('activation/LOCK.json',lock);writeJson('activation/MANIFEST.json',manifest);writeJson('activation/BLOCKS.json',blocks);
  writeJson('activation/STAGE_PLAN.json',{manifestHash:lock.manifestHash,phase:PHASE,chunks:2,expectedCalls:blocks.flatMap(b=>b.tasks.flatMap(t=>t.calls))});
  for(const name of ['PRODUCT_PATCHES.json','QB015_PATCHES.json'])fs.copyFileSync(name,'activation/'+name);
  fs.copyFileSync(inputZip,'activation/INPUTS.zip');await seal('activation',{campaignId:CAMPAIGN,invocationId:lock.invocationId,name:'activation'});
  summary({calls:16,workers:2,maxRunnerHours:6,arms:ARMS,automaticPromotion:false});
}else if(process.argv[2]==='run'){
  assert.equal(process.version,'v24.13.0');verifySnapshot('activation');const lock=readJson('activation/LOCK.json');
  assert.equal(digest(lock.manifest),lock.manifestHash);assert.equal(lock.commit,process.env.GITHUB_SHA);assert.equal(lock.invocationId,process.env.GITHUB_RUN_ID);
  assert.equal(sha256(fs.readFileSync(inputZip)),lock.manifest.inputZipSha256);assert.deepEqual(inputs(),lock.manifest.inputs);
  const chunk=Number(process.env.R19_CHUNK);assert([0,1].includes(chunk));const block=readJson('activation/BLOCKS.json')[chunk];
  assert.deepEqual(block.tasks,tasksFor(lock.manifest.inputs[0],chunk+1));process.env.INPUT_ARTIFACT_ID='r19-'+chunk;prepare();
  assert.equal(sha256(fs.readFileSync('QB015_PATCHES.json')),lock.manifest.productPatchSha256);
  writeJson('evidence/LOCK.json',lock);writeJson('evidence/BLOCK.json',block);
  for(const name of ['PRODUCT_PATCHES.json','QB015_PATCHES.json'])fs.copyFileSync(name,'evidence/'+name);
  writeJson('evidence/ENVIRONMENT.json',{node:process.version,cpus:os.cpus(),availableParallelism:os.availableParallelism(),cpuMax:optionalFile('/sys/fs/cgroup/cpu.max'),commit:process.env.GITHUB_SHA,runnerName:process.env.RUNNER_NAME,chunk});
  const client=(await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
  const quarantine={oom:[],fatal:null},rows=[];
  try{for(const [position,task] of block.tasks.entries()){
    const directory=`evidence/part-${position}`;
    rows.push(...await executeTask(lock,{phase:PHASE,index:chunk},task,'bundle',directory,quarantine,{jobStartedMs:Number(process.env.JOB_STARTED_MS),checkpointsRemaining:8-position}));
    writeJson(directory+'/TASK.json',task);if(fs.existsSync('diagnostic-traces'))fs.renameSync('diagnostic-traces',directory+'/diagnostic-traces');
    const receipt=await deliver(deadlineClient(client,JOB.checkpointMs),directory,`evidence/transport/part-${position}.json`,{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:PHASE,chunk,part:position},{retentionDays:30},`triage-data-${CAMPAIGN}-${chunk}-${position}`);
    assert.equal(receipt.status,'UPLOADED');assert(!quarantine.fatal,'unsafe/invalid result');
  }}finally{writeJson('evidence/RESULT.json',{statuses:rows.map(r=>r.status),state:quarantine});await seal('evidence',{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:PHASE,chunk,name:'worker-final'});summary({chunk,statuses:rows.map(r=>r.status),state:quarantine});}
  assert.equal(rows.length,8);assert(rows.every(r=>['EXACT','TIMEOUT_CALL','OOM'].includes(r.status)));
}else throw Error('unknown mode');
