import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { digest, readJson, writeJson, filesUnder, safePath, sha256, verifySources, artifactDigest } from '../contracts.mjs';
import { seal, verifySnapshot, loadHistory, deadlineClient, historyReservation } from '../evidence.mjs';
import { activate as activateCommon, validateLock as validateCommonLock } from '../manifest.mjs';
import { requireDisk } from '../../followup-storage.mjs';
import { validateManifest, validateLock, PROFILE, PHASES, chunksFor, compileTasks } from './protocol.mjs';
import { prerequisiteGate, selectConfirmation, developmentReport } from './analysis.mjs';
import { runChunk } from './executor.mjs';
import { isolatedScope } from '../../followup-scope.mjs';
import { verifyReuse, collectedHistory } from './reuse.mjs';
import { fastParent } from './fast-followup.mjs';
import { largeParent, isMemoryRun, largePhase } from './large-run.mjs';

const tool = file => fileURLToPath(new URL(file, import.meta.url));
const client = (await import('../../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode = process.env.INPUT_MODE, phase = process.env.INPUT_PHASE;
const repo = process.env.GITHUB_REPOSITORY, runId = process.env.GITHUB_RUN_ID;
const output = (name,value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
const gh = args => JSON.parse(execFileSync('gh', ['api', ...args], { encoding:'utf8',timeout:120000,maxBuffer:64*1024**2 }));
function summarize(title, report) {
  const calibration=report.calibration??report.prerequisiteAssessments?.CALIBRATION?.calibration;
  const summary={status:report.status,evidenceStatus:report.evidenceStatus,executionCompleteness:report.executionCompleteness,
    decisionStatus:report.decisionStatus,performancePass:report.performancePass,reason:report.reason,
    errors:report.errors,missing:report.missing,phaseCompleteness:report.phaseCompleteness,
    ...(calibration?{calibration:{...calibration,observations:calibration.observations.filter(i=>i.exceedsScreen||i.issues.length)}}:{})};
  console.log(title,JSON.stringify(summary));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## ${title}\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
}
async function fileHash(file) { const h=createHash('sha256'); for await(const b of fs.createReadStream(file))h.update(b); return h.digest('hex'); }
async function upload(name,dir,limit=180000) {
   const config=fs.existsSync('config/MANIFEST.json')?'config/MANIFEST.json':fs.existsSync('bundle/LOCK.json')?'bundle/LOCK.json':null;
   const loaded=config?readJson(config):null;
   await seal(dir,{campaignId:loaded?.campaignId??loaded?.manifest?.campaignId??'TRIAGE_PROBE_SEED_AB_20261006_R1',runId,name});
  const result=await deadlineClient(client,limit).uploadArtifact(name,filesUnder(dir),path.resolve(dir),{retentionDays:30});
  return {artifactId:result.id,digest:'sha256:'+result.digest};
}
async function download(id,hash,dir) {
  id=Number(id); assert(Number.isSafeInteger(id)&&id>0); hash=artifactDigest(hash);
  const meta=gh([`repos/${repo}/actions/artifacts/${id}`]); assert.equal(artifactDigest(meta.digest),hash); assert(!meta.expired);
  requireDisk(process.cwd(),meta.size_in_bytes); const staging=dir+'-zip'; fs.mkdirSync(staging);
  const result=await client.downloadArtifact(id,{path:path.resolve(staging),expectedHash:hash,skipDecompress:true}); assert(!result.digestMismatch);
  const names=fs.readdirSync(staging); assert.equal(names.length,1); const zip=path.join(staging,names[0]);
  execFileSync('python',[tool('../../followup-extract.py'),zip,dir,String(4*1024**3)],{timeout:120000});
  fs.unlinkSync(zip); fs.rmdirSync(staging); verifySnapshot(dir);
}
function downloadHistory(campaignId) {
  execFileSync(process.execPath,[tool('../../download-artifacts.mjs'),repo,runId,'history',`triage-data-${campaignId}-`],
    {stdio:'inherit',timeout:80*60000,env:{...process.env,FOLLOWUP_STORAGE_GUARD:'1'}});
}
function getHistory(campaignId, strict = true) {
  downloadHistory(campaignId);
  const history=loadHistory('history',campaignId);
  if (strict) assert(!history.warnings.length&&!history.unknown.length,'incomplete execution history');
  return collectedHistory(validateLock(readJson('config/LOCK.json')),history);
}
async function cpPreflight(directory, identity, memoryDiagnostic = false) {
  const callId = digest({ runId, identity, check: 'CP_SYNTHETIC_PREFLIGHT_V1' });
  const result = await isolatedScope({ callId, job: { action: 'cp-preflight',...(memoryDiagnostic?{memoryDiagnostic:'cp-memory-v1'}:{}) },
    limits: { startupMs: 10000, callMs: 30000, reapMs: 5000 }, phaseLimits: {},
    contractChildFile: 'tools/secondary-bench/common/triage/cp-preflight-child.mjs' }, directory);
  if (result.status !== 'EXACT' || !result.reaped || result.result?.cpPreflight !== 'PASS')
    { console.error('CP_PREFLIGHT_FAILED',JSON.stringify(result));
      await upload(`triage-data-TRIAGE_PROBE_SEED_AB_20261006_R1-cp-preflight-failed-${callId}`,directory); }
  assert(result.status === 'EXACT' && result.reaped && result.result?.cpPreflight === 'PASS',
    'CP actual worker/scope preflight failed: ' + JSON.stringify(result));
  if (memoryDiagnostic) {
    const streams=fs.readdirSync(directory).filter(n=>/^memory-.*\.jsonl$/.test(n));assert.equal(streams.length,1);
    const rows=fs.readFileSync(path.join(directory,streams[0]),'utf8').trim().split('\n').map(JSON.parse);
    for (const stage of ['rows-expand-end','stage-model-ready','encode-end','wasm-copy-end','native-solve-enter','native-solve-return','trace-close'])
      assert(rows.some(r=>r.stage===stage),'missing diagnostic preflight stage '+stage);
    assert(rows.every(r=>r.role==='cpsat'&&r.cgroupCurrent>0&&r.memory.heapUsed>0));
    writeJson(path.join(directory,'MEMORY_PREFLIGHT.json'),{status:'PASS',events:rows.length,solverCallsAdded:0});
  }
  return result;
}
function cloneBaseline(config) {
  fs.mkdirSync('triage-baseline');
  for(const dir of ['src','wasm'])fs.cpSync(dir,path.join('triage-baseline',dir),{recursive:true});
  fs.copyFileSync('package.json','triage-baseline/package.json');
  for(const f of config.manifest.baselineFiles) {
    const bytes=fs.readFileSync(safePath('bundle',f.member)); assert.equal(sha256(bytes),f.sha256);
    fs.writeFileSync(safePath('triage-baseline',f.destination),bytes);
  }
}
let watchdog;
try {
  if(mode==='activate') {
    assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1','rerun forbidden: explicit new continuation design required');
    assert.equal(process.env.GITHUB_REF_NAME,'experiment/secondary-routing-20261005','experiment branch only');
    const marker=readJson('.github/secondary-triage/START.json');
    const confirm=process.env.INPUT_CONFIRM||marker.confirm;
    assert.equal(confirm,'RUN_TRIAGE_PROBE_SEED_16VM');
    const assetId=Number(process.env.INPUT_ASSET_ID||marker.assetId); assert(Number.isSafeInteger(assetId)&&assetId>0);
    const active=['in_progress','queued','waiting','requested','pending'].flatMap(status=>gh(['--paginate','--slurp',`repos/${repo}/actions/runs?status=${status}&per_page=100`]).flatMap(p=>p.workflow_runs));
    assert(!active.some(r=>String(r.id)!==runId&&/secondary|triage/i.test(r.name)),'other benchmark VM allocation active');
    const meta=gh([`repos/${repo}/releases/assets/${assetId}`]); requireDisk(process.cwd(),meta.size);
    const response=await fetch(`https://api.github.com/repos/${repo}/releases/assets/${assetId}`,{headers:{Accept:'application/octet-stream',Authorization:`Bearer ${process.env.GH_TOKEN}`},signal:AbortSignal.timeout(180000)});
    assert(response.ok); await pipeline(Readable.fromWeb(response.body),fs.createWriteStream('config.zip',{flags:'wx'}));
    assert.equal(await fileHash('config.zip'),marker.bundleSha256,'release bundle changed');
    execFileSync('python',[tool('../../followup-extract.py'),'config.zip','config',String(4*1024**3)],{timeout:120000}); fs.unlinkSync('config.zip');
    const m=validateManifest(readJson('config/MANIFEST.json')); verifySources(m.sourceFiles);
    const priorLocks=gh(['--paginate','--slurp',`repos/${repo}/actions/artifacts?name=triage-lock-${m.campaignId}&per_page=100`]).flatMap(p=>p.artifacts);
    assert(!m.startupContinuation,'r4 dedicated repair route is superseded; use indexed common continuation');
    const continuation=m.continuation;
     const parent=m.largeRun?validateCommonLock(largeParent(m)):m.followup?validateCommonLock(fastParent(m)):continuation?validateCommonLock(readJson(continuation.parentLock)):null;
    const parentArtifact=m.provenance.parentLockArtifact;
    const allowedLocks=new Set([parentArtifact?.id,...(m.provenance.ancestorLockArtifacts??[]).map(a=>a.id)]);
    assert(!priorLocks.some(a=>a.name===`triage-lock-${m.campaignId}`&&!allowedLocks.has(a.id)),
      'campaign already activated; never reset its origin with another dispatch');
     if(continuation || m.followup || m.largeRun) {
      const prior=gh([`repos/${repo}/actions/runs/${parent.invocationId}`]);
       assert.equal(prior.status,'completed');assert.equal(prior.conclusion,isMemoryRun(m)?'failure':m.largeRun?'success':'failure');assert.equal(prior.run_attempt,isMemoryRun(m)&&!m.largeRun.recoveryRunId?2:1);
      assert.equal(parent.commit,prior.head_sha);
      const backend=gh([`repos/${repo}/actions/artifacts/${parentArtifact.id}`]);
      assert.equal(artifactDigest(backend.digest),parentArtifact.digest);assert.equal(backend.workflow_run.id,prior.id);assert(!backend.expired);
      for(const ancestor of m.provenance.ancestorLockArtifacts??[]) {
        const a=gh([`repos/${repo}/actions/artifacts/${ancestor.id}`]);
        assert.equal(artifactDigest(a.digest),ancestor.digest);assert(!a.expired);
        assert(parent.ancestorLocks.some(l=>l.invocationId===String(a.workflow_run.id)),'foreign ancestor backend');
      }
       const single=m.largeRun??m.followup;
       const reservation=single?{calls:single.priorCalls,unknown:[],warnings:[],statuses:{}}:historyReservation(m);
       if (!single) assert(m.provenance.priorReservedRunnerHours+13*2.5<=36*2.5,'prior runner allocations exceed original control reserve');
      writeJson('config/PARENT_VALIDATION.json',{status:'PASS',parentArtifact:backend,parentRun:prior,
        reservedCalls:reservation.calls,priorUnknown:reservation.unknown,priorWarnings:reservation.warnings,priorStatuses:reservation.statuses,
        priorEvidencePooled:false,priorEvidenceReclassified:false,solverCalls:0});
    }
    assert.equal(digest(m),marker.manifestHash); assert.equal(m.tasksHash,sha256(fs.readFileSync('config/TASKS.jsonl')));
    assert.equal(process.version,'v24.13.0','runtime lock');
    const run=gh([`repos/${repo}/actions/runs/${runId}`]);
    const recovery=m.activationRecovery;
    if(recovery) {
      assert.equal(recovery.populationCalls,0,'activation-only recovery may not replay population calls');
      for(const id of recovery.priorRunIds) {
        const prior=gh([`repos/${repo}/actions/runs/${id}`]);
        assert.equal(prior.status,'completed');assert.equal(prior.conclusion,'failure');
        const artifacts=gh(['--paginate','--slurp',`repos/${repo}/actions/runs/${id}/artifacts?per_page=100`]).flatMap(p=>p.artifacts);
        assert(!artifacts.some(a=>a.name.startsWith('triage-lock-')||/-(CANARY|CALIBRATION|ALL_INITIAL|PER_SAVE_INITIAL|SEED_DIAGNOSTIC|TRIVIAL_CONTRACT|ALL_CONFIRMATION|PER_SAVE_CONFIRMATION)-\d+-\d+-t\d+$/.test(a.name)),
          'recovery requires separate continuation design if population evidence or activation lock exists');
      }
      assert.equal(recovery.originUtc,gh([`repos/${repo}/actions/runs/${recovery.priorRunIds[0]}`]).created_at);
    }
     assert(continuation || m.followup || m.largeRun,'resumption requires frozen parent evidence');
    const lock=activateCommon(m,'common-activation',{createdUtc:run.created_at,invocationId:runId,commit:process.env.GITHUB_SHA,confirm:true});
    fs.copyFileSync('common-activation/LOCK.json','config/LOCK.json');
     if (!m.followup && !m.largeRun) {
       execFileSync(process.execPath,['--test','tests/triage-bench.test.mjs'],{stdio:'inherit',timeout:120000});
       execFileSync('python',['-B','tests/triage-independent-audit.test.py'],{stdio:'inherit',timeout:120000});
     }
     writeJson('config/SYNTHETIC_GATE.json',{status:m.followup||m.largeRun?'LOCAL_CONTRACT_CHECK_NOT_REPEATED':'PASS',populationCalls:0,
       solverCalls:m.followup||m.largeRun?0:'LIGHTWEIGHT_SYNTHETIC_TESTS_ONLY'});
    const reuse=verifyReuse(m);
    const cp = reuse ? readJson('config/continuation/PARENT_CP_PREFLIGHT.json') : await cpPreflight('config/cp-preflight', 'activation',isMemoryRun(m));
    if(reuse) writeJson('config/PREREQUISITE_REUSE.json',{status:'PASS',parentInvocationId:reuse.parent.invocationId,
      originalManifestHash:reuse.parent.manifestHash,phases:m.prerequisiteReuse.phases,
      reusedCalls:reuse.rows.length,solverCalls:0,newCpSyntheticCalls:0,priorCpSyntheticCalls:m.provenance.priorCpSyntheticCalls});
    writeJson('config/CP_PREFLIGHT.json',cp);
    const receipt=await upload('triage-lock-'+m.campaignId,'config',15*60000);
     output('artifact-id',receipt.artifactId);output('digest',receipt.digest);
     output('fast-followup',String(Boolean(m.followup)));
      output('large-run',String(Boolean(m.largeRun)));
      output('large-phase',m.largeRun?largePhase(m):'');
  } else if(mode==='plan') {
    await download(process.env.INPUT_ARTIFACT_ID,process.env.INPUT_DIGEST,'config');
    const lock=validateLock(readJson('config/LOCK.json')); verifySources(lock.manifest.sourceFiles);
    const templates=fs.readFileSync('config/TASKS.jsonl','utf8').trim().split('\n').map(JSON.parse);
    const reuse=verifyReuse(lock.manifest);
    if(reuse&&lock.manifest.prerequisiteReuse.phases.includes(phase)) {
      summarize(phase+' reused immutable prerequisites',{status:'PASS',performancePass:false,
        originalInvocationId:reuse.parent.invocationId,solverCalls:0});
      output('matrix',JSON.stringify({include:[]}));output('has-work','false');
      process.exit(0);
    }
    let history={rows:[]}, selected=null;
     if(phase!=='CANARY' && !lock.manifest.followup && !lock.manifest.largeRun) history=getHistory(lock.manifest.campaignId);
    const required=phase==='CALIBRATION'?'CANARY':phase==='ALL_INITIAL'?'CALIBRATION':null;
    if(required) {
      const expected=templates.filter(t=>t.phase===required).reduce((n,t)=>n+t.calls,0);
      const rows=history.rows.filter(r=>r.phase===required); assert.equal(rows.length,expected);
      const gate=prerequisiteGate(rows,required,{cpPreflight:readJson('config/CP_PREFLIGHT.json'),gateContract:lock.manifest.gateContract});
      writeJson('gate/GATE.json',gate);
      summarize(required+' execution validity',gate);
      await upload(`triage-data-${lock.manifest.campaignId}-${required}-gate`,'gate');
      assert.equal(gate.status,'PASS',JSON.stringify(gate));
    }
    if(phase.endsWith('CONFIRMATION')) {
      const initial=phase==='ALL_CONFIRMATION'?'ALL_INITIAL':'PER_SAVE_INITIAL';
      const expected=templates.filter(t=>t.phase===initial).reduce((n,t)=>n+t.calls,0);
      assert.equal(history.rows.filter(r=>r.phase===initial).length,expected,'initial incomplete: no retest selection');
      const decision=selectConfirmation(lock.manifest,history.rows,initial);selected=decision.selected;
      writeJson('selection/SELECTION.json',{phase,...decision}); await upload(`triage-data-${lock.manifest.campaignId}-${phase}-selection`,'selection');
    }
    const chunks=chunksFor(lock.manifest,templates,phase,selected);
    // Budget reservation is immutable and includes every control + matrix job.
    const prior=filesUnder('history').filter(f=>path.basename(f)==='STAGE_PLAN.json').map(readJson);
    assert(!prior.some(p=>p.phase===phase),'stage replay forbidden');
    const reserved=prior.reduce((n,p)=>n+p.chunks,0)+chunks.length;
    assert(Date.now()<lock.endMs-lock.manifest.job.finalTransportMs,'campaign deadline expired');
    const expectedCalls=chunks.flatMap(c=>c.tasks.flatMap(t=>t.calls));
     const followup=lock.manifest.largeRun??lock.manifest.followup;
     const parentReservation=followup?{calls:followup.priorCalls+(followup.priorCpCalls??0)+(followup.newCpCalls??1)}:historyReservation(lock.manifest);
     assert(followup ? followup.priorRunnerHours+reserved*lock.manifest.job.jobMinutes/60+followup.controlHours<=lock.manifest.maxRunnerHours
       : (reserved+36)*2.5<=lock.manifest.maxRunnerHours,'runner-hour reservation exceeded');
     if (followup) { assert.equal(expectedCalls.length,followup.calls); assert.equal(chunks.length,followup.chunks); }
    assert(parentReservation.calls+prior.reduce((n,p)=>n+p.expectedCalls.length,0)+expectedCalls.length<=lock.manifest.maxCalls,
      'cumulative call cap exceeded; required confirmation selection may not be silently reduced');
    const matrix=[];
    for(const [index,chunk] of chunks.entries()) {
      const dir=`payload-${index}`;fs.mkdirSync(dir);writeJson(dir+'/LOCK.json',lock);
      writeJson(dir+'/CHUNK.json',{phase,index,manifestHash:lock.manifestHash,tasks:chunk.tasks,hash:digest(chunk.tasks)});
      for(const call of chunk.tasks.flatMap(t=>t.calls)) {
        const ref=lock.manifest.inputs.find(f=>f.id===call.inputId), dest=safePath(dir,ref.member);
        if(!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.linkSync(safePath('config',ref.member),dest);}
      }
      for(const f of lock.manifest.baselineFiles){const dest=safePath(dir,f.member);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(safePath('config',f.member),dest);}
      const receipt=await upload(`triage-payload-${lock.manifest.campaignId}-${phase}-${index}`,dir);matrix.push({index,...receipt});
      // Delete only files created for this exact payload; inputs remain in config.
      for(const file of filesUnder(dir))fs.unlinkSync(file);
      const removeEmpty=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true}))if(e.isDirectory())removeEmpty(path.join(d,e.name));fs.rmdirSync(d);};removeEmpty(dir);
    }
    writeJson('plan/STAGE_PLAN.json',{phase,chunks:chunks.length,expectedCalls,manifestHash:lock.manifestHash,reservedMatrixJobs:reserved,matrix});
    await upload(`triage-data-${lock.manifest.campaignId}-${phase}-plan`,'plan',180000);
    output('matrix',JSON.stringify({include:matrix}));output('has-work',String(matrix.length>0));
  } else if(mode==='run') {
    await download(process.env.INPUT_ARTIFACT_ID,process.env.INPUT_DIGEST,'bundle');
    const lock=validateLock(readJson('bundle/LOCK.json'));verifySources(lock.manifest.sourceFiles);
     if (!lock.manifest.followup && !lock.manifest.largeRun) cloneBaseline(lock);
    const jobStartedMs=Number(process.env.INPUT_JOB_STARTED_MS); assert(Number.isFinite(jobStartedMs));
    const remaining=jobStartedMs+lock.manifest.job.jobMs+lock.manifest.job.finalTransportMs+lock.manifest.job.transportAuditMs-Date.now();assert(remaining>0);
    watchdog=setTimeout(()=>process.exit(1),remaining);
    writeJson('runner/ENVIRONMENT.json',{node:process.version,v8:process.versions.v8,platform:process.platform,
      image:process.env.ImageVersion??null,cpu:execFileSync('lscpu',{encoding:'utf8'}),os:fs.readFileSync('/etc/os-release','utf8'),
      jobStartedMs,commit:process.env.GITHUB_SHA});
    if (phase === 'CANARY') writeJson('runner/CP_PREFLIGHT.json',await cpPreflight('runner/cp-preflight',process.env.INPUT_ARTIFACT_ID));
    await upload(`triage-data-${lock.manifest.campaignId}-${phase}-${process.env.GITHUB_JOB}-${process.env.INPUT_ARTIFACT_ID}-environment`,'runner');
    const report=await runChunk('bundle','results',client,{jobStartedMs});
    if(report.status!=='ALL_DURABLE'||report.state.fatal)process.exitCode=1;
  } else if(mode==='independent-audit') {
    await download(process.env.INPUT_ARTIFACT_ID,process.env.INPUT_DIGEST,'config');
    const lock=validateLock(readJson('config/LOCK.json'));verifySources(lock.manifest.sourceFiles);
    downloadHistory(lock.manifest.campaignId);
    let auditExit=0;
    try {
      execFileSync('python',[tool('./independent-audit.py'),'--config','config','--history','history','--out','independent',
        ...(['CANARY','CALIBRATION'].includes(phase)?['--phase',phase]:[])],{stdio:'inherit',timeout:30*60000});
    } catch(error) { auditExit=error.status??1; }
    if (!fs.existsSync('independent/INDEPENDENT_AUDIT.json')) writeJson('independent/INDEPENDENT_AUDIT.json',{
      status:'FAIL',reason:'AUDITOR_DID_NOT_FINISH',auditExit,solverCalls:0,performancePass:false });
    const report=readJson('independent/INDEPENDENT_AUDIT.json');
    summarize('Independent evidence audit (not candidate promotion)',report);
     await upload(`triage-independent-${lock.manifest.campaignId}-${phase||'FINAL'}`,'independent',5*60000);
     if (lock.manifest.followup || lock.manifest.largeRun) {
       writeJson('report/REPORT.json',{...report,role:'FOLLOWUP_EVIDENCE_ONLY_LLM_ANALYSIS_PENDING',
         executionCompleteness:report.status==='PASS'?'COMPLETE':'INCOMPLETE',
         rawValidity:report.errors?.length?'FAIL':report.missing?.length?'INCOMPLETE':'PASS'});
       await upload(`triage-final-${lock.manifest.campaignId}`,'report');
     }
    if(auditExit||report.status!=='PASS')process.exitCode=1;
  } else if(mode==='audit') {
    await download(process.env.INPUT_ARTIFACT_ID,process.env.INPUT_DIGEST,'config');
    const lock=validateLock(readJson('config/LOCK.json')),history=getHistory(lock.manifest.campaignId,false);
    const reuse=verifyReuse(lock.manifest);
    const plans=[...(reuse?.plans??[]),...filesUnder('history').filter(f=>path.basename(f)==='STAGE_PLAN.json').map(readJson)];
    const expected=plans.flatMap(p=>p.expectedCalls),ids=new Set(history.rows.map(r=>r.callId));
    const missing=expected.filter(c=>!ids.has(c.callId));
    assert.equal(new Set(history.rows.map(r=>r.callId)).size,history.rows.length,'execution duplicates');
    assert(history.rows.every(r=>r.manifestHash===(reuse&&lock.manifest.prerequisiteReuse.phases.includes(r.phase)
      ?reuse.parent.manifestHash:lock.manifestHash)));
    const report=developmentReport(lock.manifest,history.rows);
    report.continuation=lock.manifest.continuation??null;
    report.priorReservation=historyReservation(lock.manifest);
    report.priorExecutionPooling=false;
    report.reusedPrerequisites=reuse?{phases:lock.manifest.prerequisiteReuse.phases,
      invocationId:reuse.parent.invocationId,manifestHash:reuse.parent.manifestHash,calls:reuse.rows.length,
      newSolverCalls:0,performanceSamplesPooled:false}:null;
    report.missing=missing;report.transportAliases=history.aliases;report.rawValidity=missing.length?'INCOMPLETE':'PASS';
    report.unknownExecution=history.unknown;report.evidenceWarnings=history.warnings;
    report.phaseCompleteness=PHASES.map(phase=>({phase,planned:plans.some(p=>p.phase===phase),
      scheduled:expected.filter(c=>c.phase===phase).length,observed:history.rows.filter(r=>r.phase===phase).length}));
    report.executionCompleteness=report.phaseCompleteness.every(p=>p.planned&&p.scheduled===p.observed)
      &&!history.rows.some(r=>r.status.startsWith('NOT_RUN_'))&&!missing.length?'COMPLETE':'INCOMPLETE';
    summarize('Collection completeness and candidate review',report);
    writeJson('report/REPORT.json',report);await upload(`triage-final-${lock.manifest.campaignId}`,'report',180000);
    if(missing.length||history.unknown.length||history.warnings.length||report.executionCompleteness!=='COMPLETE')process.exitCode=1;
  } else throw Error('unsupported triage action');
} catch(error) {
  console.error(error);process.exitCode=1;
  try{writeJson('failure/FAILURE.json',{mode,phase:phase??null,error:error.message,stack:error.stack});
    await upload(`triage-data-TRIAGE_PROBE_SEED_AB_20261006_R1-failure-${mode}-${phase??'activation'}-${process.env.INPUT_ARTIFACT_ID||runId}`,'failure');}
  catch(transportError){console.error('Failure evidence undelivered',transportError);}
} finally {clearTimeout(watchdog);}
process.exit(process.exitCode??0);
