import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest,sha256,writeJson,readJson} from '../contracts.mjs';
import {executeTask} from '../executor.mjs';
import {profileForTriage} from './protocol.mjs';
import {seal,verifySnapshot,deliver,deadlineClient} from '../evidence.mjs';
import {CAMPAIGN,JOB,blocksFor,phaseFor,validateReservation} from './rc2-plan.mjs';
import {optionalFile} from './factorial-environment.mjs';
const mode=process.argv[2];validateReservation();
const summary=v=>{console.log(JSON.stringify(v));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## RC2 validation\n\n\`\`\`json\n${JSON.stringify(v,null,2)}\n\`\`\`\n`);};
const prepare=()=>execFileSync('python',['tools/secondary-bench/common/triage/prepare-rc2.py'],{stdio:'inherit'});
function extract(){execFileSync('python',['tools/secondary-bench/followup-extract.py','activation/INPUTS.zip','bundle',String(4*1024**3)],{stdio:'inherit'});return readJson('bundle/INPUTS.json').inputs;}
if(mode==='plan'){
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','new invocation/explicit continuation required');
  const marker=readJson('.github/secondary-triage/R18_START.json');assert.equal(marker.confirm,'RUN_RC2_12VM');assert.equal(marker.maxParallel,12);
  assert.equal(sha256(fs.readFileSync('tools/secondary-bench/common/triage/rc2-selection.json')),marker.selectionSha256);
  prepare();assert.equal(sha256(fs.readFileSync('PRODUCTS.json')),marker.productsSha256);
  fs.mkdirSync('activation');fs.copyFileSync('PRODUCTS.json','activation/PRODUCTS.json');
  // Reuse the original Actions activation. No releases or temporary asset publishing.
  const metadata=JSON.parse(execFileSync('gh',['api',`repos/Qnia28/sfinder_wasm/actions/artifacts/${marker.parentArtifactId}`],{encoding:'utf8'}));
  assert.equal(metadata.digest,marker.parentArtifactDigest);assert(!metadata.expired);
  const fd=fs.openSync('parent.zip','wx');
  try{execFileSync('gh',['api',`repos/Qnia28/sfinder_wasm/actions/artifacts/${marker.parentArtifactId}/zip`],{stdio:['ignore',fd,'inherit'],timeout:600000});}finally{fs.closeSync(fd);}
  assert.equal('sha256:'+sha256(fs.readFileSync('parent.zip')),marker.parentArtifactDigest);
  execFileSync('python',['tools/secondary-bench/followup-extract.py','parent.zip','parent',String(4*1024**3)],{stdio:'inherit'});verifySnapshot('parent');
  assert.equal(digest(readJson('parent/MANIFEST.json')),'e7af6680ea615fe79fe3c4becd4af661d033493448fafb197f350b3c8469e988');
  execFileSync('python',['tools/secondary-bench/common/triage/prepare-rc2-inputs.py','--source','parent','--selection','tools/secondary-bench/common/triage/rc2-selection.json','--out','activation/INPUTS.zip'],{stdio:'inherit'});
  fs.rmSync('parent',{recursive:true});fs.rmSync('parent.zip');
  const inputs=extract();assert.equal(digest(inputs),marker.inputsHash);
  const originMs=Date.now(),manifest={schemaVersion:1,campaignId:CAMPAIGN,revision:18,validation:{id:'rc2-linmax-release-v1'},inputs,job:JOB,
    maxParallel:12,measurementMaxParallel:11,maxCalls:1560,maxRunnerHours:392,overallMs:72*3600000,approval:'USER_START_APPROVED_130_INPUTS_DEV_RC2_6_REPEATS',
    parentRunIds:[38072016117,38227051624],newCampaign:true,priorExperiments:'PRESERVED_IN_LEDGER_NOT_REEXECUTED',
    accountingScope:'R16_R17_R18_LINEAGE_EXCLUDES_SEPARATE_R15_HISTORICAL_RESERVATION',priorReservedCalls:272,priorReservedRunnerHours:93,cumulativeReservedCalls:1832,cumulativeReservedRunnerHours:485,
    productsSha256:marker.productsSha256,products:{DEV:'7ef62d18e1d155b6479e00d651c851ff3baa7112',RC2:'8b021b465ba91232c3505598add0b697a5b0da96'},
    selectionSha256:marker.selectionSha256,parentArtifactId:marker.parentArtifactId,parentArtifactDigest:marker.parentArtifactDigest,
    inputsHash:marker.inputsHash,inputZipSha256:sha256(fs.readFileSync('activation/INPUTS.zip')),automaticPromotion:false,diagnosticPatches:0,rounds:3,repeatsPerRound:2};
  manifest.profileContract=profileForTriage(manifest);
  const lock={manifest,manifestHash:digest(manifest),profileHash:digest(manifest.profileContract),invocationId:process.env.GITHUB_RUN_ID,commit:process.env.GITHUB_SHA,originMs,endMs:originMs+manifest.overallMs,endUtc:new Date(originMs+manifest.overallMs).toISOString()};
  const blocks=[1,2,3].flatMap(round=>blocksFor(inputs,round));
  writeJson('activation/LOCK.json',lock);writeJson('activation/MANIFEST.json',manifest);writeJson('activation/BLOCKS.json',blocks);
  writeJson('activation/STAGE_PLAN.json',{manifestHash:lock.manifestHash,expectedCalls:blocks.flatMap(b=>b.tasks.flatMap(t=>t.calls))});
  fs.copyFileSync('tools/secondary-bench/common/triage/rc2-selection.json','activation/SELECTION.json');
  await seal('activation',{campaignId:CAMPAIGN,invocationId:lock.invocationId,name:'activation'});
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'matrix='+JSON.stringify(blocks.filter(b=>b.round===1).map(b=>({index:b.index})))+'\n');
  summary({inputs:130,calls:1560,measurementJobs:78,maxParallel:12,reservedRunnerHours:392,originMs,endUtc:lock.endUtc,diagnosticPatches:0});
}else if(mode==='run'){
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(process.version,'v24.13.0');
  for(const name of ['SECONDARY_MEMORY_DIRECTORY','SECONDARY_MEMORY_MODULE','SECONDARY_REGRESSION_DIRECTORY'])assert(!process.env[name],'diagnostics must be disabled');
  verifySnapshot('activation');const lock=readJson('activation/LOCK.json');assert.equal(digest(lock.manifest),lock.manifestHash);assert.equal(lock.commit,process.env.GITHUB_SHA);assert.equal(lock.invocationId,process.env.GITHUB_RUN_ID);
  assert.equal(sha256(fs.readFileSync('activation/INPUTS.zip')),lock.manifest.inputZipSha256);assert.deepEqual(extract(),lock.manifest.inputs);
  const round=Number(process.env.R18_ROUND),index=Number(process.env.R18_CHUNK),block=readJson('activation/BLOCKS.json').find(b=>b.round===round&&b.index===index);
  assert.deepEqual(block,blocksFor(lock.manifest.inputs,round)[index]);process.env.INPUT_ARTIFACT_ID=`r18-${round}-${index}`;
  prepare();assert.equal(sha256(fs.readFileSync('PRODUCTS.json')),lock.manifest.productsSha256);
  fs.mkdirSync('evidence');writeJson('evidence/LOCK.json',lock);writeJson('evidence/BLOCK.json',block);fs.copyFileSync('PRODUCTS.json','evidence/PRODUCTS.json');
  writeJson('evidence/ENVIRONMENT.json',{node:process.version,cpus:os.cpus(),availableParallelism:os.availableParallelism(),totalMemory:os.totalmem(),cpuMax:optionalFile('/sys/fs/cgroup/cpu.max'),selfCgroup:optionalFile('/proc/self/cgroup'),commit:process.env.GITHUB_SHA,runnerName:process.env.RUNNER_NAME,round,index});
  const client=(await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
  const quarantine={oom:[],fatal:null},rows=[];
  try{
    for(const [part,task] of block.tasks.entries()){
      const directory=`evidence/part-${part}`;
      rows.push(...await executeTask(lock,{phase:phaseFor(round),index},task,'bundle',directory,quarantine,{jobStartedMs:Number(process.env.JOB_STARTED_MS),checkpointsRemaining:block.tasks.length-part}));
      writeJson(directory+'/TASK.json',task);
      const receipt=await deliver(deadlineClient(client,JOB.checkpointMs),directory,`evidence/transport/part-${part}.json`,{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:phaseFor(round),chunk:index,part},{retentionDays:30},`triage-data-${CAMPAIGN}-${round}-${index}-${part}`);
      assert.equal(receipt.status,'UPLOADED','stop on checkpoint transport failure');assert(!quarantine.fatal,'stop on unsafe/invalid result');
    }
  }finally{
    writeJson('evidence/RESULT.json',{statuses:rows.map(r=>r.status),state:quarantine});await seal('evidence',{campaignId:CAMPAIGN,invocationId:lock.invocationId,phase:phaseFor(round),chunk:index,name:'worker-final'});
    summary({round,index,statuses:rows.map(r=>r.status),state:quarantine});
  }
  assert.equal(rows.length,20);assert(rows.every(r=>['EXACT','TIMEOUT_CALL','OOM'].includes(r.status)),'incomplete worker block');
}else throw Error('unknown RC2 operation');
