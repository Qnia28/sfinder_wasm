import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,read,write,sha,jsonSha,ARMS,matrix} from './common.mjs';
assert.equal(process.platform,'linux');const frozen=read(`${HERE}/FROZEN_BUILD.json`);
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,maxBuffer:128*2**20});
const fixedWrite=(file,value)=>fs.existsSync(file)?assert.deepEqual(read(file),value):write(file,value);
const observed=read(`${ROOT}/.a0/four/BUILD.json`);assert.deepEqual(observed,frozen.build);
assert.deepEqual(read(`${ROOT}/.a0/four/DIAGNOSTIC_BUILD.json`),frozen.diagnosticBuild);
assert.deepEqual(read(`${ROOT}/.a0/four/BASELINE_GATE.json`),frozen.baselineGate);
assert.deepEqual(read(`${ROOT}/.a0/four/CONTROL_GATE.json`),frozen.controlGate);
assert(observed.benchmarkEligible&&observed.sourceDefaultControlMatchesOriginal);
assert.equal(observed.outputs.R.wasmSha256,'73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3');
assert.equal(observed.outputs.R.wasmSha256,observed.outputs.A0.wasmSha256);assert.equal(observed.outputs.control.wasmSha256,observed.outputs.R.wasmSha256);
assert.equal(sha(fs.readFileSync(`${ROOT}/${observed.outputs.control.runtime}/wasm/pc_wasm.wasm`)),observed.outputs.R.wasmSha256);
for(const f of frozen.runtimeFiles)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
for(const arm of ARMS){const item=observed.outputs[arm];const wasm=fs.readFileSync(`${ROOT}/${item.runtime}/wasm/pc_wasm.wasm`);
 assert.equal(sha(wasm),item.wasmSha256);assert(!item.diagnostics&&item.measured);
 assert(!WebAssembly.Module.exports(new WebAssembly.Module(wasm)).some(e=>e.name.includes('four_arm_diag')));}
const names=git('ls-tree','-r','--name-only','HEAD','--','src','rust','wasm','package.json','package-lock.json',
 'experiments/a0-four-arm-20261003','experiments/a0-m1-retest-20261004','experiments/a0-diagnosis-20261003',
 'experiments/a0-execution-diagnosis-20261003','experiments/a0-integrated-revalidation-20261003','.github/workflows/a0-m1-retest.yml').toString().trim().split('\n');
const files=names.filter(n=>!n.includes('/results/')).map(file=>({file,sha256:sha(git('show',`HEAD:${file}`))}));
for(const f of files)assert.equal(sha(fs.readFileSync(`${ROOT}/${f.file}`)),f.sha256,f.file);
assert.equal(git('diff','--name-only',frozen.priorSourceCommit,'HEAD','--','src','rust','wasm','package.json','package-lock.json',
 'experiments/a0-four-arm-20261003/worker.mjs','experiments/a0-diagnosis-20261003').toString(),'');
const selection=read(`${HERE}/SELECTION.json`),schedule=read(`${HERE}/SCHEDULE.json`),campaign=read(`${HERE}/CAMPAIGN.json`);
assert.equal(schedule.actualCalls,campaign.actualNativeCallCap);assert.equal(schedule.runs.length,schedule.actualCalls);
for(const e of read(`${HERE}/INPUTS.json`).entries)matrix(e);
const origin=read(`${ROOT}/.a0/m1/ORIGIN.json`),commit=git('rev-parse','HEAD').toString().trim();assert.equal(commit,origin.sourceCommit);assert.equal(commit,process.env.GITHUB_SHA);
fixedWrite(`${ROOT}/.a0/m1/LOCK.json`,{commit,files,runtimeFiles:frozen.runtimeFiles,build:observed,origin,campaign,
 selectionSha256:jsonSha(selection),scheduleSha256:jsonSha(schedule),screeningSha256:jsonSha(read(`${HERE}/SCREENING.json`)),
 inputsSha256:jsonSha(read(`${HERE}/INPUTS.json`)),stage:'ONE_M1_RETEST_THEN_DECISION',productChanged:false,
 measuredRuntimesUnchanged:true,priorArtifactRunId:37134463920});
fixedWrite(`${ROOT}/.a0/m1/PREFLIGHT_GATE.json`,{status:'PASS_FROZEN_LINUX_BYTES_SOURCE_INPUTS_LOCKED',commit,actualInputCalls:0,
 priorArtifactRunId:37134463920,controlByteEqual:true,measuredRuntimesUnchanged:true});
