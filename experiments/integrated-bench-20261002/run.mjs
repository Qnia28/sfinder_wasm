import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {HERE,ROOT,read,write,seal,jsonSha,sha,VARIANTS} from './common.mjs';
import {supervised} from './supervisor.mjs';
const [phase,shardArg]=process.argv.slice(2),shard=Number(shardArg);
const plan=read(path.join(HERE,'PLAN.json')),inputs=read(path.join(HERE,'INPUTS.json'));
const schedule=read(path.join(HERE,'SCHEDULE.json')).runs;
const execution=phase==='development'?read(path.join(HERE,'EXECUTION_SCHEDULE.json')):null;
const computeDeadline=Number(process.env.BENCH_COMPUTE_DEADLINE_MS??0);
if(['development','legacy'].includes(phase)&&!(computeDeadline>Date.now()))throw Error('Missing/expired global three-hour budget');
const build=read(path.join(ROOT,'.bench/build/BUILD.json'));
const variantEntries=Object.fromEntries(plan.variants.map(v=>[v.id,v]));
const out=path.join(ROOT,'.bench/results',`${phase}-${shard}`);
if(fs.existsSync(out))throw Error('Refusing to overwrite existing measurement');fs.mkdirSync(out,{recursive:true});
if(process.version!=='v24.13.0')throw Error('Unexpected Node');
for(const [root,hash]of [[ROOT,build.candidateWasmSha256],[path.join(ROOT,'.bench/baseline'),build.baselineWasmSha256]])if(sha(fs.readFileSync(path.join(root,'wasm/pc_wasm.wasm')))!==hash)throw Error('Binary drift');
let runs;
if(phase==='development')runs=execution.runs.filter(r=>r.shard===shard);
else if(phase==='pilot')runs=plan.phases.operationalPilot.matrixIds.filter((_,i)=>i%8===shard).flatMap(id=>VARIANTS.map((variant,i)=>({runId:`pilot-${id}--${variant}`,matrixId:id,variant,repetition:1,position:i+1,shard})));
else if(phase==='legacy')runs=inputs.entries.filter(e=>e.legacyShard===shard).flatMap(e=>{
 const p=[...VARIANTS],rotate=[...p.slice(3),...p.slice(0,3)];
 return [p,[...p].reverse(),rotate,[...rotate].reverse()].flatMap((order,r)=>order.map((variant,i)=>({runId:`${e.id}--${variant}--r${r+1}`,matrixId:e.id,variant,repetition:r+1,position:i+1,shard})));
});
else throw Error('Unsupported measurement phase');
if(!runs.length)throw Error('Empty shard');
const entries=new Map(inputs.entries.map(m=>[m.id,m]));
if(runs.some(r=>entries.get(r.matrixId)?.partition==='reserved-validation'))throw Error('Reserved access forbidden');
const ledger=[],start=performance.now();let stopped=null;
try{
  for(const r of runs){
  if(computeDeadline&&Date.now()+32000>=computeDeadline){stopped='GLOBAL_WALL_PRESERVATION_LIMIT';break}
  if(performance.now()-start> (phase==='development'?110:phase==='pilot'?13:28)*60000){stopped='JOB_PRESERVATION_LIMIT';break}
  if(fs.existsSync(path.join(out,'runs.jsonl'))&&fs.statSync(path.join(out,'runs.jsonl')).size>16*2**20){stopped='ARTIFACT_PRESERVATION_LIMIT';break}
  fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify({type:'start',utc:new Date().toISOString(),...r})+'\n');
  const result=await supervised([r.matrixId,r.variant,phase]);
  const entry=entries.get(r.matrixId);
  const row={...r,...result,partition:entry.partition,identitySha256:entry.identitySha256,inputSha256:entry.sha256,flags:variantEntries[r.variant].flags,buildSha256:jsonSha(build),source:r.variant==='H0'||r.variant==='P0'?'baseline':'candidate'};
  ledger.push(row);fs.appendFileSync(path.join(out,'runs.jsonl'),JSON.stringify(row)+'\n');
  console.log(JSON.stringify({runId:r.runId,status:row.status,apiMs:row.timing?.apiMs,states:row.states}));
 }
 write(path.join(out,'SHARD.json'),{phase,shard,status:stopped?'PARTIAL':'COMPLETE',stopReason:stopped,expectedRuns:runs.length,observedRuns:ledger.length,notRun:runs.slice(ledger.length).map(r=>r.runId),build,runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,platform:process.platform},scheduleSha256:jsonSha(runs),executionScheduleSha256:execution?jsonSha(execution):null,computeDeadlineMs:computeDeadline||null,scheduledRuns:runs,operationalWallMs:performance.now()-start,primaryCalls:0,enumerationCalls:0});
}catch(e){write(path.join(out,'FAILURE.json'),{message:e.stack,observedRuns:ledger.length});process.exitCode=1}
finally{seal(out)}
