// Read-only old-data selection. No solver imports or actual-input calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,HERE,read,write,sha,jsonSha,matrix,ARMS,ORDERS} from './common.mjs';
const old=read(`${ROOT}/experiments/a0-proof-retest-20261003/RETEST_SELECTION.json`);
const all=read(`${ROOT}/experiments/a0-integrated-revalidation-20261003/INPUTS.json`).entries;
const records=old.records.filter(r=>r.selected).map(r=>({id:r.matrixId,phase:r.phase,reasons:r.selectionReasons,isControl:r.selectedAsControl}));
assert.equal(records.length,121);
records.push({id:'board-028--restricted-split--ordinary',phase:'development',reasons:['PREVIOUS_COMMON_LOWER_BOUND_HOTSPOT'],isControl:false});
assert.equal(new Set(records.map(r=>r.id)).size,122);
const inputs=records.map(r=>all.find(e=>e.id===r.id));assert(inputs.every(Boolean));for(const e of inputs)matrix(e);
const references={},sources=[];
for(const source of old.sourceFiles){
 const bytes=fs.readFileSync(source.file);assert.equal(sha(bytes),source.sha256);sources.push(source);
 for(const row of bytes.toString().trim().split('\n').map(JSON.parse)){
  if(!records.some(r=>r.id===row.matrixId))continue;
  const arm=row.variant==='R'?'R':'A0';references[row.matrixId]??={};
  if(references[row.matrixId][arm])assert.equal(jsonSha(references[row.matrixId][arm]),jsonSha(row.probe));
  else references[row.matrixId][arm]=row.probe;
 }
}
assert.equal(Object.keys(references).length,122);
records.sort((a,b)=>sha(`four-arm-v1|${a.id}`).localeCompare(sha(`four-arm-v1|${b.id}`)));
const runs=[];
for(let host=0;host<5;host++){
 for(const record of records){
  const base=parseInt(sha(`four-arm-order-v1|${record.id}`).slice(0,8),16)%4;
  for(let repetition=0;repetition<2;repetition++){
   const orderIndex=(base+host*2+repetition)%4,blockId=`h${host}-${record.id}-b${repetition+1}`;
   ORDERS[orderIndex].forEach((arm,position)=>runs.push({runId:`${blockId}-${arm}`,blockId,matrixId:record.id,phase:record.phase,host,repetition:repetition+1,position:position+1,arm,orderIndex,kind:record.isControl?'SELECTED_CONTROL':'SELECTED'}));
  }
 }
 for(const phase of ['development','reserved']){
  const id=old.populations[phase].environmentControlId;
  for(const arm of ORDERS[host%4])for(let position=1;position<=2;position++){
   const blockId=`env-h${host}-${phase}-${arm}`;
   runs.push({runId:`${blockId}-${position}`,blockId,matrixId:id,phase,host,repetition:0,position,arm,orderIndex:null,kind:'ENVIRONMENT_CONTROL'});
  }
 }
}
assert.equal(runs.length,4960);
write(`${HERE}/INPUTS.json`,{entries:inputs});
write(`${HERE}/REFERENCES.json`,{references,sourceFiles:sources,originalProofReused:true,newNativeCalls:0});
write(`${HERE}/SELECTION.json`,{seed:'four-arm-v1',status:'FROZEN_PRE_NATIVE',originalSelectionSha256:sha(fs.readFileSync(`${ROOT}/experiments/a0-proof-retest-20261003/RETEST_SELECTION.json`)),originalSelectionCanonicalSha256:jsonSha(old),originalSelectionSha256Scope:'Historical preparation worktree bytes; canonical JSON hash guards identity across checkout platforms',originalRulesSha256:old.rulesSha256,
 originalSelectedWithControls:121,addedHotspot:1,inputs:122,records,environmentControlIds:Object.fromEntries(['development','reserved'].map(p=>[p,old.populations[p].environmentControlId])),wholePopulationGateReplacement:false});
write(`${HERE}/SCHEDULE.json`,{arms:ARMS,orders:ORDERS,blocksPerInput:10,jobs:5,callsPerJob:992,comparisonCalls:4880,environmentCalls:80,totalCalls:4960,runs});
console.log(JSON.stringify({status:'SELECTION_SCHEDULE_PREPARED',inputs:122,calls:4960,newSolverCalls:0}));
