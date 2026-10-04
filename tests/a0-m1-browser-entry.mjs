import { createWasmSolver } from '../src/wasm-backend.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { solveExactSecondaryAsync } from '../src/min-cover-three-engine.mjs';
import { ExactSecondaryPool } from '../src/exact-secondary-pool.mjs';
import { isORToolsSupported } from '../src/ortools-min-cover.mjs';
const rows=[[[0,1],[1,2]],[[1,2],[2,3]],[[0,1],[2,3]],[[0,1],[2,3]]];
const m=createNumericCoverage(['000','001','002'],new Map(rows.map((r,i)=>[i,r])),rows.map((_,caseId)=>({caseId})));
const qualityFor=(key,id)=>m.qualityIndex.get(id)?.get(key);
const context={primary:{count:2,backend:'rust'},primaryKeys:['000','001'],primaryHard:false,
  requestedPrimary:'rust',requested:false,kernelStats:{cases:3,solutions:3,entries:6},secondary:'auto'};
window.capabilities={jspi:isORToolsSupported(),isolated:crossOriginIsolated};
window.probe=async policy=>{
  const solver=await createWasmSolver(4,{legal:false});
  try{return await solveExactSecondaryAsync(m.coverage,{...context,solver,qualityFor,exactProbe:policy});}finally{solver.close();}
};
window.transferred=async probe=>{
  const solver=await createWasmSolver(4,{legal:false});
  solver.minimumCoverAtCount=()=>{throw Error('transferred probe must not repeat');};
  try{return await solveExactSecondaryAsync(m.coverage,{...context,solver,qualityFor,exactProbe:'a0-m1',
    integratedProbe:{count:probe.count,keys:probe.keys,qualityVector:probe.qualityVector,completed:false,searchedStates:100000,
      exactProbeTrace:{policy:'a0-m1',status:'CAPPED',stateBudget:100000,searchedStates:100000}}});}finally{solver.close();}
};
window.pooled=async()=>{
  const pool=new ExactSecondaryPool(1);
  try{return await pool.submit(m.prepared,{...context,secondary:'rust',exactProbe:'a0-m1'}).secondaryPending;}finally{await pool.dispose();}
};
window.ready=true;
