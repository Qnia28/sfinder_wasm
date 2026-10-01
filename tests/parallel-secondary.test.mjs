import test from 'node:test';import assert from 'node:assert/strict';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {createNumericCoverage,numericPacked} from '../src/numeric-cover-data.mjs';
import {ExactSecondaryPool,withSecondaryPool} from '../src/exact-secondary-pool.mjs';
import {solveExactSecondary} from '../src/min-cover-exact-secondary.mjs';
const matrix=()=>createNumericCoverage(['a','b'],new Map([[0,[[0,1],[1,4]]],[1,[[0,1],[1,4]]],[2,[[0,4],[1,1]]]]),[{caseId:0},{caseId:1},{caseId:2}]);
const context={primary:{count:1,keys:['a'],backend:'rust'},primaryKeys:['a'],primaryHard:true,requestedPrimary:'Rust',requested:'auto',kernelStats:{cases:1,solutions:1,entries:1}};
test('secondary retains original weighted quality rows, deterministic results, and source buffers across worker reuse',async()=>{
 const solver=await createWasmSolver(4),m=matrix(),packed=numericPacked(m.prepared.rawCases),saved=Array.from(packed.qualities);
 const expected=solveExactSecondary(m.coverage,{...context,solver,qualityFor:(key,id)=>m.qualityIndex.get(id).get(key)});assert.deepEqual(expected.keys,['b']);
 try{for(const size of [1,2,4]){const pool=new ExactSecondaryPool(size);try{const values=await Promise.all(Array.from({length:9},()=>pool.submit(m.prepared,context).secondaryPending));for(const value of values)assert.deepEqual(value,expected);assert.equal(pool.slots.length,size);assert.deepEqual(Array.from(packed.qualities),saved);}finally{await pool.dispose()}assert.ok(pool.disposed);}}
 finally{solver.close()}
});
test('pool rejects pending work on disposal and supports a subsequent independent request',async()=>{
 const pool=new ExactSecondaryPool(2),pending=pool.submit(matrix().prepared,context).secondaryPending;await pool.dispose();await assert.rejects(pending,/ended/);assert.throws(()=>pool.submit(matrix().prepared,context),/disposed/);
 await withSecondaryPool(1,async dispatch=>assert.deepEqual((await dispatch(matrix().prepared,context).secondaryPending).keys,['b']));
});
test('worker errors reject queued jobs and dispose all workers',async()=>{
 const pool=new ExactSecondaryPool(1);const pending=[pool.submit(matrix().prepared,{...context,primary:{...context.primary,count:99}}).secondaryPending,pool.submit(matrix().prepared,context).secondaryPending];
 const outcomes=await Promise.allSettled(pending);assert.ok(outcomes.every(x=>x.status==='rejected'));await pool.dispose();assert.ok(pool.disposed);
});
test('auto requests only expensive follow-up searches; invalid worker budgets reject',async()=>{
 await withSecondaryPool('auto',async dispatch=>assert.equal(dispatch.onlyHeavy,true));await withSecondaryPool(0,async dispatch=>assert.equal(dispatch,null));
 for(const size of [-1,5,1.5])await assert.rejects(withSecondaryPool(size,()=>{}),RangeError);
});
test('auto transfers an exhausted integrated probe without rerunning it or changing exact metadata',async()=>{
 const solver=await createWasmSolver(4),m=matrix(),orig=solver.minimumCoverAtCount;let probes=0;
 solver.minimumCoverAtCount=function(coverage,k,opts){const r=orig.call(this,coverage,k,opts);if(opts.integrated){probes++;return {...r,completed:false}}return r};
 const options={...context,primaryHard:false,solver,qualityFor:(key,id)=>m.qualityIndex.get(id).get(key)};
 try{const expected=solveExactSecondary(m.coverage,options);probes=0;
 const actual=await withSecondaryPool('auto',async dispatch=>{const pending=solveExactSecondary(m.coverage,{...options,deferThreshold:ctx=>dispatch(m.prepared,ctx)});return pending.secondaryPending});
 assert.deepEqual(actual,expected);assert.equal(probes,1);
 }finally{solver.close()}
});
test('disposing an active slot rejects its job and joins worker termination',async()=>{
 const pool=new ExactSecondaryPool(1),pending=pool.submit(matrix().prepared,context).secondaryPending;
 while(!pool.slots.some(slot=>slot.active))await new Promise(resolve=>setImmediate(resolve));
 await pool.dispose();await assert.rejects(pending,/ended/);assert.ok(pool.disposed);
});

test('explicit routing gives identical exact results after worker dispatch', async () => {
 const solver=await createWasmSolver(4),m=matrix();
 const options={...context,decomposition:'auto',routingProbeStates:1,routingMinComponents:2};
 try {
  for(const routingStructureFirst of [false,true]) {
   const routed={...options,routingStructureFirst};
   const expected=solveExactSecondary(m.coverage,{...routed,solver,qualityFor:(key,id)=>m.qualityIndex.get(id).get(key)});
   const actual=await withSecondaryPool(1,async dispatch=>(dispatch(m.prepared,routed)).secondaryPending);
   assert.deepEqual(actual,expected);
  }
 } finally {solver.close()}
});
