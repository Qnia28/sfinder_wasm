import assert from 'node:assert/strict';
import {MATRIX_ID} from './common.mjs';
// Balanced fixed Latin ordering. Each session is a fresh process; no retries.
const blocks=[['R','A','RA','AR'],['A','AR','R','RA'],['RA','R','AR','A'],['AR','RA','A','R']];
export const schedule=blocks.flatMap((conditions,i)=>conditions.map((condition,j)=>({
  sessionId:`b${i+1}-p${j+1}-${condition}`,block:i+1,condition,profile:false,
  runs:[...condition].map((v,k)=>({runId:`order-b${i+1}-p${j+1}-${condition}-${k+1}-${v}`,
    matrixId:MATRIX_ID,stage:'order-diagnosis',kind:'measured',mode:'SHARED_PROCESS_FRESH_WORKER',actualVariant:v,label:v,
    condition,block:i+1,sessionId:`b${i+1}-p${j+1}-${condition}`,position:k+1,precededBy:k?condition[0]:null,
    repetition:i+1,instrumented:false}))
})));
assert.equal(schedule.length,16);assert.equal(schedule.flatMap(s=>s.runs).length,24);
export const profileSchedule=['RA','AR'].map((condition,i)=>({
  sessionId:`profile-${condition}`,block:0,condition,profile:true,
  runs:[...condition].map((v,k)=>({runId:`order-profile-${condition}-${k+1}-${v}`,matrixId:MATRIX_ID,
    stage:'order-profile',kind:'instrumented',mode:'SHARED_PROCESS_FRESH_WORKER',actualVariant:v,label:v,
    condition,block:0,sessionId:`profile-${condition}`,position:k+1,precededBy:k?condition[0]:null,
    repetition:1,instrumented:true}))
}));
export function evaluate(rows){
  const median=a=>{a=[...a].sort((x,y)=>x-y);return (a[(a.length-1)>>1]+a[a.length>>1])/2;};
  const groups={};
  for(const condition of ['R','A','RA','AR'])for(const v of [...condition]){
    const a=rows.filter(r=>r.condition===condition&&r.label===v&&r.stage==='order-diagnosis');
    if(a.length!==4)return {status:'PARTIAL_STOP',profileRequired:false};
    groups[`${condition}:${v}`]={samplesMs:a.map(r=>r.apiMs),medianMs:median(a.map(r=>r.apiMs))};
  }
  const aAfterR=groups['RA:A'].medianMs/groups['A:A'].medianMs;
  const rAfterA=groups['AR:R'].medianMs/groups['R:R'].medianMs;
  const firstAMatched=groups['AR:A'].medianMs/groups['A:A'].medianMs;
  const firstRMatched=groups['RA:R'].medianMs/groups['R:R'].medianMs;
  // Cause-screen thresholds, NOT product gates. Predeclared, bidirectional.
  const signals={aAfterR,rAfterA,firstAMatched,firstRMatched,
    standaloneAToR:groups['A:A'].medianMs/groups['R:R'].medianMs};
  return {status:'COMPLETE',groups,signals,
    profileRequired:Object.values(signals).some(r=>r<.9||r>1.1),
    profileReason:'At least one predeclared lifecycle/order ratio differs by >10%; locate API/core boundary only'};
}
