import { ROOT, sha, requestMatrixSha256 } from './common.mjs';
import { pathToFileURL } from 'node:url';
// One fresh benchmark child invokes this once. Capture only the existing solver
// API boundary; do not change its budget, ordering, outputs or engine selection.
export async function fullRequest(entry,policy,notify=()=>{}){
  const start=performance.now();
  const {createWasmSolver,WasmPcSolver}=await import(pathToFileURL(`${ROOT}/src/wasm-backend.mjs`));
  const {calculateSaveMinimals,encodeSaveMinimalFumen}=await import(pathToFileURL(`${ROOT}/src/minimals-feature.mjs`));
  const {decodeAndValidate}=await import(pathToFileURL(`${ROOT}/src/pc-input.mjs`));
  const {coverageUniverse,packCoverageRows}=await import(pathToFileURL(`${ROOT}/src/pc-wasm-cover-matrix.mjs`));
  const solver=await createWasmSolver(entry.request.height),calls=[];let probeInput;
  const original=WasmPcSolver.prototype.minimumCoverAtCount;
  WasmPcSolver.prototype.minimumCoverAtCount=function(c,k,o){
    if(o.integrated)probeInput={coverage:c,qualityFor:o.qualityFor};
    if(o.integrated)notify({type:'probe-start',K:k,stateBudget:o.stateBudget,partitioned:!!o.partitioned});
    const t=performance.now(),v=original.call(this,c,k,o);
    calls.push({K:k,integrated:!!o.integrated,partitioned:!!o.partitioned,stateBudget:o.stateBudget??null,
      seedKeys:o.seedKeys,seedSha256:sha(JSON.stringify(o.seedKeys)),apiMs:performance.now()-t,
      completed:v.completed,searchedStates:v.searchedStates,keys:v.keys,qualityVector:v.qualityVector});
    if(o.integrated)notify({type:'probe-result',probe:calls.at(-1)});
    return v;
  };
  let calculation,output;
  try{
    const context=decodeAndValidate(entry.request.sourceFumen,entry.request.height);
    calculation=await calculateSaveMinimals({...entry.request,exactProbe:policy,solver},context);
    output=encodeSaveMinimalFumen(calculation);
  }finally{WasmPcSolver.prototype.minimumCoverAtCount=original;solver.close();}
  const requestApiMs=performance.now()-start,auditStart=performance.now();let regeneratedMatrixSha256=null;
  if(probeInput){
    const {rawCases,keys,keyIndex}=coverageUniverse(probeInput.coverage),packed=packCoverageRows(rawCases,keyIndex,probeInput.qualityFor);
    const rows=rawCases.map((_,i)=>Array.from({length:packed.offsets[i+1]-packed.offsets[i]},(_,j)=>{
      const edge=packed.offsets[i]+j;return [packed.ids[edge],packed.qualities[edge]];
    }));
    regeneratedMatrixSha256=requestMatrixSha256(keys,rawCases,rows);
  }
  const postTimingAuditMs=performance.now()-auditStart;
  return {minimalCount:calculation.minimalCount,keys:calculation.keys,humanQualityVector:calculation.humanQualityVector,
    humanQualityExact:calculation.humanQualityExact,qualityBackend:calculation.qualityBackend,
    exactProbeTrace:calculation.exactProbeTrace??null,primaryResolved:calculation.primaryResolved,
    outputSha256:sha(output),requestApiMs,postTimingAuditMs,regeneratedMatrixSha256,calls};
}
