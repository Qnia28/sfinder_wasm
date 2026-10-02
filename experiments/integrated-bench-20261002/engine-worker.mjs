import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, matrixInput, tune, dominanceAudit, verify } from './common.mjs';
const { entry, variant, phase } = workerData;
if (!['pilot','development','legacy','reserved','crosscheck'].includes(phase)) throw Error('Invalid phase');
if (entry.partition==='reserved-validation' && !['reserved','crosscheck'].includes(phase)) throw Error('Reserved input forbidden');
const timing = {}, start = performance.now();
const m = matrixInput(entry); timing.inputMs=performance.now()-start;
const source = ['H0','P0','THRESHOLD'].includes(variant) ? path.join(ROOT,'.bench/baseline') : ROOT;
const { createWasmSolver } = await import(pathToFileURL(path.join(source,'src/wasm-backend.mjs')));
const { createNumericCoverage } = await import(pathToFileURL(path.join(source,'src/numeric-cover-data.mjs')));
const init=performance.now(); const solver=await createWasmSolver(4,{legal:false}); timing.initMs=performance.now()-init;
try {
  // Enumeration and primary are impossible through this benchmark wrapper.
  for (const name of ['enumeratePcPatternCompact','minimumCoverCardinality','primaryKernelize','minimumCover','minimumCoverIds']) solver[name]=()=>{throw Error(`FORBIDDEN_BENCH:${name}`)};
  if (variant!=='THRESHOLD') tune(solver,variant);
  parentPort.postMessage({type:'api-start'});
  const api=performance.now();
  const {coverage}=createNumericCoverage(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.cases??m.rows.map((_,caseId)=>({caseId})));
  const result=solver.minimumCoverAtCount(coverage,m.K,{qualityFor:()=>{throw Error('Must use numeric qualities')},seedKeys:m.seedKeys,integrated:variant!=='THRESHOLD',partitioned:!['H0','THRESHOLD'].includes(variant),stateBudget:variant==='THRESHOLD'?2000000:100000});
  timing.apiMs=performance.now()-api;
  parentPort.postMessage({type:'api-done'});
  const validation=performance.now(), proof=verify(m,result);
  const dominance=variant==='THRESHOLD'?null:dominanceAudit(solver,variant);
  if(dominance && (!dominance.status || dominance.allocatedBytes>64*2**20 || dominance.pairVisits+dominance.wordComparisons+dominance.qualityComparisons>50000000))throw Error('Dominance telemetry/guard violation');
  const memory=solver.e.memory.buffer.byteLength;
  timing.verifyMs=performance.now()-validation;
  const effective = !result.completed && variant.includes('D') ? {ids:proof.seedIDs,qualityRLE:proof.seedQualityRLE} : {ids:proof.ids,qualityRLE:proof.qualityRLE};
  parentPort.postMessage({type:'result',result:{status:result.completed?'EXACT':'CAPPED',K:m.K,selectedIDs:proof.ids,qualityRLE:proof.qualityRLE,qualitySha256:proof.qualitySha256,seedSha256:proof.seedSha256,effective,states:result.searchedStates,dominance,wasmPeakBytes:memory,timing,nativePrepMs:null,dominanceMs:null,searchMs:null}});
} finally {solver.close()}
