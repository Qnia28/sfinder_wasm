import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest,sha256,writeJson,readJson} from '../contracts.mjs';
import {executeTask} from '../executor.mjs';
import {profileForTriage} from './protocol.mjs';
import {seal,verifySnapshot,deliver,deadlineClient} from '../evidence.mjs';
import {CAMPAIGN,PHASE,ARMS,JOB,tasksFor,validateReservation} from './factorial-plan.mjs';
const inputZip='tools/secondary-bench/common/triage/regression-inputs-r16.zip';
const mode=process.argv[2];validateReservation();
const summary=v=>{console.log(JSON.stringify(v));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## R17 factorial\n\n\`\`\`json\n${JSON.stringify(v,null,2)}\n\`\`\`\n`);};
function inputs(){execFileSync('python',['tools/secondary-bench/followup-extract.py',inputZip,'bundle',String(4*1024**3)]);return readJson('bundle/INPUTS.json').inputs;}
if(mode==='plan'){
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','no population rerun');
  const marker=readJson('.github/secondary-triage/R17_START.json');assert.equal(marker.confirm,'RUN_R17_12VM');assert.equal(marker.maxParallel,12);
  assert.equal(marker.inputZipSha256,sha256(fs.readFileSync(inputZip)));
  // Resolve platform-independent product bytes once before any measurement VM is admitted.
  execFileSync('python',['tools/secondary-bench/common/triage/prepare-factorial.py'],{stdio:'inherit'});
  fs.mkdirSync('activation');fs.copyFileSync('FACTOR_PATCHES.json','activation/FACTOR_PATCHES.json');
  assert.equal(sha256(fs.readFileSync('FACTOR_PATCHES.json')),marker.factorPatchSha256,'activation frozen products');
  const refs=inputs(),originMs=Date.parse('2026-10-11T14:48:20.214Z');
  assert(Date.now()+JOB.jobMinutes*60000+45*60000<originMs+48*3600000,'parent campaign deadline cannot fit factorial stage');
  const manifest={schemaVersion:1,campaignId:CAMPAIGN,revision:17,diagnostic:{id:'rc-regression-factorial-v1'},inputs:refs,job:JOB,
    maxParallel:12,maxCalls:64,maxRunnerHours:21,overallMs:48*3600000,approval:'USER_CONTINUE_EXPERIMENT_AND_MINIMAL_FIX_20261012',
    parentRunId:38148652911,recoveryRunIds:[38223727424,38224519856],recoveryObservedCalls:0,priorReservedCalls:144,priorReservedRunnerHours:51,cumulativeReservedCalls:208,cumulativeReservedRunnerHours:72,
    inputZipSha256:marker.inputZipSha256,factorPatchSha256:marker.factorPatchSha256,arms:ARMS,baseCommit:'2c406b98cadc186bfaf4490f4b8568535a60ea01',
    factors:{P:['DEV_BASELINE','P15'],C:[120000,null],M:['DEV_LINMAX','RC_COMPACT']},productionCpDeadline:null,automaticPromotion:false};
  manifest.profileContract=profileForTriage(manifest);
  const lock={manifest,manifestHash:digest(manifest),profileHash:digest(manifest.profileContract),invocationId:process.env.GITHUB_RUN_ID,
    originMs,endMs:originMs+manifest.overallMs,endUtc:new Date(originMs+manifest.overallMs).toISOString(),commit:process.env.GITHUB_SHA};
  const blocks=[];for(let input=0;input<4;input++)for(let repeat=1;repeat<=2;repeat++)blocks.push({input,repeat,index:blocks.length,tasks:tasksFor(refs[input],input,repeat)});
  writeJson('activation/LOCK.json',lock);writeJson('activation/MANIFEST.json',manifest);writeJson('activation/BLOCKS.json',blocks);
  writeJson('activation/STAGE_PLAN.json',{manifestHash:lock.manifestHash,phase:PHASE,expectedCalls:blocks.flatMap(b=>b.tasks.flatMap(t=>t.calls))});
  await seal('activation',{campaignId:CAMPAIGN,invocationId:lock.invocationId,name:'activation'});
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(blocks.map(({tasks,...b})=>b))+'\n');summary({calls:64,workers:8,maxParallel:12,maxRunnerHours:21,cumulativeReservedCalls:208,cumulativeReservedRunnerHours:72,recoveryObservedCalls:0});
}else if(mode==='run'){
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(process.version,'v24.13.0');verifySnapshot('activation');
  const lock=readJson('activation/LOCK.json');assert.equal(digest(lock.manifest),lock.manifestHash);assert.equal(lock.commit,process.env.GITHUB_SHA);assert.equal(lock.invocationId,process.env.GITHUB_RUN_ID);
  assert.equal(sha256(fs.readFileSync(inputZip)),lock.manifest.inputZipSha256);assert.deepEqual(inputs(),lock.manifest.inputs);
  const chunk=Number(process.env.R17_CHUNK),block=readJson('activation/BLOCKS.json')[chunk];assert.equal(block.index,chunk);
  assert.deepEqual(block.tasks,tasksFor(lock.manifest.inputs[block.input],block.input,block.repeat));process.env.INPUT_ARTIFACT_ID='r17-'+chunk;
  execFileSync('python',['tools/secondary-bench/common/triage/prepare-factorial.py'],{stdio:'inherit'});
  fs.mkdirSync('evidence');writeJson('evidence/LOCK.json',lock);writeJson('evidence/BLOCK.json',block);
  for(const name of ['PRODUCT_PATCHES.json','FACTOR_PATCHES.json'])fs.copyFileSync(name,'evidence/'+name);
  assert.equal(sha256(fs.readFileSync('FACTOR_PATCHES.json')),lock.manifest.factorPatchSha256,'frozen diagnostic product hashes');
  const client=(await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
  writeJson('evidence/ENVIRONMENT.json',{node:process.version,cpus:os.cpus(),availableParallelism:os.availableParallelism(),totalMemory:os.totalmem(),cpuMax:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8'),commit:process.env.GITHUB_SHA,runnerName:process.env.RUNNER_NAME,chunk});
  const quarantine={oom:[],fatal:null},rows=[];
  try{
    for(const [position,task] of block.tasks.entries()){
      const directory=`evidence/part-${position}`;
      const result=await executeTask(lock,{phase:PHASE,index:chunk},task,'bundle',directory,quarantine,{jobStartedMs:Number(process.env.JOB_STARTED_MS),checkpointsRemaining:8-position});rows.push(...result);
      writeJson(directory+'/TASK.json',task);
      if(fs.existsSync('diagnostic-traces'))fs.renameSync('diagnostic-traces',directory+'/diagnostic-traces');
      const receipt=await deliver(deadlineClient(client,JOB.checkpointMs),directory,`evidence/transport/part-${position}.json`,{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:PHASE,chunk,part:position},{retentionDays:30},`triage-data-${CAMPAIGN}-${chunk}-${position}`);
      assert.equal(receipt.status,'UPLOADED','stop on checkpoint transport failure');
      assert(!quarantine.fatal,'stop on unsafe/invalid result');
    }
  }finally{
    writeJson('evidence/RESULT.json',{statuses:rows.map(r=>r.status),state:quarantine});
    await seal('evidence',{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:PHASE,chunk,name:'worker-final'});
    summary({chunk,statuses:rows.map(r=>r.status),state:quarantine});
  }
  assert.equal(rows.length,8);assert(rows.every(r=>['EXACT','TIMEOUT_CALL','OOM'].includes(r.status)),'incomplete block');
}else throw Error('unknown factorial mode');
