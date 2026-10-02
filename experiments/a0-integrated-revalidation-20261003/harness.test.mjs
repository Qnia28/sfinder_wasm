import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {HERE,ROOT,read,jsonSha} from './common.mjs';
import {supervised} from './supervisor.mjs';
test('metadata schedule is exclusive, paired, ABBA/BAAB and includes original16',()=>{
  const input=read(`${HERE}/INPUTS.json`),runs=read(`${HERE}/SCHEDULE.json`).runs;
  assert.equal(runs.length,1344);assert.equal(new Set(runs.map(r=>r.runId)).size,1344);
  assert.equal(runs.filter(r=>r.phase==='development').length,512);assert.equal(runs.filter(r=>r.phase==='reserved').length,832);
  const dev=new Set(runs.filter(r=>r.phase==='development').map(r=>r.matrixId));assert.equal(dev.size,64);assert(input.old16.every(id=>dev.has(id)));
  for(const id of new Set(runs.map(r=>r.matrixId))){const a=runs.filter(r=>r.matrixId===id);assert.equal(a.length,8);assert.equal(new Set(a.map(r=>r.shard)).size,1);assert.equal(a.filter(r=>r.variant==='A').reduce((n,r)=>n+r.position,0),6);assert.equal(input.entries.find(e=>e.id===id).partition==='reserved-validation',a[0].phase==='reserved');}
});
test('parent fsync ACK keeps raw capped witness after hang, verifier error and invalid JSON',async()=>{
  const dir=`${ROOT}/.a0/preflight-${Date.now()}`;fs.mkdirSync(dir,{recursive:true});
  const o={script:'persistence-fixture.mjs',apiMs:300,startupMs:1000,auditMs:200};
  for(const [mode,status] of [['post-result-hang','TIMEOUT_AUDIT'],['audit-failure','ERROR'],['bad-json','ERROR_RESULT_PARSE'],['ok','FIXTURE_PASS']]){
    const log=path.join(dir,mode+'.jsonl'),r=await supervised([mode],{...o,log});assert.equal(r.status,status);assert.equal(r.persisted[0].raw.keys[0],'000');assert(fs.readFileSync(log,'utf8').includes('qualityVector'));assert(!r.resources.cgroupEvents?.oom_kill);
  }
  assert.equal((await supervised(['api-hang'],{...o})).status,'TIMEOUT_API');
  assert.equal((await supervised(['startup-hang'],{...o,startupMs:200})).status,'TIMEOUT_STARTUP');
  assert.equal((await supervised(['independent'],{...o,apiMs:250,thresholdApiMs:250})).status,'FIXTURE_PASS');
  const r=await supervised(['ok'],{...o,log:dir});assert.equal(r.status,'ERROR_PERSISTENCE_OR_PROTOCOL');assert.equal(r.persisted.length,0);
});
