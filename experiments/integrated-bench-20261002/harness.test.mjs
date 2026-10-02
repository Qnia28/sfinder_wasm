import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {HERE,read,VARIANTS,matrixInput,verify,rle,unrle} from './common.mjs';
import {supervised} from './supervisor.mjs';
test('schedule is complete, independent, paired and reserved-free',()=>{
 const plan=read(path.join(HERE,'PLAN.json')),inputs=read(path.join(HERE,'INPUTS.json')).entries,runs=read(path.join(HERE,'SCHEDULE.json')).runs;
 assert.equal(runs.length,36048);assert.equal(new Set(runs.map(r=>r.runId)).size,36048);
 assert.equal(inputs.filter(m=>m.partition==='development').length,1502);assert.equal(inputs.filter(m=>m.partition==='reserved-validation').length,219);
 assert(!runs.some(r=>inputs.find(e=>e.id===r.matrixId).partition!=='development'));
 assert.equal(plan.supervision.apiCallTimeoutMs,10000);assert.equal(plan.supervision.processTimeoutMs,30000);
 assert(!Object.hasOwn(plan.supervision,'matrixPhaseTimeoutMs'));
 const pairs=new Map();for(const r of runs){const k=r.matrixId+':'+r.variant;if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(r)}
 for(const rows of pairs.values()){assert.equal(rows.length,4);assert.equal(rows.reduce((n,r)=>n+r.position,0),14);assert.equal(new Set(rows.map(r=>r.shard)).size,1)}
});
test('input pack hashes and primary seeds preserve original weighted rows',()=>{
 const inputs=read(path.join(HERE,'INPUTS.json')).entries;
 for(const entry of inputs.filter(e=>read(path.join(HERE,'PLAN.json')).phases.operationalPilot.matrixIds.includes(e.id))){
  const m=matrixInput(entry),map=new Map(m.keys.map((k,i)=>[k,i]));
  const ids=m.seedKeys.map(k=>map.get(k)),q=m.rows.map(r=>Math.max(0,...r.filter(([id])=>ids.includes(id)).map(([,q])=>q))).sort((a,b)=>a-b);
  verify(m,{count:m.K,keys:m.seedKeys,qualityVector:q});assert.deepEqual(unrle(rle(q)),q);
 }
});
test('independent process and API watchdogs kill synchronous infinite WASM-like work',async()=>{
 const a=await supervised(['api-hang'],{script:'supervisor-fixture.mjs',apiMs:100,processMs:1000});assert.equal(a.status,'TIMEOUT_API');assert(a.processWallMs<3000);
 const b=await supervised(['hang'],{script:'supervisor-fixture.mjs',apiMs:100,processMs:250});assert.equal(b.status,'TIMEOUT_PROCESS');
 const c=await supervised(['ok'],{script:'supervisor-fixture.mjs',apiMs:100,processMs:1000});assert.equal(c.status,'EXACT');
});
