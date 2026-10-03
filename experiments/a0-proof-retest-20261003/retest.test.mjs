import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {HERE,read} from './common.mjs';
test('frozen121-input10-pair schedule plus40 environment calls; crossed within host',()=>{
 const selection=read(`${HERE}/RETEST_SELECTION.json`),runs=read(`${HERE}/RETEST_SCHEDULE.json`).runs;
 assert.equal(selection.selectedInputs,121);assert.equal(runs.length,2460);assert.equal(new Set(runs.map(r=>r.runId)).size,2460);
 for(const host of [0,1,2,3,4]){
  assert.equal(runs.filter(r=>r.host===host).length,492);
  for(const record of selection.records.filter(r=>r.selected)){
   const rr=runs.filter(r=>r.host===host&&r.matrixId===record.matrixId&&r.kind!=='ENVIRONMENT_CONTROL');assert.equal(rr.length,4);
   for(const v of ['R','A'])assert.equal(rr.filter(r=>r.variant===v).length,2);
   assert.deepEqual(rr.filter(r=>r.position===1).map(r=>r.variant).sort(),['A','R']);
  }
 }
});
test('proof manifest gates retest; measurement has no affinity, warmup, native threshold',()=>{
 const text=fs.readFileSync(`${HERE}/retest-worker.mjs`,'utf8');assert(!text.includes("execFileSync('taskset'"));assert(text.includes('Every Worker executes exactly one native call'));
 const run=fs.readFileSync(`${HERE}/run-retest.mjs`,'utf8');assert(run.includes("assert.equal(proof.status,'INDEPENDENT_EXACT_VERIFIED')"));
 assert(run.includes('apiMs:10000,processMs:30000,startupMs:30000,auditMs:30000'));
});
