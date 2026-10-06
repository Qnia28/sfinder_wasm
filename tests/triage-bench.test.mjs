import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decideExperimentalProbe } from '../src/min-cover-triage-experiment.mjs';
import { solveExactSecondary } from '../src/min-cover-exact-secondary.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { PROFILE, compileTasks, AUDIT_CONTRACT, CP_PREFLIGHT_CONTRACT } from '../tools/secondary-bench/common/triage/protocol.mjs';
import { selectConfirmation, prerequisiteGate, pairedInputs, developmentReport } from '../tools/secondary-bench/common/triage/analysis.mjs';
import { executeTask, runChunk } from '../tools/secondary-bench/common/triage/executor.mjs';
import { digest, writeJson, filesUnder, canonical } from '../tools/secondary-bench/common/contracts.mjs';
import { FOLLOWUP_JOB } from '../tools/secondary-bench/common/budget.mjs';
import { verifySnapshot, seal, indexHistory, historyReservation } from '../tools/secondary-bench/common/evidence.mjs';
import { activate as activateCommon, validateLock as validateCommonLock } from '../tools/secondary-bench/common/manifest.mjs';
import { runIsolated } from '../tools/secondary-bench/isolation.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';
import { sha256 } from '../tools/secondary-bench/common/contracts.mjs';
import { continuationContract, assertStageBudget, verifyPriorCanary } from '../tools/secondary-bench/common/triage/continuation.mjs';
import { raceSecondaryEngines } from '../src/secondary-engine-runner.mjs';

const structure=(n,k,f)=>({candidateCount:n,count:k,forcedCount:f});
test('A/B valid structure gates; primaryHard remains provenance rather than overwritten',()=>{
  for(const hard of [false,true])for(const d of [0,8,9,16,17,30]) {
    const s=structure(50,35,35-d);
    assert.equal(decideExperimentalProbe('baseline',hard,s).useProbe,!hard);
    assert.equal(decideExperimentalProbe('A',hard,s).useProbe,!hard&&d<17);
    assert.equal(decideExperimentalProbe('B',hard,s).useProbe,d<17);
    assert.equal(decideExperimentalProbe('B',hard,s).primaryHard,hard);
  }
  for(const s of [null,structure(20,4,null),structure(1,2,0),structure(4,2,3),structure(4,2,-1)])
    for(const hard of [false,true])assert.equal(decideExperimentalProbe('B',hard,s).useProbe,!hard);
  assert.throws(()=>decideExperimentalProbe('C',false,null));
});
const done={completed:true,count:2,keys:['a','b'],qualityVector:[1,1,1],searchedStates:3};
function triangle(){const m=createNumericCoverage(['a','b','c'],new Map([[0,[[0,1],[1,1]]],[1,[[1,1],[2,1]]],[2,[[0,1],[2,1]]]]),[{caseId:0},{caseId:1},{caseId:2}]);return {...m,qualityFor:()=>1};}
function opts(m,solver,extra={}) {return {solver,qualityFor:m.qualityFor,primary:{count:2,backend:'rust'},primaryKeys:['a','b'],
  primaryHard:true,kernelStats:{cases:3,solutions:3,entries:6},requestedPrimary:'auto',requested:false,...extra};}
