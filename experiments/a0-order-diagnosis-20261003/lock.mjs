import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,read,write,sha,MATRIX_ID} from './common.mjs';
import {schedule,profileSchedule} from './schedule.mjs';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:64*2**20});
assert.equal(git('diff','--name-only','edc4f2547207a509176a3e79dabf8a4995112220','HEAD','--','src','rust','wasm','tests','package.json','package-lock.json','experiments/a0-diagnosis-20261003').toString(),'');
const wasmSha256=sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`));assert.equal(wasmSha256,'73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3');
assert.equal(sha(fs.readFileSync(`${ROOT}/.a0/baseline/wasm/pc_wasm.wasm`)),wasmSha256);
const input=read(`${ROOT}/experiments/a0-diagnosis-20261003/INPUTS.json`),entry=input.entries.find(e=>e.id===MATRIX_ID);assert(entry);
const fd=fs.openSync(`${ROOT}/experiments/a0-diagnosis-20261003/${entry.pack}`,'r'),segment=Buffer.alloc(entry.length);
try{assert.equal(fs.readSync(fd,segment,0,segment.length,entry.offset),segment.length);}finally{fs.closeSync(fd);}assert.equal(sha(segment),entry.sha256);
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json','experiments/a0-order-diagnosis-20261003','experiments/a0-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003/common.mjs','experiments/a0-integrated-revalidation-20261003/deadline.mjs','.github/workflows/a0-order-diagnosis.yml').toString().trim().split('\n');
const files=names.filter(f=>!f.includes('/results/')&&!f.includes('/inputs/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
write(`${ROOT}/.a0/order/LOCK.json`,{schema:'a0-order-diagnosis-lock-v1',commit:git('rev-parse','HEAD').toString().trim(),baseline:'c0cb2a048e7275bfea587d176b1954efff0a8a08',evidenceParent:'edc4f2547207a509176a3e79dabf8a4995112220',wasmSha256,
  files,input:entry,schedule,profileSchedule,maximumNativeCalls:28,baseNativeCalls:24,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0,
  limits:{apiSeconds:10,processSeconds:30,callStartupSeconds:30,auditSeconds:30,durableAckSeconds:10,reapSeconds:2,computeMinutes:10,jobMinutes:15,runnerHoursCap:.25},
  affinity:'Worker OS thread pinned to smallest allowed logical CPU; background compiler threads not pinned; CPU frequency/SMT interference not controlled',
  lifecycle:'All conditions use same loader. Pair has sequential fresh Workers; first Worker remains alive through second call. No warmed calls, no imported compiled module, no explicit module-sharing intervention',
  goal:'First-call/preceding-other-export cause diagnosis, not product performance confirmation',newProductChanges:0,confirmationCalls:0});
