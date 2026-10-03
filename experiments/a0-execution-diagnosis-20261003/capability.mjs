import {Worker} from 'node:worker_threads';
import assert from 'node:assert/strict';
import {HERE,ROOT,write,sha} from './common.mjs';
import fs from 'node:fs';
const rows=[];
for(const flags of [[],['--liftoff-only'],['--no-liftoff','--no-wasm-lazy-compilation']]){
  // V8 flags cannot be assigned through Worker.execArgv; start a process with
  // the flags in fixture-process.mjs which lets its Worker inherit them.
  const {fork}=await import('node:child_process');
  const child=fork(`${HERE}/fixture-process.mjs`,[],{cwd:ROOT,execArgv:flags,stdio:['ignore','ignore','pipe','ipc']});let row,stderr='';child.stderr.on('data',b=>stderr+=b);
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>{child.kill();reject(Error('Capability fixture15s deadline'));},15000);child.on('message',m=>{row=m;});child.on('error',reject);child.on('close',code=>{clearTimeout(t);try{assert.equal(code,0);assert.equal(stderr,'');assert(!row.error,row.error);assert(row.summary.samples>=50);assert(row.begin>=row.profile.startTime-10000&&row.end<=row.profile.endTime+10000);resolve();}catch(e){reject(e);}});});
  rows.push(row);
}
const report={capability:rows.every(r=>r.capability==='FUNCTION_ONLY')?'FUNCTION_ONLY':'UNUSABLE',executionTierIdentified:false,
  fixtureWasmSha256:sha(fs.readFileSync(`${HERE}/fixture.wasm`)),samplingIntervalUs:1000,rows,nativeActualInputCalls:0,
  interpretation:'Function identity calibrated against synthetic functions0/1; no explicit execution-tier field. No compiler-generation label is substituted for frame tier.'};
write(`${ROOT}/.a0/execution/CAPABILITY.json`,report);console.log(JSON.stringify({capability:report.capability,actualInputCalls:0}));
