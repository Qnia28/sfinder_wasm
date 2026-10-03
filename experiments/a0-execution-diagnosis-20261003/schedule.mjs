import assert from 'node:assert/strict';
import {MATRIX_ID} from './common.mjs';
export const CAMPAIGN={originRunId:37096100399,originCreated:'2026-10-03T04:18:25Z',computeMinutes:160,cancelMinutes:175,overallMinutes:180};
export const LIMITS={apiMs:30000,processMs:45000,startupMs:45000,auditMs:30000,profileExportMs:10000,durableAckMs:10000,reapMs:2000,
  // Two independent startup waits, API/process bounded by45s, audit30s,
  // separate profile10s, record ACK10s and reap2s plus admission10s margin.
  admissionWorstMs:197000,computeMinutes:17,jobMinutes:20};
export const TRACE_FLAGS=['--trace-wasm-compilation-times','--trace-wasm-lazy-compilation'];
const pairs=[['RR',1,false],['RA',1,false],['AR',1,false],['RA',1,true],['AA',2,false],['AR',2,false],['RA',2,false],['AR',2,true]];
export const schedule=pairs.flatMap(([pair,block,profile],i)=>[...pair].map((v,j)=>({runId:`exec-${i+1}-${j+1}-${v}`,matrixId:MATRIX_ID,
  stage:profile?'execution-profile':'execution-plain',kind:profile?'inspector-and-compilation-trace':'untraced',mode:'SHARED_PROCESS_FRESH_WORKER',
  actualVariant:v,label:v,pair,pairId:`pair-${i+1}`,block,position:j+1,profile,trace:profile,instrumented:profile,engineMode:'DEFAULT',
  engineFlags:profile?TRACE_FLAGS:[],sessionId:`exec-${i+1}-${j+1}-${v}`})));
assert.equal(schedule.length,16);assert.equal(schedule.filter(r=>r.profile).length,4);
