import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {HERE,ROOT,BASELINE,EXPECTED_WASM,read,write,sha,jsonSha} from './common.mjs';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:32*2**20}),commit=git('rev-parse','HEAD').toString().trim();
const names=git('ls-tree','-r','--name-only',BASELINE,'--','src','rust','package.json','package-lock.json').toString().trim().split('\n');
const changed=[],sources=names.map(file=>{const b=fs.readFileSync(`${ROOT}/${file}`),old=git('show',`${BASELINE}:${file}`);if(sha(b)!==sha(old))changed.push(file);return {file,sha256:sha(b),baselineSha256:sha(old)};});
assert.deepEqual(changed,['src/min-cover-exact-secondary.mjs']);
const candidate=git('show','e5f2f3d1a9885085e11cde7457aad2b338ca8130:src/min-cover-exact-secondary.mjs');assert.equal(sha(candidate),sha(fs.readFileSync(`${ROOT}/src/min-cover-exact-secondary.mjs`)));
const wasm=fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`);assert.equal(sha(wasm),EXPECTED_WASM);
const exports=WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(e=>e.name);assert(exports.includes('solver_min_cover_at_count_integrated_partitioned_bounded'));assert(!exports.some(n=>n.startsWith('solver_bench_')));
for(const p of read(`${HERE}/INPUTS.json`).packs)assert.equal(sha(fs.readFileSync(`${HERE}/${p.file}`)),p.sha256);
const harness=git('ls-tree','-r','--name-only',commit,'--','experiments/a0-integrated-revalidation-20261003','.github/workflows/a0-integrated-revalidation.yml').toString().trim().split('\n').filter(f=>!f.includes('/inputs/')).map(file=>({file,sha256:sha(fs.readFileSync(`${ROOT}/${file}`))}));
fs.mkdirSync(`${ROOT}/.a0/build`,{recursive:true});fs.copyFileSync(`${ROOT}/wasm/pc_wasm.wasm`,`${ROOT}/.a0/build/pc_wasm.wasm`);
write(`${ROOT}/.a0/build/BUILD.json`,{schema:'a0-integrated-revalidation-build-v1',candidateCommit:commit,baselineCommit:BASELINE,productCandidateCommit:'e5f2f3d1a9885085e11cde7457aad2b338ca8130',wasmSha256:sha(wasm),wasmExports:exports,
  sourceFiles:sources,harnessFiles:harness,changedProductSources:changed,nativeAlgorithmsChanged:false,inputsSha256:jsonSha(read(`${HERE}/INPUTS.json`)),scheduleSha256:jsonSha(read(`${HERE}/SCHEDULE.json`)),
  populationSha256:jsonSha(read(`${HERE}/POPULATION.json`)),referencesSha256:jsonSha(read(`${HERE}/EXACT_REFERENCES.json`)),planSha256:jsonSha(read(`${HERE}/PLAN.json`)),node:process.version,rust:execFileSync('rustc',['--version']).toString().trim(),actualInputPrimaryCalls:0,actualInputPcCalls:0,devApplied:false});
console.log(JSON.stringify({candidateCommit:commit,wasmSha256:sha(wasm),productRetuned:false,changedProductSources:changed}));
