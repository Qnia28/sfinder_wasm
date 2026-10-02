import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,read,write,seal,jsonSha,sha,compare} from './common.mjs';
const [inputArg,outArg,phase]=process.argv.slice(2),input=path.resolve(inputArg),out=path.resolve(outArg);
assert(['development','reserved'].includes(phase));
const schedule=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.phase===phase),entries=read(`${HERE}/INPUTS.json`).entries;
const dirs=fs.readdirSync(input).filter(n=>n.startsWith(`a0i-${phase}-`)&&fs.existsSync(`${input}/${n}/SHARD.json`));
assert.equal(dirs.length,phase==='development'?8:16);
const rows=[],shards=[];
for(const d of dirs){for(const f of read(`${input}/${d}/FILES.json`).files){const b=fs.readFileSync(`${input}/${d}/${f.file}`);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
  const s=read(`${input}/${d}/SHARD.json`);shards.push(s);const r=fs.readFileSync(`${input}/${d}/runs.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));assert.equal(r.length,s.observedRuns);rows.push(...r);}
assert.equal(new Set(shards.map(s=>s.shard)).size,dirs.length);assert.equal(new Set(shards.map(s=>jsonSha(s.build))).size,1);assert.equal(new Set(rows.map(r=>r.runId)).size,rows.length);
const expected=new Map(schedule.map(r=>[r.runId,r]));assert(rows.every(r=>expected.has(r.runId)));
const errors={missing:[],status:[],scope:[],determinism:[],witness:[],states:[],quality:[],exact:[],proof:[],contract:[],resources:[]};
for(const r of schedule)if(!rows.find(a=>a.runId===r.runId))errors.missing.push(r.runId);
const groups=new Map();for(const r of rows){if(!groups.has(r.matrixId))groups.set(r.matrixId,[]);groups.get(r.matrixId).push(r);}
const refs=new Map(read(`${HERE}/EXACT_REFERENCES.json`).references.map(r=>[r.matrixId,r]));
const median=a=>{a=[...a].sort((a,b)=>a-b);return (a[1]+a[2])/2;};
const metrics=[],probeExact={R:0,A:0},proofReferences=[];
for(const [id,list]of groups){
  for(const r of list){
    if(!['PROBE_EXACT','PROBE_CAPPED'].includes(r.status)){errors.status.push({runId:r.runId,status:r.status});continue;}
    if(r.options.integrated!==true||r.options.stateBudget!==100000||!!r.options.partitioned!==(r.variant==='A')||r.options.dominance||r.actualInputPrimaryCalls||r.actualInputPcCalls||r.nativeThresholdCalls||r.integratedCalls!==1)errors.scope.push(r.runId);
    const raw=r.persisted.filter(p=>p.type==='phase-result');
    if(raw.length!==1||jsonSha(raw[0].raw)!==jsonSha(r.probe)||jsonSha(raw[0].options)!==jsonSha(r.options)||!r.persisted.some(p=>p.type==='audit-result'))errors.witness.push(r.runId);
    if(r.probe.completed!==(r.status==='PROBE_EXACT'))errors.exact.push(r.runId);
    if(!r.probe.completed&&(!r.contract||r.contract.status!=='CONTRACT_ONLY_STOP'||r.contract.nativeThresholdCalls||r.contract.additionalIntegratedCalls||r.contract.directAndDeferred.length!==2))errors.contract.push(r.runId);
    const m=r.resources;if(!m?.cgroupPeakBytes||m.memoryMaxBytes!==3221225472||m.swapMaxBytes!==0||m.cgroupEvents.oom_kill||!r.samplePeakRssBytes||!r.wasmBytes||m.cgroupPeakBytes>3221225472)errors.resources.push(r.runId);
  }
  for(const variant of ['R','A']){const valid=list.filter(r=>r.variant===variant&&['PROBE_EXACT','PROBE_CAPPED'].includes(r.status));if(valid.length!==4)errors.determinism.push(`${id}:${variant}:repetitions`);
    if(new Set(valid.map(r=>jsonSha(r.probe))).size>1)errors.determinism.push(`${id}:${variant}:probe`);if(valid.length===4&&valid.every(r=>r.probe.completed))probeExact[variant]++;}
  for(let rep=1;rep<=4;rep++){
    const r=list.find(r=>r.variant==='R'&&r.repetition===rep),a=list.find(r=>r.variant==='A'&&r.repetition===rep);if(!r?.probe||!a?.probe)continue;
    if(a.probe.searchedStates>r.probe.searchedStates)errors.states.push(`${id}:${rep}`);if(compare(a.probe.qualityVector,r.probe.qualityVector)<0)errors.quality.push(`${id}:${rep}`);
    if(r.probe.completed&&a.probe.completed&&jsonSha({ids:r.witness.selectedIDs,q:r.probe.qualityVector})!==jsonSha({ids:a.witness.selectedIDs,q:a.probe.qualityVector}))errors.exact.push(`${id}:${rep}`);
    if(a.probe.completed&&!r.probe.completed){const ref=refs.get(id);if(!ref||jsonSha(ref.selectedIDs)!==jsonSha(a.witness.selectedIDs)||ref.qualitySha256!==a.witness.qualitySha256)errors.proof.push(`${id}:${rep}`);else proofReferences.push({matrixId:id,referenceRun:ref.sourceRunId,sourceRowSha256:ref.sourceRowSha256});}
  }
  const r=list.filter(r=>r.variant==='R'),a=list.filter(r=>r.variant==='A');
  if(r.length===4&&a.length===4&&r.every(x=>x.probe)&&a.every(x=>x.probe)){
    const e=entries.find(e=>e.id===id),rm=median(r.map(x=>x.apiMs)),am=median(a.map(x=>x.apiMs));
    metrics.push({matrixId:id,mirrorGroup:e.mirrorGroup,n:e.n,E:e.E,R:e.R,baselineApiMedianMs:rm,candidateApiMedianMs:am,ratio:am/rm,
      baselineBoundaryMedianMs:median(r.map(x=>x.probeBoundaryWallMs)),candidateBoundaryMedianMs:median(a.map(x=>x.probeBoundaryWallMs)),baselinePeakBytes:median(r.map(x=>x.resources.cgroupPeakBytes)),candidatePeakBytes:median(a.map(x=>x.resources.cgroupPeakBytes)),
      baselineRssBytes:median(r.map(x=>x.samplePeakRssBytes)),candidateRssBytes:median(a.map(x=>x.samplePeakRssBytes)),baselineWasmBytes:median(r.map(x=>x.wasmBytes)),candidateWasmBytes:median(a.map(x=>x.wasmBytes)),baselineCompleted:r[0].probe.completed,candidateCompleted:a[0].probe.completed});
  }
}
const p95=a=>a.length?[...a].sort((a,b)=>a-b)[Math.ceil(.95*a.length)-1]:null;
const sumRatio=m=>m.length?m.reduce((n,x)=>n+x.candidateApiMedianMs,0)/m.reduce((n,x)=>n+x.baselineApiMedianMs,0):null;
const clusters=new Map();for(const m of metrics){if(!clusters.has(m.mirrorGroup))clusters.set(m.mirrorGroup,[]);clusters.get(m.mirrorGroup).push(m);}
const c=[...clusters.values()],bootstrap=[];let state=20261003;
function rand(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2**32;}
if(c.length)for(let b=0;b<10000;b++){let r=0,a=0;for(let i=0;i<c.length;i++)for(const m of c[Math.floor(rand()*c.length)]){r+=m.baselineApiMedianMs;a+=m.candidateApiMedianMs;}bootstrap.push(a/r);}
bootstrap.sort((a,b)=>a-b);const ci=bootstrap.length?[bootstrap[249],bootstrap[9749]]:null;
const apiRatio=sumRatio(metrics),slowdown=p95(metrics.map(m=>m.ratio)),memoryRatio=p95(metrics.map(m=>m.candidatePeakBytes/m.baselinePeakBytes)),memoryDelta=p95(metrics.map(m=>m.candidatePeakBytes-m.baselinePeakBytes));
const correctness=!Object.values(errors).some(e=>e.length)&&rows.length===schedule.length&&shards.every(s=>s.status==='COMPLETE')&&probeExact.A>=probeExact.R;
const performance=metrics.length===(phase==='development'?64:104)&&apiRatio<=1.05&&slowdown<=1.10&&ci?.[1]<=1.05;
const resources=memoryRatio<=1.10||memoryDelta<=32*2**20;
const strata={};for(const [name,filtered]of [['commonExact',metrics.filter(m=>m.baselineCompleted&&m.candidateCompleted)],['commonCapped',metrics.filter(m=>!m.baselineCompleted&&!m.candidateCompleted)],['RonlyExact',metrics.filter(m=>m.baselineCompleted&&!m.candidateCompleted)],['AonlyExact',metrics.filter(m=>!m.baselineCompleted&&m.candidateCompleted)],['smallE',metrics.filter(m=>m.E<=10000)],['mediumE',metrics.filter(m=>m.E>10000&&m.E<=100000)],['largeE',metrics.filter(m=>m.E>100000)]])strata[name]={matrices:filtered.length,apiSumRatio:sumRatio(filtered),p95Ratio:p95(filtered.map(m=>m.ratio))};
const summary={schema:'a0-integrated-probe-summary-v1',phase,status:correctness&&performance&&resources?'PASS_INTEGRATED_SCOPE':'GATE_FAILED_OR_INCOMPLETE',expectedRuns:schedule.length,observedRuns:rows.length,statuses:rows.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),errors,
  correctnessGatePass:correctness,performanceGatePass:performance,resourceGatePass:resources,apiMedianSumRatio:apiRatio,p95ApiRatio:slowdown,cluster95CI:ci,mirrorGroups:c.length,clusterBootstrapSeed:20261003,clusterBootstrapSamples:10000,
  peakMemoryP95Ratio:memoryRatio,peakMemoryP95IncreaseBytes:memoryDelta,probeExactMatrices:probeExact,proofReferences,strata,metrics,build:shards[0].build,
  cappedIsValidBoundedResult:true,nativeActualInputThresholdCalls:0,actualInputPrimaryCalls:0,actualInputPcCalls:0,fullRoutePerformanceProven:false,priorFailedRunUnchanged:37034641097,devApplied:false};
write(`${out}/SUMMARY.json`,summary);fs.writeFileSync(`${out}/ALL_RUNS.jsonl`,rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({...summary,metrics:metrics.length,build:jsonSha(summary.build)},null,2));if(summary.status!=='PASS_INTEGRATED_SCOPE')process.exitCode=1;
