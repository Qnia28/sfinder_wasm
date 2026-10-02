import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {HERE,ROOT,read,write,append,seal,jsonSha,sha} from './common.mjs';
import {supervised} from './supervisor.mjs';
const [phase,shardArg]=process.argv.slice(2),shard=Number(shardArg),build=read(`${ROOT}/.a0/build/BUILD.json`);
const runs=read(`${HERE}/SCHEDULE.json`).runs.filter(r=>r.phase===phase&&r.shard===shard),entries=read(`${HERE}/INPUTS.json`).entries;
assert(['development','reserved'].includes(phase)&&runs.length);assert.equal(process.version,'v24.13.0');
const deadline=Number(process.env.A0_COMPUTE_DEADLINE_MS);assert(Number.isFinite(deadline));
for(const root of [ROOT,`${ROOT}/.a0/baseline`])assert.equal(sha(fs.readFileSync(`${root}/wasm/pc_wasm.wasm`)),build.wasmSha256);
if(phase==='reserved'){const freeze=read(`${ROOT}/.a0/freeze/FREEZE.json`);assert.equal(freeze.status,'FROZEN_INTEGRATED_SCOPE_NOT_DEV_APPROVAL');assert.equal(freeze.buildSha256,jsonSha(build));}
const out=`${ROOT}/.a0/results/${phase}-${shard}`;assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const start=performance.now(),rows=[];let stopReason=null;
try{
  for(const r of runs){
    if(Date.now()+92000>=deadline||performance.now()-start>45*60000){stopReason='WALL_PRESERVATION_LIMIT';break;}
    append(`${out}/starts.jsonl`,{...r,utc:new Date().toISOString()});
    const entry=entries.find(e=>e.id===r.matrixId),rawFile=`raw/${r.runId}.jsonl`;fs.mkdirSync(`${out}/raw`,{recursive:true});
    const result=await supervised([r.matrixId,r.variant,phase],{log:`${out}/${rawFile}`});
    const row={...r,...result,inputSha256:entry.sha256,identitySha256:entry.identitySha256,buildSha256:jsonSha(build),rawFile};
    rows.push(row);append(`${out}/runs.jsonl`,row);console.log(JSON.stringify({runId:r.runId,status:row.status,completed:row.probe?.completed,states:row.probe?.searchedStates,apiMs:row.apiMs}));
  }
  write(`${out}/SHARD.json`,{phase,shard,status:stopReason?'PARTIAL':'COMPLETE',stopReason,expectedRuns:runs.length,observedRuns:rows.length,notRun:runs.slice(rows.length),scheduledRuns:runs,scheduleSha256:jsonSha(runs),build,
    actualInputPrimaryCalls:0,actualInputPcCalls:0,nativeThresholdCalls:0,runtime:{node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform},operationalWallMs:performance.now()-start});
}catch(e){write(`${out}/FAILURE.json`,{message:e.stack,observedRuns:rows.length});process.exitCode=1;}finally{seal(out);}
