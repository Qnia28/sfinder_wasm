import assert from 'node:assert/strict';
import {MATRIX_ID,HERE,read} from './common.mjs';
export const MODES={DEFAULT:[],LIFTOFF_ONLY:['--liftoff-only'],OPTIMIZED_FIRST:['--no-liftoff','--no-wasm-lazy-compilation']};
export const TRACE_FLAGS=['--trace-wasm-compilation-times','--trace-wasm-lazy-compilation'];
export function flags(mode,trace){assert(Object.hasOwn(MODES,mode));return [...MODES[mode],...(trace?TRACE_FLAGS:[])];}
const orders=[['DEFAULT','LIFTOFF_ONLY','OPTIMIZED_FIRST'],['LIFTOFF_ONLY','OPTIMIZED_FIRST','DEFAULT'],['OPTIMIZED_FIRST','DEFAULT','LIFTOFF_ONLY']];
function run(mode,v,rep,trace){return {runId:`tier-${trace?'trace':'plain'}-${rep}-${mode}-${v}`,matrixId:MATRIX_ID,stage:trace?'tier-trace':'tier-plain',kind:trace?'trace-and-profile':'untraced',
  mode:'SHARED_PROCESS_FRESH_WORKER',engineMode:mode,trace,engineFlags:flags(mode,trace),actualVariant:v,label:v,repetition:rep,instrumented:trace,position:1,sessionId:`tier-${trace?'trace':'plain'}-${rep}-${mode}-${v}`};}
export const schedule=orders.flatMap((modes,i)=>modes.flatMap((mode,j)=>(i+j)%2?['A','R'].map(v=>run(mode,v,i+1,false)):['R','A'].map(v=>run(mode,v,i+1,false))))
  .concat(Object.keys(MODES).flatMap((mode,i)=>(i%2?['A','R']:['R','A']).map(v=>run(mode,v,0,true))));
assert.equal(schedule.length,24);assert.equal(schedule.filter(r=>!r.trace).length,18);assert.equal(schedule.filter(r=>r.trace).length,6);
export const resume=read(`${HERE}/RESUME.json`);
assert.equal(resume.sourceRunId,37101047698);assert.equal(resume.successfulCallsReexecuted,0);assert.equal(resume.runs.length,20);
for(const [i,r]of resume.runs.entries()){
  const old=schedule[i+4];assert.equal(r.originalRunId,old.runId);
  for(const [k,v]of Object.entries(old))assert.deepEqual(r[k],k==='runId'||k==='sessionId'?`resume-${v}`:v);
}
export const executionSchedule=resume.runs;
export const CAMPAIGN={originRunId:37096100399,originCreated:'2026-10-03T04:18:25Z',computeMinutes:160,cancelMinutes:175,overallMinutes:180};
