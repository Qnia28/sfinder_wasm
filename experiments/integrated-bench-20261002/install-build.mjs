import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {HERE,ROOT,read,sha,jsonSha} from './common.mjs';
const buildDir=path.resolve(process.argv[2]);
const build=read(path.join(buildDir,'BUILD.json'));
const approval=read(path.join(HERE,'launch-development.json'));
assert.equal(build.baselineCommit,'c0cb2a048e7275bfea587d176b1954efff0a8a08');
assert.equal(build.planSha256,jsonSha(read(path.join(HERE,'PLAN.json'))));
assert.equal(build.inputsSha256,jsonSha(read(path.join(HERE,'INPUTS.json'))));
assert.equal(build.scheduleSha256,jsonSha(read(path.join(HERE,'SCHEDULE.json'))));
for(const source of [...build.candidateSources,...build.measurementHarnessSources]){
 const exception=approval.harnessExceptions.find(e=>e.file===source.file);
 if(exception){assert.equal(source.file,'experiments/integrated-bench-20261002/run.mjs');assert.equal(exception.pilotSha256,source.sha256);}
 const bytes=fs.readFileSync(path.join(ROOT,source.file));assert.equal(sha(bytes),exception?.currentSha256??source.sha256,`Candidate source changed since verified pilot: ${source.file}`);
 const blob=execFileSync('git',['show',`${build.candidateCommit}:${source.file}`],{cwd:ROOT,maxBuffer:32*2**20});assert.equal(sha(blob),source.sha256);
}
assert.equal(sha(fs.readFileSync(path.join(buildDir,'baseline.wasm'))),build.baselineWasmSha256);
assert.equal(sha(fs.readFileSync(path.join(buildDir,'candidate.wasm'))),build.candidateWasmSha256);
fs.copyFileSync(path.join(buildDir,'baseline.wasm'),path.join(ROOT,'.bench/baseline/wasm/pc_wasm.wasm'));
fs.copyFileSync(path.join(buildDir,'candidate.wasm'),path.join(ROOT,'wasm/pc_wasm.wasm'));
console.log('Verified pilot source/plan/input/schedule and reused identical comparator binaries.');
