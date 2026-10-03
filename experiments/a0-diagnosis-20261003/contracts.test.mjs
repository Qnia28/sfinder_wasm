import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROOT,read,HERE} from './common.mjs';
import {Journal,Session} from './supervisor.mjs';
import {profileExports} from './profile-adapter.mjs';
test('diagnosis scope excludes confirmation and native threshold; schedule counts fixed',()=>{
  const r=read(`${HERE}/SCHEDULE.json`).runs;assert.equal(r.length,2560);assert(r.every(r=>['diagnostic','aa-control','profile'].includes(r.stage)));assert.equal(new Set(r.map(r=>r.matrixId)).size,32);assert.equal(r.filter(r=>r.kind==='warmup').length,640);
});
test('profile facade retains fake ABI return/memory and never mutates exports',()=>{
  const e=Object.freeze({memory:{buffer:new ArrayBuffer(8)},solver_min_cover_at_count_integrated_bounded:x=>x+1,wasm_alloc_u32:x=>x*2}),a=profileExports(e);
  a.start();const t=performance.now();assert.equal(a.facade.wasm_alloc_u32(2),4);assert.equal(a.facade.solver_min_cover_at_count_integrated_bounded(3),4);const p=a.finish(t,performance.now());assert.equal(p.coreEntries,1);assert.equal(p.allocationAbiCalls,1);assert.equal(a.facade.memory,e.memory);assert.equal(e.solver_min_cover_at_count_integrated_bounded(3),4);
});
test('API/process/audit independent watchdogs and fsync-before-ACK preserve raw',async()=>{
  const out=`${ROOT}/.a0/preflight-${Date.now()}`;fs.mkdirSync(`${out}/raw`,{recursive:true});
  const j=new Journal(),run={runId:'fixture-0'};
  const o={journal:j,out,apiMs:150,processMs:250,startupMs:300,auditMs:150,script:'fixture-session.mjs'};
  try{
    for(const [mode,status]of [['api-hang','TIMEOUT_API'],['audit-hang','TIMEOUT_AUDIT'],['duplicate','DUPLICATE_PHASE']]){
      run.runId=mode;const s=new Session('fake','COLD',false,{...o,args:[mode]});await s.ready;await assert.rejects(s.call({...run}),e=>e.failure.status===status);const close=await s.close();assert(close.killToCloseMs<2000);
      if(mode==='audit-hang'){const raw=fs.readFileSync(`${out}/raw/${mode}.jsonl`,'utf8');assert(raw.includes('qualityVector'));}
    }
    const delayed={append:async(f,v)=>{if(v.type==='phase-result')await new Promise(r=>setTimeout(r,400));await j.append(f,v);}};
    run.runId='process-watch';const s=new Session('fake','COLD',false,{...o,journal:delayed,processMs:100,args:['ok']});await s.ready;await assert.rejects(s.call({...run}),e=>e.failure.status==='TIMEOUT_PROCESS');await s.close();await s.chain;
    const t=new Session('fake','COLD',false,{...o,args:['startup-hang']});await assert.rejects(t.ready,e=>e.failure.status==='TIMEOUT_STARTUP');await t.close();
    const ok=new Session('fake','WARM',false,{...o,args:['ok']});await ok.ready;for(let i=0;i<2;i++){const row=await ok.call({runId:`ok-${i}`});assert.equal(row.status,'FIXTURE_PASS');assert(fs.readFileSync(`${out}/raw/ok-${i}.jsonl`,'utf8').includes('phase-result'));}await ok.close();
  }finally{await j.close();}
});