test('hard low-d B actually probes and seed fallback reaches real product function',()=>{
  const m=triangle(),calls=[],trace=[];
  const solver={minimumCoverAtCount(_c,_k,o){calls.push(o);return {...done,completed:calls.length>1};}};
  const result=solveExactSecondary(m.coverage,opts(m,solver,{experimentalTriagePolicy:'B',secondaryTrace:e=>trace.push(e)}));
  assert.equal(calls.length,2);assert.equal(calls[0].stateBudget,100000);assert.equal(calls[0].integrated,true);
  assert.deepEqual(calls[1].seedKeys,done.keys);assert.equal(result.completed,true);
  assert(trace.some(e=>e.reason==='hard-low-mid-probe'));assert(trace.some(e=>e.name==='probe-end'));
});
test('baseline hard has no probe; trivial shortcuts bypass experimental solver',()=>{
  const m=triangle(),calls=[];
  solveExactSecondary(m.coverage,opts(m,{minimumCoverAtCount(_c,_k,o){calls.push(o);return done;}}));
  assert.equal(calls.length,1);assert.equal(calls[0].integrated,undefined);
  const all={...opts(m,{minimumCoverAtCount(){throw Error('trivial searched');}},{experimentalTriagePolicy:'B'}),primary:{count:3,backend:'rust'}};
  assert.equal(solveExactSecondary(m.coverage,all).secondaryTrivial,'all-candidates');
});
test('high-d skips existing probe; deferral transfers policy/trace without duplicate scan',()=>{
  const keys=Array.from({length:20},(_,i)=>String(i).padStart(2,'0'));
  const m=createNumericCoverage(keys,new Map([[0,keys.map((_,i)=>[i,1])]]),[{caseId:0}]);
  const trace=()=>{},context=solveExactSecondary(m.coverage,{...opts(m,{minimumCoverAtCount(){throw Error('must defer');}}),
    primary:{count:17,backend:'rust'},primaryKeys:keys.slice(0,17),primaryHard:false,qualityFor:()=>1,
    experimentalTriagePolicy:'A',secondaryTrace:trace,deferThreshold:c=>c});
  assert.equal(context.experimentalTriagePolicy,'A');assert.equal(context.primaryHard,false);
  assert.equal(context.integratedProbe,undefined);assert.equal(context.secondaryTrace,trace);
});
const metadata={primary_hard:false,d:3,n:10,mirror_group:'g'};
const row=(id,variant,status,ms,repeat=1)=>({inputId:id,variant,status,ms,phase:'ALL_INITIAL',pairId:`${id}/A/${repeat}`,comparator:'A',metadata});
test('pairs are independent and timeout/NOT_RUN never acquire a fake elapsed ms',()=>{
  const inputs=pairedInputs([row('x','BASELINE','EXACT',10),row('x','A','TIMEOUT_CALL',null)],'ALL_INITIAL');
  assert.equal(inputs[0].ratio,null);assert(inputs[0].issues.includes('STATUS_DISCORDANCE'));
});
test('confirmation includes all changed and mandatory hard inputs, plus tails/variability',()=>{
  const rows=[row('x','BASELINE','EXACT',10),row('x','A','EXACT',11),
    {...row('hard','BASELINE','EXACT',20),metadata:{...metadata,primary_hard:true,d:10}},
    {...row('hard','A','EXACT',20),metadata:{...metadata,primary_hard:true,d:10}}];
  const s=selectConfirmation({design:{retest:{always_include_fixture_ids:['hard']}}},rows,'ALL_INITIAL');
  assert(s.selected.includes('hard'));assert(s.selected.includes('x'));
});
test('canary and calibration block partial coverage and excessive overhead',()=>{
  assert.equal(prerequisiteGate([{status:'NOT_RUN_BUDGET'}],'CANARY').status,'HOLD');
  assert.equal(prerequisiteGate([],'CALIBRATION').status,'HOLD');
});
const cpPreflight={status:'EXACT',reaped:true,result:{cpPreflight:'PASS',qualityComplete:true,tieComplete:true}};
const canary = (status='EXACT') => ['PRECHANGE_BASELINE','BASELINE','A','B'].map(variant=>({
  inputId:'canary',variant,status,ms:status==='EXACT'?10:null,
  execution:{reaped:true,result:status==='EXACT'?{verified:{selected:[0],qualityVector:[1],completed:true},result:{}}:null} }));
