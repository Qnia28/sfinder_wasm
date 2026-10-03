import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ROOT,HERE,read,write,sha,EXPECTED_WASM} from './common.mjs';
const mode=process.argv[2];assert(['linux','local'].includes(mode));
if(mode==='linux')assert.equal(process.platform,'linux');
const paths=mode==='linux'?Object.fromEntries(['original','control','M1','M2'].map(a=>[a,`${ROOT}/.a0/four/build/${a}/wasm32-unknown-unknown/release/pc_wasm.wasm`])):
 Object.fromEntries(['base','control','M1','M2'].map(a=>[a==='base'?'original':a,`${ROOT}/.a0/four/local/${a}/wasm32-unknown-unknown/release/pc_wasm.wasm`]));
const original=fs.readFileSync(paths.original);
if(mode==='linux'){
 write(`${ROOT}/.a0/four/BASELINE_GATE.json`,{status:sha(original)===EXPECTED_WASM?'PASS':'BLOCKED_ORIGINAL_BINARY_DRIFT',sha256:sha(original),expectedSha256:EXPECTED_WASM,actualInputCalls:0});
 assert.equal(sha(original),EXPECTED_WASM,'Unmodified Linux rebuild must reproduce original R/A0 bytes');
}
const controlMatches=sha(fs.readFileSync(paths.control))===sha(original);
// Fail closed before synthetic or any actual-input work. Do not treat feature-off
// code-generation drift as an implementation effect in the four-arm benchmark.
if(mode==='linux'){
 write(`${ROOT}/.a0/four/CONTROL_GATE.json`,{status:controlMatches?'PASS':'BLOCKED_CONTROL_BINARY_DRIFT',originalSha256:sha(original),controlSha256:sha(fs.readFileSync(paths.control)),actualInputCalls:0,requirement:'Full byte equality, not just ABI/result parity'});
 assert(controlMatches,'Feature-off control differs from original WASM; four-arm benchmark blocked');
}
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
 if(mode==='linux'){
  const compiledModule=arm==='M1'||arm==='M2'?`${ROOT}/.a0/four/source/${arm}/rust/pc-core/src/min_cover.rs`:
   arm==='control'?`${ROOT}/rust/pc-core/src/min_cover.rs`:`${ROOT}/.a0/four/original/rust/pc-core/src/min_cover.rs`;
  outputs[arm].compiledModuleSha256=sha(fs.readFileSync(compiledModule));
  assert.equal(outputs[arm].compiledModuleSha256,sha(fs.readFileSync(`${ROOT}/rust/pc-core/src/${arm==='M1'||arm==='M2'?'min_cover_four_arm.rs':'min_cover.rs'}`)));
 }
}
assert.equal(outputs.R.wasmSha256,outputs.A0.wasmSha256);
write(`${ROOT}/.a0/four/BUILD.json`,{mode,benchmarkEligible:mode==='linux',compiler:execFileSync(process.env.RUSTC??'rustc',['--version']).toString().trim(),
 originalExpectedLinuxSha256:EXPECTED_WASM,outputs,sourceDefaultControlMatchesOriginal:sha(fs.readFileSync(paths.control))===sha(original),
  layoutLimit:'Feature-off control must equal original bytes on Linux. Active independent fixes can still change code layout; use separate work counters, not timing alone, for algorithm attribution.',source:read(`${HERE}/CAMPAIGN.json`).expectedA0Source});
console.log(JSON.stringify({status:'BUILDS_ASSEMBLED',mode,benchmarkEligible:mode==='linux',outputs}));
