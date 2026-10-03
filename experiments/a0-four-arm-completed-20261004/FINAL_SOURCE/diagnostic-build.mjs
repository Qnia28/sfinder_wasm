import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,write,sha,ARMS} from './common.mjs';
const outputs={};
for(const arm of ARMS){
 const runtime=`${ROOT}/.a0/four/diagnostic-runtime/${arm}`;assert(!fs.existsSync(runtime));fs.mkdirSync(`${runtime}/wasm`,{recursive:true});
 const baselineSrc=fs.existsSync(`${ROOT}/.a0/four/original/src`)?`${ROOT}/.a0/four/original/src`:`${ROOT}/.a0/four/local/original/src`;
 fs.cpSync(arm==='R'?baselineSrc:`${ROOT}/src`,`${runtime}/src`,{recursive:true});fs.copyFileSync(`${ROOT}/wasm/legal_boards_4.lgb`,`${runtime}/wasm/legal_boards_4.lgb`);
 const binary=fs.readFileSync(`${ROOT}/.a0/four/build/diag-${arm==='R'?'A0':arm}/wasm32-unknown-unknown/release/pc_wasm.wasm`);
 const exports=WebAssembly.Module.exports(new WebAssembly.Module(binary));assert(exports.some(e=>e.name==='solver_four_arm_diag_get'));
 fs.writeFileSync(`${runtime}/wasm/pc_wasm.wasm`,binary);
 outputs[arm]={runtime:`.a0/four/diagnostic-runtime/${arm}`,wasmSha256:sha(binary),diagnostics:true,measured:false,partitioned:arm!=='R',
  compiledModuleSha256:sha(fs.readFileSync(`${ROOT}/rust/pc-core/src/min_cover_four_arm.rs`))};
}
write(`${ROOT}/.a0/four/DIAGNOSTIC_BUILD.json`,{status:'DIAGNOSTIC_ONLY_NOT_TIMING',outputs,counterNames:['boundCalls','boundCandidates','boundWords','cutoffHits','prunes','trailPushes','avoidedTrailPushes']});