test('canary refuses new/all OOM, unknown errors, absent reclamation and completed baseline regression',()=>{
  assert.equal(prerequisiteGate(canary(),'CANARY',{cpPreflight}).status,'PASS');
  for(const status of ['OOM','ERROR_SCOPE_EXIT','ERROR_SPAWN','CANCELLED','NOT_RUN_BUDGET','TIMEOUT_STARTUP','unregistered']) {
    const rows=canary();rows[2].status=status;
    assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).status,'HOLD',status);
  }
  assert.equal(prerequisiteGate(canary('OOM'),'CANARY',{cpPreflight}).status,'HOLD');
  const rows=canary();rows[2].status='TIMEOUT_CALL';rows[2].execution.result=null;
  assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).reason,'CANARY_COMPLETION_REGRESSION');
  rows[2].execution.reaped=false;assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).status,'HOLD');
});
test('canary requires actual CP preflight; runtime failure cannot hide behind Rust success or policy timeout',()=>{
  assert.equal(prerequisiteGate(canary(),'CANARY').reason,'CP_PREFLIGHT_REQUIRED');
  assert.equal(prerequisiteGate(canary(),'CANARY',{cpPreflight:{...cpPreflight,reaped:false}}).status,'HOLD');
  const rows=canary();rows[1].execution.result.result.secondaryCpFailure='Error: CP initialization failed';
  assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).reason,'CP_RUNTIME_OR_PROOF_FAILURE');
  rows[1].execution.result.result.secondaryCpFailure='Error: CP secondary time limit reached';
  assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).status,'PASS');
  const timeout=canary('TIMEOUT_CALL');timeout[2].execution.policyTrace=[{name:'cp-end',kind:'ERROR',failure:'JSPI unavailable'}];
  assert.equal(prerequisiteGate(timeout,'CANARY',{cpPreflight}).reason,'CP_RUNTIME_OR_PROOF_FAILURE');
  timeout[2].execution.policyTrace=[];
  assert.equal(prerequisiteGate(timeout,'CANARY',{cpPreflight}).status,'PASS','known stress timeouts remain censored, not false correctness errors');
});
test('gate rejects duplicate/missing variants and cannot evaluate an unknown phase',()=>{
  const rows=canary();rows[2].variant='B';assert.equal(prerequisiteGate(rows,'CANARY',{cpPreflight}).status,'HOLD');
  assert.equal(prerequisiteGate(canary(),'unregistered',{cpPreflight}).status,'HOLD');
});
test('normal CP cancellation after Rust winner is not a runtime support failure',async()=>{
  let finishRust,failCp;const events=[];
  const result=await raceSecondaryEngines({cpAfterMs:0,
    startRust:()=>({promise:new Promise(resolve=>{finishRust=resolve;}),stop:async()=>{}}),
    startCp:()=>{setTimeout(()=>finishRust({completed:true}),1);return {
      promise:new Promise((_,reject)=>{failCp=reject;}),stop:async()=>failCp(new Error('secondary engine stopped'))};},
    onCpOutcome:e=>events.push(e)});
  assert.equal(result.engine,'rust');assert.equal(result.cpStarted,true);
  assert(!events.some(e=>e.kind==='ERROR'));assert(events.some(e=>e.kind==='CANCELLED_AFTER_POLICY_SETTLED'));
});
test('calibration rejects status drift, OOM, state drift and excessive trace cost',()=>{
  const rows=Array.from({length:12},(_,i)=>['TRACE_OFF_BASELINE','TRACE_ON_BASELINE'].map(variant=>({
    inputId:'c'+i,variant,phase:'CALIBRATION',pairId:'pair'+i,comparator:'TRACE_ON_BASELINE',metadata,
    status:'EXACT',ms:10,execution:{reaped:true,result:{verified:{selected:[0],qualityVector:[1],completed:true},
      result:{qualitySearchedStates:3}}}}))).flat();
  assert.equal(prerequisiteGate(rows,'CALIBRATION',{cpPreflight}).status,'PASS');
  rows[1].execution.result.result.qualitySearchedStates=4;
  assert.equal(prerequisiteGate(rows,'CALIBRATION',{cpPreflight}).reason,'TRACE_NATIVE_STATES_DRIFT');
  rows[1].execution.result.result.qualitySearchedStates=3;rows[1].status='TIMEOUT_CALL';
  assert.equal(prerequisiteGate(rows,'CALIBRATION',{cpPreflight}).reason,'CALIBRATION_PAIR_OR_STATUS');
  rows[1].status='OOM';assert.equal(prerequisiteGate(rows,'CALIBRATION',{cpPreflight}).status,'HOLD');
  rows[1].status='EXACT';rows[1].ms=100;
  assert.equal(prerequisiteGate(rows,'CALIBRATION',{cpPreflight}).reason,'TRACE_OVERHEAD');
});
test('compile seed trial and pair identity includes comparator, no shared baseline',()=>{
  const m={campaignId:'x',job:FOLLOWUP_JOB,inputs:[{id:'f',sha256:'a'.repeat(64)}]};
  const task={phase:'ALL_INITIAL',task_id:'task',fixture_ids:['f'],calls:4,pairs:[{pair_id:'p1',comparator:'A',repeat:1,order:['BASELINE','A']},{pair_id:'p2',comparator:'B',repeat:1,order:['B','BASELINE']}]};
  const compiled=compileTasks(m,[task],'ALL_INITIAL');assert.equal(new Set(compiled[0].calls.map(c=>c.callId)).size,4);
  assert.equal(compiled[0].worstMs,4*340000);
});
function temp(t){const dir=fs.mkdtempSync(path.join(process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Temp','opencode'):'/tmp','triage-contract-'));
  t.after(()=>{for(const file of filesUnder(dir))fs.unlinkSync(file);const empty=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true}))if(e.isDirectory())empty(path.join(d,e.name));fs.rmdirSync(d);};empty(dir);});return dir;}
