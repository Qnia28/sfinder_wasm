import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,read,write,sha,MATRIX_ID} from './common.mjs';
import {schedule,CAMPAIGN,LIMITS} from './schedule.mjs';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:64*2**20});
const parent='da27c892595e5755dbc8a939add7cd8d5c1dca8a';
assert.equal(git('diff','--name-only',parent,'HEAD','--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003','experiments/a0-order-diagnosis-20261003','experiments/a0-tier-diagnosis-20261003').toString(),'');
const bytes=fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`),wasmSha256=sha(bytes);assert.equal(wasmSha256,'73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3');
assert.equal(sha(fs.readFileSync(`${ROOT}/.a0/baseline/wasm/pc_wasm.wasm`)),wasmSha256);
const entry=read(`${ROOT}/experiments/a0-diagnosis-20261003/INPUTS.json`).entries.find(e=>e.id===MATRIX_ID);assert(entry);
const fd=fs.openSync(`${ROOT}/experiments/a0-diagnosis-20261003/${entry.pack}`,'r'),b=Buffer.alloc(entry.length);
try{assert.equal(fs.readSync(fd,b,0,b.length,entry.offset),b.length);}finally{fs.closeSync(fd);}assert.equal(sha(b),entry.sha256);
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json','experiments/a0-execution-diagnosis-20261003','experiments/a0-tier-diagnosis-20261003','experiments/a0-order-diagnosis-20261003','experiments/a0-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003/common.mjs','.github/workflows/a0-execution-diagnosis.yml').toString().trim().split('\n');
const files=names.filter(f=>!f.includes('/results/')&&!f.includes('/inputs/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
const capability=read(`${ROOT}/.a0/execution/CAPABILITY.json`);
write(`${ROOT}/.a0/execution/LOCK.json`,{schema:'a0-execution-diagnosis-lock-v1',commit:git('rev-parse','HEAD').toString().trim(),evidenceParent:parent,baseline:'c0cb2a048e7275bfea587d176b1954efff0a8a08',wasmSha256,
  files,input:entry,schedule,campaign:CAMPAIGN,limits:LIMITS,capabilitySha256:sha(fs.readFileSync(`${ROOT}/.a0/execution/CAPABILITY.json`)),
  profiler:'Node built-in Inspector CPU Profiler,1ms interval; function-only capability',capability:capability.capability,
  maxCalls:16,plainCalls:12,profileCalls:4,enginePolicy:'DEFAULT',noProductChanges:true,noPerformanceConfirmation:true,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0,
  interpretation:'Profile and timing calls are separate; compile-generation logs never substitute for execution tier; no automatic native retries.'});
