import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { HERE, ROOT, read, write, sha, matrix } from './common.mjs';
import { isORToolsSupported } from '../../src/ortools-min-cover.mjs';
const origin=read(`${ROOT}/.a0-m1-comparison/ORIGIN.json`);assert.equal(origin.commit,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
assert(Date.now()<origin.computeDeadline);
assert.equal(process.version,'v24.13.0');assert.deepEqual(process.execArgv,[]);
const input=read(`${HERE}/INPUTS.json`);for(const e of input.entries)matrix(e);
const blobs=execFileSync('git',['ls-tree','-r','HEAD'],{encoding:'utf8'}).trim().split('\n').map(l=>{
  const [meta,file]=l.split('\t'),[mode,type,blob]=meta.split(' ');return {mode,type,blob,file};
});
const rebuilt=['wasm/pc_wasm.wasm','wasm/batch_wasm.wasm'];
for(const b of blobs){if((b.mode==='100644'||b.mode==='100755')&&!rebuilt.includes(b.file))assert.equal(sha(fs.readFileSync(path.join(ROOT,b.file))),sha(execFileSync('git',['show',`HEAD:${b.file}`],{maxBuffer:100*2**20})),b.file);}
assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),read(`${ROOT}/candidate/a0-m1/PROVENANCE.json`).referenceLinuxSha256);
write(`${ROOT}/.a0-m1-comparison/LOCK.json`,{status:'PASS_PRELAUNCH_PRODUCT_INPUT_RUNTIME_LOCK',origin,commit:origin.commit,
  sourceBlobs:blobs,rebuilt,inputs:input.entries.map(({id,sha256,identitySha256,K})=>({id,sha256,identitySha256,K})),
  referenceWasm:sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),candidateWasm:sha(fs.readFileSync(`${ROOT}/wasm/pc_a0_m1.wasm`)),
  batchWasm:sha(fs.readFileSync(`${ROOT}/wasm/batch_wasm.wasm`)),
  ortoolsSupported:isORToolsSupported(),runtime:'Node24.13 default flags, backend auto. Record CP availability; no browser-CP latency claim.',
  fullActualInputCallsBeforeThisCorrectedBenchmark:0,
  malformedEnvironmentRequestsInPriorAttempt:read(`${HERE}/launch.json`).malformedEnvironmentRequestsAlreadyAttempted??0,
  filterSemantics:'Actual unused queue piece, excluding undrawn bag pieces; one frozen filter per request, not full seven-filter UI.'});
