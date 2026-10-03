// Refresh only this experiment's generated local binaries after final source QA.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,read,sha} from './common.mjs';
const path=`${ROOT}/.a0/four/BUILD.json`,build=read(path);assert.equal(build.mode,'local');assert(!build.benchmarkEligible);
const reference=fs.readFileSync(`${ROOT}/${build.outputs.R.runtime}/wasm/pc_wasm.wasm`),abi=WebAssembly.Module.exports(new WebAssembly.Module(reference));
for(const arm of ['control','M1','M2']){
 const bytes=fs.readFileSync(`${ROOT}/.a0/four/local/${arm}/wasm32-unknown-unknown/release/pc_wasm.wasm`);
 assert.deepEqual(WebAssembly.Module.exports(new WebAssembly.Module(bytes)),abi);assert(!abi.some(e=>e.name.includes('four_arm_diag')));
 fs.writeFileSync(`${ROOT}/${build.outputs[arm].runtime}/wasm/pc_wasm.wasm`,bytes);build.outputs[arm].wasmSha256=sha(bytes);build.outputs[arm].bytes=bytes.length;
}
build.sourceDefaultControlMatchesOriginal=build.outputs.control.wasmSha256===build.outputs.R.wasmSha256;
build.finalRustSourceHashes=Object.fromEntries(['rust/pc-core/src/min_cover.rs','rust/pc-wasm/src/min_cover.rs'].map(file=>[file,sha(fs.readFileSync(`${ROOT}/${file}`))]));
fs.writeFileSync(path,JSON.stringify(build,null,2)+'\n');console.log(JSON.stringify({status:'FINAL_LOCAL_BINARIES_REFRESHED',outputs:build.outputs}));