test('budget refusal durably emits NOT_RUN without calling scope',async t=>{
  const dir=temp(t),now=Date.now(),lock={manifest:{campaignId:'x',inputs:[{id:'f',member:'fixtures/f.json',metadata}],job:FOLLOWUP_JOB},
    endMs:now+1000,manifestHash:'h',profileHash:'p',invocationId:'1'};
  const task={id:'task',phase:'ALL_INITIAL',worstMs:340000,calls:[{inputId:'f',variant:'A',callId:'c',limits:{startupMs:10000,callMs:300000,reapMs:5000}}]};
  const rows=await executeTask(lock,task,dir,path.join(dir,'output'),{fatal:null,oom:[]},{now:()=>now,jobStartedMs:now,scope:()=>{throw Error('scope called');}});
  assert.equal(rows[0].status,'NOT_RUN_BUDGET');assert.equal(rows[0].executionAttemptId,null);
  assert.equal(rows[0].ms,null);assert.equal(fs.readFileSync(path.join(dir,'output/starts.jsonl'),'utf8'),'');
});
test('performance profile preserves budget and existing CP contract',()=>{
  assert.equal(PROFILE.cpDelayMs,60000);assert.equal(PROFILE.cpLimitMs,120000);
  assert.equal(PROFILE.probeStateBudget,100000);assert.equal(PROFILE.threads.cpsatSecondary,1);
  assert.equal(PROFILE.memoryMaxBytes,3221225472);
});
test('real disposable policy child keeps original weighted exact result on a tiny synthetic matrix',async t=>{
  const dir=temp(t),file=path.join(dir,'fixture.json');
  const f={schema:1,id:'synthetic-triangle',keys:['a','b','c'],K:2,seed:[0,1],
    rows:[[[0,1],[1,1]],[[1,1],[2,1]],[[0,1],[2,1]]],primaryHard:true,
    cardinalityProof:{status:'PROVEN',backend:'rust',kernelStats:{cases:3,solutions:3,entries:6}}};
  fs.writeFileSync(file,JSON.stringify(f));
  const fixtureSha256=hash(fs.readFileSync(file));
  for(const variant of ['BASELINE','A','B','I100K_SEED_CAPTURE','T_PRIMARY_SEED','T_PROBE_SEED']) {
    const r=await runIsolated({childFile:new URL('../tools/secondary-bench/common/triage/child.mjs',import.meta.url),
      job:{action:'triage',variant,fixturePath:file,fixtureSha256,exactHumanQuality:'true',probeSeed:[0,1]},
      limits:{startupMs:10000,callMs:10000,reapMs:5000}});
    assert.equal(r.status,'EXACT',JSON.stringify(r));assert.equal(r.reaped,true);
    assert.deepEqual(r.result.verified.selected,[0,1]);assert(r.result.policySettledMs>0);
    if(variant==='B')assert(r.result.trace.some(e=>e.reason==='hard-low-mid-probe'));
  }
});
test('seed trial preserves a bounded incomplete witness and passes only its validated seed to T',async t=>{
  const dir=temp(t),now=Date.now(),fixture={schema:1,id:'f',keys:['a','b'],K:1,seed:[0],rows:[[[0,1],[1,2]]],
    cardinalityProof:{status:'PROVEN',backend:'rust'}};
  fs.mkdirSync(path.join(dir,'fixtures'));fs.writeFileSync(path.join(dir,'fixtures/f.json'),JSON.stringify(fixture));
  const inputHash=sha256(fs.readFileSync(path.join(dir,'fixtures/f.json'))),limits={startupMs:10000,callMs:300000,reapMs:5000};
  const lock={manifest:{campaignId:'x',inputs:[{id:'f',member:'fixtures/f.json',metadata}],job:FOLLOWUP_JOB},endMs:now+10*3600000,
    manifestHash:'h',profileHash:'p',invocationId:'1'};
  const task={id:'seed',phase:'SEED_DIAGNOSTIC',worstMs:2*340000,calls:['I100K_SEED_CAPTURE','T_PROBE_SEED'].map((variant,i)=>
    ({inputId:'f',inputHash,variant,callId:'c'+i,trialId:'t1',limits}))};
  const seen=[];const scope=async r=>{seen.push(r.job);return {status:r.job.variant==='I100K_SEED_CAPTURE'?'PROBE_INCOMPLETE':'EXACT',reaped:true,
    result:{probeSeed:[1],policySettledMs:10}};};
  const rows=await executeTask(lock,task,dir,path.join(dir,'out'),{fatal:null,oom:[]},{scope,now:()=>now,jobStartedMs:now});
  assert.equal(rows[0].status,'PROBE_INCOMPLETE');assert.equal(rows[0].ms,null);assert.equal(rows[1].status,'EXACT');
  assert.deepEqual(seen[1].probeSeed,[1]);assert.equal(rows.length,2);
});
test('invalid probe seed is MISMATCH and forbids subsequent scope, without overwriting starts',async t=>{
  const dir=temp(t),now=Date.now(),fixture={schema:1,id:'f',keys:['a'],K:1,seed:[0],rows:[[[0,1]]],cardinalityProof:{status:'PROVEN',backend:'rust'}};
  fs.mkdirSync(path.join(dir,'fixtures'));fs.writeFileSync(path.join(dir,'fixtures/f.json'),JSON.stringify(fixture));
  const inputHash=sha256(fs.readFileSync(path.join(dir,'fixtures/f.json'))),limits={startupMs:10000,callMs:300000,reapMs:5000};
  const lock={manifest:{campaignId:'x',inputs:[{id:'f',member:'fixtures/f.json',metadata}],job:FOLLOWUP_JOB},endMs:now+10*3600000,
    manifestHash:'h',profileHash:'p',invocationId:'1'};
  const task={id:'seed',phase:'SEED_DIAGNOSTIC',worstMs:2*340000,calls:['I100K_SEED_CAPTURE','T_PROBE_SEED'].map((variant,i)=>
    ({inputId:'f',inputHash,variant,callId:'c'+i,trialId:'t1',limits}))};
  let calls=0;const scope=async()=>{calls++;return {status:'PROBE_INCOMPLETE',reaped:true,result:{probeSeed:[99]}};};
  const rows=await executeTask(lock,task,dir,path.join(dir,'out'),{fatal:null,oom:[]},{scope,now:()=>now,jobStartedMs:now});
  assert.equal(calls,1);assert.equal(rows[0].status,'MISMATCH');assert(rows[1].status.startsWith('NOT_RUN_'));
  assert.equal(fs.readFileSync(path.join(dir,'out/starts.jsonl'),'utf8').trim().split('\n').length,1);
});
test('empty/failed initial campaign still produces finite incomplete development audit, never PASS',()=>{
  const report=developmentReport({design:{selection_seed:'fixed',gates:{}}},[]);
  assert.doesNotThrow(()=>canonical(report));assert.equal(report.performancePass,false);
  assert.equal(report.summaries[0].resourcesAvailableFraction,null);
});
test('phase workflow is branch-limited, opt-in and reserves 16 matrix VMs',()=>{
  const workflow=fs.readFileSync('.github/workflows/secondary-triage-campaign.yml','utf8');
  const stage=fs.readFileSync('.github/workflows/secondary-triage-stage.yml','utf8');
  assert(workflow.includes('[experiment/secondary-routing-20261005]'));
  assert(workflow.includes('[RUN_TRIAGE_16VM]'));assert(stage.includes('max-parallel: 16'));
  assert(stage.includes('timeout-minutes: 150'));
  assert(workflow.includes('needs: [activate, canary-audit]'));
  assert(workflow.includes('needs: [activate, calibration-audit]'));
  assert(workflow.includes('needs: [activate, audit]'));assert(workflow.includes('mode: independent-audit'));
  const marker=JSON.parse(fs.readFileSync('.github/secondary-triage/START.json','utf8'));
  assert([null,'RUN_TRIAGE_PROBE_SEED_16VM'].includes(marker.confirm));
});
test('artifact operations run through a JavaScript action, never a bare composite shell',()=>{
  const composite=fs.readFileSync('tools/secondary-bench/common/triage/action/action.yml','utf8');
  const native=fs.readFileSync('tools/secondary-bench/common/action/action.yml','utf8');
  const bootstrap=fs.readFileSync('tools/secondary-bench/common/action/index.mjs','utf8');
  assert(composite.includes('uses: ./tools/secondary-bench/common/action'));
  assert(composite.includes('protocol: triage'));
  assert(!composite.includes('run: node tools/secondary-bench/common/triage/action.mjs'));
  assert(native.includes('using: node24'));assert(bootstrap.includes('ACTIONS_RUNTIME_TOKEN'));
  assert(bootstrap.includes("spawnSync('node'"));
  const scope=fs.readFileSync('tools/secondary-bench/followup-scope.mjs','utf8');
  assert(!scope.includes('ACTIONS_RUNTIME_TOKEN'),'runtime credential must stay outside policy tree');
});
test('original ALL and per-save witness contracts preserve selected-before-quality bytes',async()=>{
  const { historicalWitnessHash } = await import('../tools/secondary-bench/common/triage/child.mjs');
  const { hash } = await import('../tools/secondary-bench/contracts.mjs');
  const verified = { selected: [1, 3], qualityVector: [2, 4] };
  const insertion = historicalWitnessHash(verified, { contract: 'INSERTION_SELECTED_QUALITY' });
  const sorted = historicalWitnessHash(verified, { contract: 'SORTED_QUALITY_SELECTED' });
  assert.equal(insertion, hash('{"selected":[1,3],"quality":[2,4]}'));
  assert.equal(sorted, hash('{"quality":[2,4],"selected":[1,3]}'));
  assert.notEqual(insertion, sorted);
  assert.throws(()=>historicalWitnessHash(verified, { contract: 'unknown' }));
  const prepare=fs.readFileSync('tools/secondary-bench/common/triage/prepare.py','utf8');
  assert(prepare.includes("('minimals-all/ALL.sqlite',\"SELECT fixtureId,exactWitnessSha256 FROM calls WHERE status='EXACT'\",'INSERTION_SELECTED_QUALITY')"));
});
test('canary-only repair debits prior slots and preserves product, witnesses and original clock',()=>{
  const c={id:'canary-witness-serialization-repair-v1',reservedCalls:32,reservedCpSyntheticCalls:4,reservedRunnerHours:14,
    priorRunId:2,priorLock:{artifactId:10,digest:'sha256:'+'a'.repeat(64)},priorPlan:{artifactId:11,digest:'sha256:'+'b'.repeat(64)},
    originUtc:'2026-10-06T11:51:03Z',priorEvidencePooled:false,priorEvidenceReclassified:false};
  const old={sourceFiles:{product:{'src/solver.mjs':'original'}},profileContract:PROFILE,baselineFiles:[],tasksHash:'fixed',
    inputs:[{id:'x',sha256:'fixture',expectedWitness:{contract:'SORTED_QUALITY_SELECTED',sha256:'original-witness'}}]};
  const m={...old,maxCalls:8479,maxRunnerHours:1400,startupContinuation:c,activationRecovery:{originUtc:c.originUtc},
    inputs:[{...old.inputs[0],expectedWitness:{...old.inputs[0].expectedWitness,contract:'INSERTION_SELECTED_QUALITY'}}]};
  assert.equal(continuationContract(m).reservedCalls,32);
  assertStageBudget(m,8447,523);assert.throws(()=>assertStageBudget(m,8448,523),/cumulative/);
  assert.throws(()=>assertStageBudget(m,10,525),/runner-hour/);
  const previous={manifest:old,manifestHash:digest(old),originMs:Date.parse(c.originUtc),invocationId:'2'};
  const calls=Array.from({length:32},(_,i)=>({callId:String(i),phase:'CANARY'}));
  const plan={phase:'CANARY',chunks:3,manifestHash:previous.manifestHash,expectedCalls:calls};
  assert.equal(verifyPriorCanary(m,previous,plan,calls).solverCalls,0);
  assert.throws(()=>verifyPriorCanary({...m,sourceFiles:{product:{changed:'solver'}}},previous,plan,calls),/source changed/);
  assert.throws(()=>verifyPriorCanary(m,{...previous,originMs:0},plan,calls));
  assert.throws(()=>continuationContract({...m,startupContinuation:{...c,reservedCalls:0}}));
});
test('triage chunk checkpoints and immutable transport retry never re-execute policy calls',async t=>{
  const dir=temp(t),bundle=path.join(dir,'bundle');fs.mkdirSync(bundle);fs.mkdirSync(path.join(bundle,'fixtures'));
  const f={schema:1,id:'f',keys:['a'],K:1,seed:[0],rows:[[[0,1]]],cardinalityProof:{status:'PROVEN',backend:'rust'}};
  fs.writeFileSync(path.join(bundle,'fixtures/f.json'),JSON.stringify(f));const inputHash=sha256(fs.readFileSync(path.join(bundle,'fixtures/f.json')));
  const now=Date.now(),manifest={schemaVersion:1,campaignId:'contract',profile:PROFILE.id,profileContract:PROFILE,purpose:'development-policy-ab',
    auditContract:AUDIT_CONTRACT,cpPreflightContract:CP_PREFLIGHT_CONTRACT,
    freshValidation:false,maxParallel:16,maxCalls:8479,maxRunnerHours:1400,overallMs:120*3600000,job:FOLLOWUP_JOB,
    inputs:Array.from({length:580},(_,i)=>({id:i?'f'+i:'f',sha256:inputHash,member:`fixtures/${inputHash}.json`,metadata})),
    design:{gates:{correctness_disagreements_allowed:0}}};
  fs.renameSync(path.join(bundle,'fixtures/f.json'),path.join(bundle,`fixtures/${inputHash}.json`));
  const lock={manifest,manifestHash:digest(manifest),profileHash:digest(PROFILE),invocationId:'contract1',originMs:now,endMs:now+manifest.overallMs};
  const task={id:'task',phase:'ALL_INITIAL',worstMs:680000,calls:['BASELINE','A'].map((variant,i)=>({variant,inputId:'f',inputHash,callId:'call'+i,
    pairId:'pair',comparator:'A',limits:{startupMs:10000,callMs:300000,reapMs:5000}}))};
  writeJson(path.join(bundle,'LOCK.json'),lock);writeJson(path.join(bundle,'CHUNK.json'),{phase:'ALL_INITIAL',index:0,manifestHash:lock.manifestHash,tasks:[task],hash:digest([task])});
  let scopeCalls=0,uploads=0;
  const scope=async()=>{scopeCalls++;return {status:'EXACT',reaped:true,result:{policySettledMs:10}};};
  const client={async uploadArtifact(){uploads++;if(uploads===1)throw Error('lost transport');return {id:uploads,digest:'a'.repeat(64)};}};
  const out=path.join(dir,'out'),report=await runChunk(bundle,out,client,{scope,now:()=>now,jobStartedMs:now});
  assert.equal(scopeCalls,2);assert.equal(report.status,'ALL_DURABLE');assert.equal(report.solverCallsInTransport,0);
  assert.equal(verifySnapshot(path.join(out,'part-0')).members.filter(r=>r.path==='raw.jsonl').length,1);
});
test('common performance profile resumes an indexed immutable legacy parent without resetting clock or reusing IDs',async t=>{
  const dir=temp(t),now=Date.now(),inputHash='a'.repeat(64),source='tools/secondary-bench/common/contracts.mjs';
  const old={schemaVersion:1,campaignId:'profile-contract',profile:PROFILE.id,profileContract:PROFILE,purpose:'development-policy-ab',
    auditContract:AUDIT_CONTRACT,cpPreflightContract:CP_PREFLIGHT_CONTRACT,freshValidation:false,maxParallel:16,maxCalls:8479,
    maxRunnerHours:1400,overallMs:120*3600000,job:FOLLOWUP_JOB,baselineFiles:[],tasksHash:'frozen-tasks',
    sourceFiles:{product:{[source]:sha256(fs.readFileSync(source))},harness:{[source]:sha256(fs.readFileSync(source))}},
    inputs:Array.from({length:580},(_,i)=>({id:i?'f'+i:'f',sha256:inputHash,member:`fixtures/${inputHash}.json`,metadata,
      expectedWitness:{contract:'SORTED_QUALITY_SELECTED',sha256:'b'.repeat(64)}})),design:{gates:{correctness_disagreements_allowed:0}}};
  const parent={manifest:old,manifestHash:digest(old),profileHash:digest(PROFILE),invocationId:'parent',originMs:now,endMs:now+old.overallMs};
  const parentFile=path.join(dir,'PARENT_LOCK.json');writeJson(parentFile,parent);
  const history=path.join(dir,'history');fs.mkdirSync(history);
  const template={phase:'CANARY',task_id:'CANARY/f',fixture_ids:['f'],variants:['PRECHANGE_BASELINE','BASELINE','A','B'],calls:4};
  const before=compileTasks(old,[template],'CANARY')[0].calls;
  writeJson(path.join(history,'plan/STAGE_PLAN.json'),{expectedCalls:before});await seal(path.join(history,'plan'),{campaignId:old.campaignId});
  indexHistory(history,old.campaignId);
  const m={...old,revision:5,approval:'SYNTHETIC_ONLY',analysis:'DEVELOPMENT_KEEP_HOLD_REJECT',measurement:{adapter:'triage-fixture',variants:['BASELINE','A','B']},
    budget:{maxParallel:16,maxCalls:8479,overallMs:old.overallMs,job:FOLLOWUP_JOB},evidence:{schemaVersion:1,retentionDays:30,retries:2,diskReserveBytes:4*1024**3},
    inputs:old.inputs.map(f=>({...f,expectedWitness:{...f.expectedWitness,contract:'INSERTION_SELECTED_QUALITY'}})),
    continuation:{parentLock:parentFile,parentLockSha256:sha256(fs.readFileSync(parentFile)),history,historyIndexSha256:sha256(fs.readFileSync(path.join(history,'HISTORY_INDEX.json')))}};
  const next=activateCommon(m,path.join(dir,'new-lock'),{createdUtc:new Date(now+1000).toISOString(),invocationId:'new',confirm:true});
  assert.equal(next.originMs,parent.originMs);assert.equal(next.endMs,parent.endMs);validateCommonLock(next);
  assert.equal(historyReservation(m).calls,4);
  const after=compileTasks(m,[template],'CANARY')[0].calls;
  assert(after.every(c=>c.measurementEpoch===5&&!before.some(old=>old.callId===c.callId)));
  assert.equal(sha256(fs.readFileSync(parentFile)),m.continuation.parentLockSha256);
  assert.throws(()=>activateCommon({...m,inputs:m.inputs.map((f,i)=>i?f:{...f,sha256:'c'.repeat(64)})},path.join(dir,'bad'),
    {createdUtc:new Date(now+1000).toISOString(),invocationId:'bad',confirm:true}));
  assert.throws(()=>activateCommon({...m,measurement:{adapter:'secondary-fixture',variants:['integrated']}},path.join(dir,'bad2'),
    {createdUtc:new Date(now+1000).toISOString(),invocationId:'bad2',confirm:true}));
});
