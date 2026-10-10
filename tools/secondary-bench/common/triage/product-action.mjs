import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {digest,readJson,writeJson,filesUnder,sha256,verifySources,artifactDigest} from '../contracts.mjs';
import {seal,verifySnapshot,deadlineClient,loadHistory} from '../evidence.mjs';
import {activate,validateLock} from '../manifest.mjs';
import {runChunk} from '../executor.mjs';
import {validateIntegration,integrationTasks,integrationChunks,selectIntegration,INTEGRATION_PHASES} from './product-integration.mjs';
const client=(await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode=process.env.INPUT_MODE,phase=process.env.INPUT_PHASE,repo=process.env.GITHUB_REPOSITORY,runId=process.env.GITHUB_RUN_ID;
const gh=args=>JSON.parse(execFileSync('gh',['api',...args],{encoding:'utf8',timeout:120000,maxBuffer:64*1024**2}));
const output=(k,v)=>fs.appendFileSync(process.env.GITHUB_OUTPUT,`${k}=${v}\n`);
function summary(title,v){console.log(title,JSON.stringify(v));if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## ${title}\n\n\`\`\`json\n${JSON.stringify(v,null,2)}\n\`\`\`\n`);}
async function upload(name,dir,identity){
  await seal(dir,identity);const r=await deadlineClient(client,300000).uploadArtifact(name,filesUnder(dir),path.resolve(dir),{retentionDays:30});
  return {artifactId:r.id,digest:'sha256:'+r.digest};
}
async function download(id,hash,dir){
  id=Number(id);hash=artifactDigest(hash);const meta=gh([`repos/${repo}/actions/artifacts/${id}`]);assert.equal(artifactDigest(meta.digest),hash);assert(!meta.expired);
  const r=await client.downloadArtifact(id,{path:path.resolve(dir),expectedHash:hash});assert(!r.digestMismatch);verifySnapshot(dir);
}
async function products(config){
  const m=readJson(config+'/MANIFEST.json');
  for(const [arm,dir] of [['DEV','dev-product'],['RC','rc-product']]){
    const a=m.integration.archives[arm],file=config+'/'+a.archive;
    if(!fs.existsSync(file)){
      const response=await fetch(`https://api.github.com/repos/${repo}/releases/assets/${a.assetId}`,{headers:{Accept:'application/octet-stream',Authorization:`Bearer ${process.env.GH_TOKEN}`},signal:AbortSignal.timeout(300000)});
      assert(response.ok);await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(file,{flags:'wx'}));
    }
    assert.equal(sha256(fs.readFileSync(file)),a.sha256);
    execFileSync('python',['-c',"import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);z.extractall(sys.argv[2])",file,dir],{timeout:120000});
  }
  verifySources(m.sourceFiles);return m;
}
function history(campaign){
  execFileSync(process.execPath,['tools/secondary-bench/download-artifacts.mjs',repo,runId,'history',`triage-data-${campaign}-`],
    {stdio:'inherit',timeout:90*60000,env:{...process.env,FOLLOWUP_STORAGE_GUARD:'1'}});
  return loadHistory('history',campaign);
}
const identities=m=>({campaignId:m.campaignId,invocationId:runId});
if(mode==='activate'){
  assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','rerun requires explicit continuation');
  assert.equal(process.env.GITHUB_REF_NAME,'experiment/secondary-routing-20261005');
  const marker=readJson('.github/secondary-triage/RC_START.json');assert.equal(marker.confirm,'RUN_RC_DEV_16VM');
  const active=['in_progress','queued','waiting','requested','pending'].flatMap(status=>gh(['--paginate','--slurp',`repos/${repo}/actions/runs?status=${status}&per_page=100`]).flatMap(p=>p.workflow_runs));
  assert(!active.some(r=>String(r.id)!==runId&&/secondary|triage|RC product/i.test(r.name)),'another benchmark is active');
  const locks=gh(['--paginate','--slurp',`repos/${repo}/actions/artifacts?name=triage-lock-RC_DEV_PRODUCT_20261011_R15&per_page=100`]).flatMap(p=>p.artifacts);assert.equal(locks.length,0,'campaign already activated');
  const response=await fetch(`https://api.github.com/repos/${repo}/releases/assets/${marker.assetId}`,{headers:{Accept:'application/octet-stream',Authorization:`Bearer ${process.env.GH_TOKEN}`},signal:AbortSignal.timeout(300000)});
  assert(response.ok);await pipeline(Readable.fromWeb(response.body),fs.createWriteStream('config.zip',{flags:'wx'}));
  assert.equal(sha256(fs.readFileSync('config.zip')),marker.bundleSha256);
  execFileSync('python',['tools/secondary-bench/followup-extract.py','config.zip','config',String(4*1024**3)],{timeout:120000});
  const m=validateIntegration(await products('config'));assert.equal(digest(m),marker.manifestHash);assert.equal(sha256(fs.readFileSync('config/TASKS.jsonl')),m.tasksHash);
  assert.equal(process.version,'v24.13.0');
  const lock=activate(m,'activation',{createdUtc:new Date().toISOString(),invocationId:runId,commit:process.env.GITHUB_SHA,confirm:true});
  fs.copyFileSync('activation/LOCK.json','config/LOCK.json');
  const r=await upload(`triage-lock-${m.campaignId}`,'config',{...identities(m),name:'activation'});output('artifact-id',r.artifactId);output('digest',r.digest);
  summary('RC activation (no smoke / no solver)',{manifestHash:lock.manifestHash,inputs:m.inputs.length,maxCalls:m.maxCalls,originUtc:lock.originUtc,endUtc:lock.endUtc});
} else if(mode==='plan'){
  await download(process.env.CONFIG_ID,process.env.CONFIG_DIGEST,'config');const lock=validateLock(readJson('config/LOCK.json')),m=lock.manifest;
  assert(INTEGRATION_PHASES.includes(phase));const templates=fs.readFileSync('config/TASKS.jsonl','utf8').trim().split('\n').map(JSON.parse);
  let selected=null;
  if(phase!=='RC_INITIAL_1'){
    const h=history(m.campaignId);assert(!h.unknown.length&&!h.warnings.length,'incomplete previous evidence');
    const previous=INTEGRATION_PHASES[INTEGRATION_PHASES.indexOf(phase)-1];
    const plans=filesUnder('history').filter(p=>p.endsWith('STAGE_PLAN.json')).map(readJson);
    const plan=plans.find(p=>p.phase===previous);assert(plan,'prior round plan missing');
    assert.equal(h.rows.filter(r=>r.phase===previous).length,plan.expectedCalls.length,'prior round not complete');
    assert(h.rows.every(r=>['EXACT','TIMEOUT_CALL','TIMEOUT_STARTUP','INCOMPLETE','OOM','NOT_RUN_AFTER_OOM'].includes(r.status)),'unsafe prior execution');
    if(phase.startsWith('RC_CONFIRMATION')){
      const selection=selectIntegration(m,h.rows);selected=selection.selected;
      writeJson('plan/SELECTION.json',{phase,...selection});
    }
  }
  const tasks=integrationTasks(m,templates,phase,selected),chunks=integrationChunks(tasks,m.job),matrix=[];
  for(const [index,c] of chunks.entries()){
    // Payload contains only commands/fixtures for this worker and the locked sources.
    const dir='payload-'+index;fs.mkdirSync(dir);fs.copyFileSync('config/LOCK.json',dir+'/LOCK.json');fs.copyFileSync('config/MANIFEST.json',dir+'/MANIFEST.json');
    for(const id of new Set(c.tasks.flatMap(t=>t.calls.map(r=>r.inputId)))){
      const ref=m.inputs.find(r=>r.id===id);const command=readJson('config/'+ref.member);
      for(const member of [ref.member,...command.fixtures.map(f=>f.member)]){
        fs.mkdirSync(path.dirname(dir+'/'+member),{recursive:true});fs.copyFileSync('config/'+member,dir+'/'+member);
      }
    }
    writeJson(dir+'/CHUNK.json',{manifestHash:lock.manifestHash,phase,index,tasks:c.tasks,hash:digest(c.tasks)});
    const r=await upload(`triage-payload-${m.campaignId}-${phase}-${index}`,dir,{...identities(m),name:`payload-${phase}-${index}`});
    matrix.push({index,...r});fs.rmSync(dir,{recursive:true});
  }
  writeJson('plan/STAGE_PLAN.json',{phase,manifestHash:lock.manifestHash,expectedCalls:tasks.flatMap(t=>t.calls),chunks:chunks.length,matrix});
  await upload(`triage-data-${m.campaignId}-${phase}-plan`,'plan',{...identities(m),name:`plan-${phase}`});
  output('matrix',JSON.stringify(matrix));output('has-work',String(matrix.length>0));summary('Round plan',{phase,calls:tasks.length*2,workers:matrix.length});
} else if(mode==='run'){
  await download(process.env.INPUT_ARTIFACT_ID,process.env.INPUT_DIGEST,'bundle');const m=await products('bundle'),lock=validateLock(readJson('bundle/LOCK.json'));
  const chunk=readJson('bundle/CHUNK.json');
  writeJson('environment/ENVIRONMENT.json',{node:process.version,platform:process.platform,commit:process.env.GITHUB_SHA,
    cpus:os.cpus().map(c=>({model:c.model,speed:c.speed})),runnerId:`${runId}/${process.env.GITHUB_JOB}/${process.env.INPUT_ARTIFACT_ID}`,
    sourceVerified:true,phase:chunk.phase,chunk:chunk.index});
  await upload(`triage-data-${m.campaignId}-${chunk.phase}-${chunk.index}-environment`,'environment',{...identities(m),name:`environment-${chunk.phase}-${chunk.index}`});
  const result=await runChunk('bundle','execution',client,{jobStartedMs:Number(process.env.JOB_STARTED_MS)});
  assert.equal(result.status,'ALL_DURABLE');assert(!result.state.fatal,'unsafe/invalid result: '+result.state.fatal);
} else if(mode==='audit'){
  await download(process.env.CONFIG_ID,process.env.CONFIG_DIGEST,'config');const m=await products('config');history(m.campaignId);
  let exit=0;try{execFileSync('python',['tools/secondary-bench/common/triage/product-audit.py','--config','config','--history','history','--out','audit'],{stdio:'inherit',timeout:100*60000});}catch(e){exit=e.status??1;}
  assert(fs.existsSync('audit/INDEPENDENT_AUDIT.json'),'auditor did not produce a report');const r=readJson('audit/INDEPENDENT_AUDIT.json');
  await upload(`triage-independent-${m.campaignId}-FINAL`,'audit',{...identities(m),name:'independent-audit'});summary('Independent product evidence audit',r);
  fs.mkdirSync('report');fs.copyFileSync('audit/REPORT.json','report/REPORT.json');
  await upload(`triage-final-${m.campaignId}`,'report',{...identities(m),name:'final-report'});
  if(exit)process.exitCode=exit;
} else throw new Error('unknown product action mode');
