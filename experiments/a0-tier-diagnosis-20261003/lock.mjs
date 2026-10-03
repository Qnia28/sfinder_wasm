import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,read,write,sha,MATRIX_ID} from './common.mjs';
import {executionSchedule as schedule,CAMPAIGN,resume} from './schedule.mjs';
import {exportMap} from './wasm-map.mjs';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:64*2**20});
const parent='eec895abc45107c892ccac4917775cfd09c6a17a';
assert.equal(git('diff','--name-only',parent,'HEAD','--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003','experiments/a0-order-diagnosis-20261003').toString(),'');
const bytes=fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`),wasmSha256=sha(bytes);assert.equal(wasmSha256,'73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3');
assert.equal(sha(fs.readFileSync(`${ROOT}/.a0/baseline/wasm/pc_wasm.wasm`)),wasmSha256);
assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(bytes)).length,0);
const entry=read(`${ROOT}/experiments/a0-diagnosis-20261003/INPUTS.json`).entries.find(e=>e.id===MATRIX_ID);assert(entry);
const fd=fs.openSync(`${ROOT}/experiments/a0-diagnosis-20261003/${entry.pack}`,'r'),b=Buffer.alloc(entry.length);
try{assert.equal(fs.readSync(fd,b,0,b.length,entry.offset),b.length);}finally{fs.closeSync(fd);}assert.equal(sha(b),entry.sha256);
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json','experiments/a0-tier-diagnosis-20261003','experiments/a0-order-diagnosis-20261003','experiments/a0-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003/common.mjs','.github/workflows/a0-tier-diagnosis.yml').toString().trim().split('\n');
const files=names.filter(f=>!f.includes('/results/')&&!f.includes('/inputs/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
write(`${ROOT}/.a0/tier/LOCK.json`,{schema:'a0-tier-diagnosis-lock-v1',commit:git('rev-parse','HEAD').toString().trim(),evidenceParent:parent,baseline:'c0cb2a048e7275bfea587d176b1954efff0a8a08',wasmSha256,
  files,input:entry,schedule,campaign:CAMPAIGN,resume,wasmMap:exportMap(bytes),maxCalls:schedule.length,plainCalls:schedule.filter(r=>!r.trace).length,traceCalls:schedule.filter(r=>r.trace).length,
  limits:{apiSeconds:30,processSeconds:45,startupSeconds:45,auditSeconds:30,durableAckSeconds:10,reapSeconds:2,callAdmissionWorstSeconds:177,computeMinutes:17,jobMinutes:20,runnerHoursCap:1/3},
  changedMeasurementContract:'Diagnostic flags can slow execution; 30s API/45s process/45s startup applied equally to all modes. Product 10s/30s policies and old records unchanged.',
  engineFlagsAreDiagnosticOnly:true,noProductChanges:true,noPerformanceConfirmation:true,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0});
