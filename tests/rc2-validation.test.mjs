import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {blocksFor,validateReservation,JOB,CAMPAIGN} from '../tools/secondary-bench/common/triage/rc2-plan.mjs';
import {digest,sha256} from '../tools/secondary-bench/common/contracts.mjs';
import {profileForTriage} from '../tools/secondary-bench/common/triage/protocol.mjs';
import {executeTask} from '../tools/secondary-bench/common/executor.mjs';
const selection=JSON.parse(fs.readFileSync('tools/secondary-bench/common/triage/rc2-selection.json'));
const inputs=selection.inputs.map(f=>({id:f.inputId,sha256:f.inputHash,metadata:{dataset:f.population}}));
test('all 130 selections have six same-VM paired repeats, reverse order and independent repeat blocks',()=>{
  validateReservation();const ids=new Set();const counts=new Map();
  for(const round of [1,2,3]){
    const blocks=blocksFor(inputs,round);assert.equal(blocks.length,26);
    for(const input of inputs){
      const tasks=blocks.flatMap(b=>b.tasks).filter(t=>t.calls[0].inputId===input.id);assert.equal(tasks.length,2);
      assert.deepEqual(tasks[0].calls.map(c=>c.variant),tasks[1].calls.map(c=>c.variant).reverse());
      assert.notEqual(blocks.find(b=>b.tasks.includes(tasks[0])).index,blocks.find(b=>b.tasks.includes(tasks[1])).index);
    }
    for(const block of blocks)for(const task of block.tasks)for(const c of task.calls){
      assert(!ids.has(c.callId));ids.add(c.callId);const key=c.inputId+'/'+c.variant;counts.set(key,(counts.get(key)??0)+1);
    }
  }
  assert.equal(ids.size,1560);assert.equal(counts.size,260);assert([...counts.values()].every(n=>n===6));
});
test('independent Python auditor reconstructs the exact three-round JS schedule',()=>{
  const code="import importlib.util,json,sys;from pathlib import Path;p=Path('tools/secondary-bench/common/triage/rc2-audit.py');s=importlib.util.spec_from_file_location('audit',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.expected_blocks(json.load(sys.stdin))))";
  const expected=JSON.parse(execFileSync('python',['-B','-c',code],{input:JSON.stringify(inputs),encoding:'utf8',maxBuffer:16*1024**2}));
  assert.deepEqual([1,2,3].flatMap(r=>blocksFor(inputs,r)),expected);
});
test('DEV and RC2 traverse common product adapter without instrumentation (fake scope)',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rc2-contract-'));
  try{
    const bytes=JSON.stringify({command:{kind:'minimals'}}),hash=sha256(bytes);fs.writeFileSync(path.join(root,'command.json'),bytes);
    const refs=inputs.map(f=>({...f,sha256:hash,member:'command.json',metadata:{...f.metadata,productCommand:true}}));
    const manifest={campaignId:CAMPAIGN,validation:{id:'rc2-linmax-release-v1'},inputs:refs,job:JOB};
    const now=Date.now(),lock={manifest,manifestHash:digest(manifest),profileHash:digest(profileForTriage(manifest)),invocationId:'synthetic',endUtc:new Date(now+72*3600000).toISOString()};let calls=0;
    for(const task of blocksFor(refs,1)[0].tasks){
      const rows=await executeTask(lock,{phase:task.phase,index:0},task,root,path.join(root,task.id),{oom:[],fatal:null},{jobStartedMs:now,now:()=>now,checkpointsRemaining:10,scope:async request=>{
        assert.equal(request.job.action,'product-command');assert.equal(request.job.productRoot,path.resolve(request.job.variant==='DEV'?'dev-product':'rc-product'));
        assert(['DEV','RC2'].includes(request.job.variant));assert.equal(request.job.memoryDiagnostic,undefined);assert.equal(request.job.exactHumanQuality,'true');
        calls++;return {status:'TIMEOUT_CALL',reaped:true,result:null};
      }});assert.equal(rows.length,2);assert(rows.every(r=>r.status==='TIMEOUT_CALL'));
    }
    assert.equal(calls,20);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
