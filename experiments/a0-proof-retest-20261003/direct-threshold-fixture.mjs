import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,verify} from './common.mjs';
const {createWasmSolver}=await import(pathToFileURL(`${ROOT}/.a0/baseline/src/wasm-backend.mjs`));
const {createNumericCoverage}=await import(pathToFileURL(`${ROOT}/.a0/baseline/src/numeric-cover-data.mjs`));
const m={keys:['000','001','002'],rows:[[[0,1],[1,1]],[[0,2],[1,2]],[[2,3]],[[2,3]]],K:2,seedKeys:['001','002']};
const {coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.rows.map((_,caseId)=>({caseId})));
const solver=await createWasmSolver(4,{legal:false});
try{
 assert.throws(()=>solver.minimumCoverAtCount(coverage,2,{stateBudget:2000000}),/positive human-quality provider/);
 const r=solver.minimumCoverAtCount(coverage,2,{seedKeys:m.seedKeys,stateBudget:2000000,integrated:false,partitioned:false,dominance:false,
  qualityFor:()=>{throw Error('Synthetic numeric rows must bypass quality callback');}});
 assert(r.completed);const w=verify(m,r);assert.deepEqual(w.selectedIDs,[0,2]);assert.deepEqual(r.qualityVector,[1,2,3,3]);
 console.log(JSON.stringify({status:'DIRECT_THRESHOLD_FIXTURE_PASS',nativeSyntheticCalls:1,actualInputCalls:0,missingProviderRejected:true,
  numericCallbackUnused:true,weightedDuplicateRowsPreserved:true,stableIdTieBreakPassed:true,witness:w}));
}finally{solver.close();}
