// Optional synthetic work-count diagnostic, never benchmark timing evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,write,verify} from './common.mjs';
const mode=process.argv[2];assert(['local','linux'].includes(mode));const records={};
const revision=process.argv[3]??'initial';assert(/^[a-z0-9-]+$/.test(revision));
const m={keys:['000','001','002'],rows:[[[0,1],[1,1]],[[1,7],[2,7]],[[0,23],[2,23]],[[0,1],[1,1]]],K:2,seedKeys:['001','002']};
for(const arm of ['A0','M1','M2']){
 const runtime=`${ROOT}/.a0/four/diagnostic/${revision}/${arm}`;assert(!fs.existsSync(runtime));fs.mkdirSync(`${runtime}/wasm`,{recursive:true});
 fs.cpSync(`${ROOT}/src`,`${runtime}/src`,{recursive:true});fs.copyFileSync(`${ROOT}/wasm/legal_boards_4.lgb`,`${runtime}/wasm/legal_boards_4.lgb`);
 const source=`${ROOT}/.a0/four/${mode==='local'?'local':'build'}/diag-${arm}/wasm32-unknown-unknown/release/pc_wasm.wasm`;
 fs.copyFileSync(source,`${runtime}/wasm/pc_wasm.wasm`);
 const {createWasmSolver}=await import(pathToFileURL(`${runtime}/src/wasm-backend.mjs`));
 const {createNumericCoverage}=await import(pathToFileURL(`${runtime}/src/numeric-cover-data.mjs`));
 const solver=await createWasmSolver(4,{legal:false});
 try{
  const {coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.rows.map((_,caseId)=>({caseId})));
  assert.equal(typeof solver.e.solver_four_arm_diag_reset,'function');solver.e.solver_four_arm_diag_reset();
  const probe=solver.minimumCoverAtCount(coverage,m.K,{seedKeys:m.seedKeys,stateBudget:100000,integrated:true,partitioned:true,qualityFor:()=>{throw Error('numeric only');}});
  const counters=Array.from({length:7},(_,i)=>solver.e.solver_four_arm_diag_get(i));assert(counters.every(Number.isSafeInteger));
  records[arm]={probe,witness:verify(m,probe),counters:Object.fromEntries(['boundCalls','boundCandidates','boundWords','cutoffHits','prunes','trailPushes','avoidedTrailPushes'].map((k,i)=>[k,counters[i]]))};
 }finally{solver.close();}
}
assert.deepEqual(records.M1.probe,records.A0.probe);assert.deepEqual(records.M2.probe,records.A0.probe);
assert(records.M1.counters.boundWords<records.A0.counters.boundWords);
assert.equal(records.M1.counters.boundCalls,records.A0.counters.boundCalls);
assert.equal(records.M1.counters.prunes,records.A0.counters.prunes);
assert(records.M2.counters.trailPushes<records.A0.counters.trailPushes);
assert.equal(records.M2.counters.boundWords,records.A0.counters.boundWords);
write(`${ROOT}/.a0/four/DIAGNOSTIC_SYNTHETIC-${revision}.json`,{status:'DIAGNOSTIC_SYNTHETIC_WORK_REDUCTION_PASS',mode,syntheticNativeCalls:3,actualInputCalls:0,timingEvidence:false,records});
console.log(JSON.stringify({status:'DIAGNOSTIC_SYNTHETIC_WORK_REDUCTION_PASS',mode,records}));
