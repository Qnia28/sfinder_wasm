import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {digest} from '../tools/secondary-bench/common/contracts.mjs';
import {executeTask} from '../tools/secondary-bench/common/executor.mjs';
import {ARMS,CAMPAIGN,PHASE,JOB,tasksFor,validateReservation} from '../tools/secondary-bench/common/triage/qb015-plan.mjs';
test('QB015 frozen arms fit budget; independent schedules agree and VM order reverses',()=>{
  validateReservation();const ref={id:'c7-2plus2-qb-row-015/restricted-split',sha256:'a'.repeat(64),metadata:{dataset:'PER_SAVE'}};
  const calls=[1,2].flatMap(repeat=>tasksFor(ref,repeat).flatMap(t=>t.calls));assert.equal(new Set(calls.map(c=>c.callId)).size,16);
  assert.deepEqual(calls.slice(0,8).map(c=>c.variant),calls.slice(8).map(c=>c.variant).reverse());
  const script=`import importlib.util,json,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('a',Path('tools/secondary-bench/common/triage/qb015-audit.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)\nr=json.load(sys.stdin);print(json.dumps(a.expected(r,1)+a.expected(r,2)))`;
  assert.deepEqual(JSON.parse(execFileSync('python',['-B','-c',script],{input:JSON.stringify(ref),encoding:'utf8'})),calls);
  assert.equal(ARMS.length,8);assert.throws(()=>tasksFor({...ref,id:'another'},1));
});
test('all QB015 variants use pinned intervention roots through common fake scope',async()=>{
  const preferred='C:/Users/2004a/AppData/Local/Temp/opencode';
  const root=fs.mkdtempSync(path.join(fs.existsSync(preferred)?preferred:os.tmpdir(),'qb015-adapter-'));
  try{
    const bundle=path.join(root,'bundle');execFileSync('python',['tools/secondary-bench/followup-extract.py','tools/secondary-bench/common/triage/qb015-inputs-r19.zip',bundle,String(4*1024**3)]);
    const inputs=JSON.parse(fs.readFileSync(path.join(bundle,'INPUTS.json'))).inputs;
    const manifest={campaignId:CAMPAIGN,diagnostic:{id:'qb015-causal-v1'},inputs,job:JOB},now=Date.now();
    const lock={manifest,manifestHash:digest(manifest),profileHash:'synthetic',invocationId:'synthetic',endUtc:new Date(now+48*3600000).toISOString()};let count=0;
    for(const repeat of [1,2])for(const task of tasksFor(inputs[0],repeat)){
      const arm=task.calls[0].variant;
      const rows=await executeTask(lock,{phase:PHASE,index:repeat-1},task,bundle,path.join(root,'part-'+count),{oom:[],fatal:null},{jobStartedMs:now,now:()=>now,checkpointsRemaining:1,scope:async request=>{
        assert.equal(request.job.productRoot,path.resolve('qb015-products',arm));assert.equal(request.job.action,'product-command');assert.equal(request.limits.callMs,600000);count++;
        return {status:'TIMEOUT_CALL',reaped:true,result:null};
      }});assert.equal(rows[0].status,'TIMEOUT_CALL');assert.equal(rows[0].ms,null);
    }assert.equal(count,16);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
