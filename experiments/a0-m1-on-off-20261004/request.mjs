import { ROOT, sha, requestMatrixSha256 } from './common.mjs';
import { pathToFileURL } from 'node:url';
// Full single-filter request: product enumeration, original per-save filter,
// adaptive primary/secondary and output encoding. Not a full seven-filter UI request.
export async function fullRequest(entry,policy,notify=()=>{}){
  const start=performance.now();
  const {createWasmSolver,WasmPcSolver}=await import(pathToFileURL(`${ROOT}/src/wasm-backend.mjs`));
  const {decodeAndValidate}=await import(pathToFileURL(`${ROOT}/src/pc-input.mjs`));
  const {expandPatternCasesInternal}=await import(pathToFileURL(`${ROOT}/src/pattern.mjs`));
  const {minimumCoverAdaptiveAsync}=await import(pathToFileURL(`${ROOT}/src/min-cover-adaptive.mjs`));
  const {makeOrderCountQuality}=await import(pathToFileURL(`${ROOT}/src/human-ranking.mjs`));
  const {orderMinimalKeysByCoverage}=await import(pathToFileURL(`${ROOT}/src/minimal-order.mjs`));
  const {encodePages}=await import(pathToFileURL(`${ROOT}/src/fumen.mjs`));
  const {collectUnusedMatrix}=await import('./unused-matrix.mjs');
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
    const cases=expandPatternCasesInternal(entry.request.analysisPattern);
    const compact=solver.enumeratePcPatternCompact(context.board,cases.map(c=>c.queue),entry.request.useHold??true);
    if(!compact)throw Error('Original unused-piece path requires product compact enumeration');
    const view=collectUnusedMatrix(compact,cases,entry.filter??'ordinary');
    const minimal=await minimumCoverAdaptiveAsync(view.coverage,{solver,qualityFor:makeOrderCountQuality(view.qualityIndex),
      exactQuality:entry.request.exactHumanQuality,primary:entry.request.primary,secondary:entry.request.secondary,
      exactProbe:policy,exactProbeTiming:entry.request.exactProbeTiming});
    const ordered=orderMinimalKeysByCoverage(minimal.keys,view.coverage);
    calculation={minimalCount:minimal.count,keys:ordered.keys,humanQualityVector:minimal.qualityVector,
      humanQualityExact:minimal.qualityExact,qualityBackend:minimal.qualityBackend,primaryResolved:minimal.primaryResolved,
      exactProbeTrace:minimal.exactProbeTrace};
    output=encodePages(context.board,ordered.keys.map(k=>view.geometry.byKey.get(k)),
      ordered.coverageCounts.map(count=>`${(count/cases.length*100).toFixed(2)}% (${count}/${cases.length})`),entry.request.height);
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
