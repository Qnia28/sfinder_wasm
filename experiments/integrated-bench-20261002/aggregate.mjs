import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,read,write,sha,jsonSha,seal} from './common.mjs';
const [downloads,output,phase]=process.argv.slice(2).map((p,i)=>i<2?path.resolve(p):p);
const dirs=fs.readdirSync(downloads).filter(n=>n.startsWith(`bench-${phase}-`)).map(n=>path.join(downloads,n));
const expectedShards=phase==='pilot'?8:phase==='development'?16:2;
const all=[],shards=[];
for(const dir of dirs){
 const files=read(path.join(dir,'FILES.json')).files;
 for(const row of files){const b=fs.readFileSync(path.join(dir,row.file));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256)}
 const s=read(path.join(dir,'SHARD.json'));assert.equal(s.phase,phase);shards.push(s);
 const rows=fs.existsSync(path.join(dir,'runs.jsonl'))?fs.readFileSync(path.join(dir,'runs.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
 assert.equal(rows.length,s.observedRuns);
 for(const r of rows){assert(s.scheduledRuns.some(x=>x.runId===r.runId));assert.equal(r.buildSha256,jsonSha(s.build));all.push(r)}
}
assert.equal(shards.length,expectedShards);assert.equal(new Set(shards.map(s=>s.shard)).size,expectedShards);
assert.equal(new Set(shards.map(s=>jsonSha(s.build))).size,1,'Mixed build');
assert.equal(new Set(all.map(r=>r.runId)).size,all.length,'Duplicate result');
const bridgeErrors=[];
for(const p0 of all.filter(r=>r.variant==='P0')){
 const p=all.find(r=>r.matrixId===p0.matrixId&&r.repetition===p0.repetition&&r.variant==='P');
 if(!p)continue;
 const pick=r=>({status:r.status,states:r.states,ids:r.selectedIDs,q:r.qualityRLE});
 if(['EXACT','CAPPED'].includes(p0.status)&&['EXACT','CAPPED'].includes(p.status)&&jsonSha(pick(p0))!==jsonSha(pick(p)))bridgeErrors.push(p0.runId);
}
const errors=all.filter(r=>r.status==='ERROR'||r.status==='OOM'||r.status.startsWith('ERROR_')).map(r=>({runId:r.runId,status:r.status,stderr:r.stderr}));
const exactErrors=[],determinismErrors=[];
const byMatrix=new Map();for(const r of all){if(!byMatrix.has(r.matrixId))byMatrix.set(r.matrixId,[]);byMatrix.get(r.matrixId).push(r)}
for(const [id,rows]of byMatrix){
 const exact=rows.filter(r=>r.status==='EXACT');
 if(new Set(exact.map(r=>jsonSha({ids:r.selectedIDs,q:r.qualityRLE}))).size>1)exactErrors.push(id);
 for(const variant of ['H0','P0','P','PD','PC','PDC']){
  const normal=rows.filter(r=>r.variant===variant&&['EXACT','CAPPED'].includes(r.status));
  if(new Set(normal.map(r=>jsonSha({status:r.status,states:r.states,ids:r.selectedIDs,q:r.qualityRLE,dominance:r.dominance}))).size>1)determinismErrors.push(`${id}:${variant}`);
 }
}
const complete=shards.every(s=>s.status==='COMPLETE');
const report={phase,status:complete&&!errors.length&&!bridgeErrors.length&&!exactErrors.length&&!determinismErrors.length?'PASS':'INCOMPLETE_OR_FAILED',runCount:all.length,expectedRunCount:shards.reduce((n,s)=>n+s.expectedRuns,0),statuses:all.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),errors,bridgeErrors,exactErrors,determinismErrors,build:shards[0].build,runnerCPUs:shards.map(s=>({shard:s.shard,cpu:s.runtime.cpu})),primaryCalls:0,enumerationCalls:0};
if(phase==='pilot'){
 const inputs=read(path.join(HERE,'INPUTS.json')).entries,plan=read(path.join(HERE,'PLAN.json'));
 const routeMax={};for(const r of all){const route=inputs.find(m=>m.id===r.matrixId).route;routeMax[route]=Math.max(routeMax[route]??0,r.processWallMs)}
 report.operationalPrediction={method:'Maximum observed per-sample pilot process wall by fixed product route, multiplied by all scheduled samples; not engine performance scoring',routeMaxSampleMs:routeMax,shards:plan.shards.map(s=>({shard:s.shard,predictedWallMinutes:s.matrices.reduce((n,id)=>n+24*routeMax[inputs.find(m=>m.id===id).route],0)/60000}))};
 report.operationalPrediction.maxShardMinutes=Math.max(...report.operationalPrediction.shards.map(s=>s.predictedWallMinutes));
 report.mayProceedToMain=report.status==='PASS'&&report.operationalPrediction.maxShardMinutes<=80;
}
write(path.join(output,'SUMMARY.json'),report);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'ALL_RUNS.jsonl'),all.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});seal(output);console.log(JSON.stringify({...report,build:jsonSha(report.build)},null,2));
if(report.status!=='PASS')process.exitCode=1;
