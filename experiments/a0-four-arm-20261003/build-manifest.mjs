import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,read,write,sha,EXPECTED_WASM} from './common.mjs';
const mode=process.argv[2];assert(['linux','local'].includes(mode));
if(mode==='linux')assert.equal(process.platform,'linux');
const paths=mode==='linux'?Object.fromEntries(['original','control','M1','M2'].map(a=>[a,`${ROOT}/.a0/four/build/${a}/wasm32-unknown-unknown/release/pc_wasm.wasm`])):
 Object.fromEntries(['base','control','M1','M2'].map(a=>[a==='base'?'original':a,`${ROOT}/.a0/four/local/${a}/wasm32-unknown-unknown/release/pc_wasm.wasm`]));
const original=fs.readFileSync(paths.original);if(mode==='linux')assert.equal(sha(original),EXPECTED_WASM,'Unmodified Linux rebuild must reproduce original R/A0 bytes');
const baselineSrc=mode==='linux'?`${ROOT}/.a0/four/original/src`:`${ROOT}/.a0/four/local/original/src`;
if(mode==='local'&&!fs.existsSync(baselineSrc)){
 fs.mkdirSync(`${ROOT}/.a0/four/local/original`,{recursive:true});
 const archive=execFileSync('git',['archive','c0cb2a048e7275bfea587d176b1954efff0a8a08','src'],{cwd:ROOT,maxBuffer:64*2**20});
 fs.writeFileSync(`${ROOT}/.a0/four/local/original/src.tar`,archive);
 execFileSync('tar',['-xf',`${ROOT}/.a0/four/local/original/src.tar`,'-C',`${ROOT}/.a0/four/local/original`]);
}
const outputs={},abi=WebAssembly.Module.exports(new WebAssembly.Module(original));
for(const arm of ['R','A0','M1','M2','control']){
 const runtime=`${ROOT}/.a0/four/runtime/${arm}`;assert(!fs.existsSync(runtime));
 fs.mkdirSync(`${runtime}/wasm`,{recursive:true});fs.cpSync(arm==='R'?baselineSrc:`${ROOT}/src`,`${runtime}/src`,{recursive:true});
 const binary=fs.readFileSync(paths[arm==='R'||arm==='A0'?'original':arm]);
 assert.deepEqual(WebAssembly.Module.exports(new WebAssembly.Module(binary)),abi,'Measured exports must not change');
 assert(!abi.some(e=>e.name.includes('four_arm_diag')));
 fs.writeFileSync(`${runtime}/wasm/pc_wasm.wasm`,binary);
 fs.copyFileSync(`${ROOT}/wasm/legal_boards_4.lgb`,`${runtime}/wasm/legal_boards_4.lgb`);
 outputs[arm]={runtime:`.a0/four/runtime/${arm}`,wasmSha256:sha(binary),bytes:binary.length,partitioned:arm!=='R',
  measured:arm!=='control',features:arm==='M1'?['pc-core/a0-lower-cutoff']:arm==='M2'?['pc-core/a0-last-sibling']:[],diagnostics:false};
}
assert.equal(outputs.R.wasmSha256,outputs.A0.wasmSha256);
write(`${ROOT}/.a0/four/BUILD.json`,{mode,benchmarkEligible:mode==='linux',compiler:execFileSync(process.env.RUSTC??'rustc',['--version']).toString().trim(),
 originalExpectedLinuxSha256:EXPECTED_WASM,outputs,sourceDefaultControlMatchesOriginal:sha(fs.readFileSync(paths.control))===sha(original),
 layoutLimit:'Independent binaries can have code-layout/compiler differences. Default-source control is synthetic-only; do not claim timing alone isolates arithmetic/trail causation.',source:read(`${HERE}/CAMPAIGN.json`).expectedA0Source});
console.log(JSON.stringify({status:'BUILDS_ASSEMBLED',mode,benchmarkEligible:mode==='linux',outputs}));
