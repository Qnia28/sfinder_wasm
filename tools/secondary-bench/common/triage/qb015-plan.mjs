import assert from 'node:assert/strict';
import {digest} from '../contracts.mjs';
import {FOLLOWUP_JOB,worstCall,validateBudget,capacity} from '../budget.mjs';
export const CAMPAIGN='QB015_CAUSAL_R19_20261013',PHASE='QB015_CAUSAL_R19';
export const ARMS=Object.freeze(['R19_DEV','R19_RC2','R19_PROBE100K','R19_PROBE10K','R19_PROBE1K','R19_DISCARD100K','R19_CP120','R19_PROBE100K_CP120']);
export const JOB=Object.freeze({...FOLLOWUP_JOB,parts:8,jobMs:125*60000,jobMinutes:150});
export const LIMITS=Object.freeze({startupMs:10000,callMs:600000,reapMs:5000});
export function tasksFor(ref,repeat){
  assert.equal(ref.id,'c7-2plus2-qb-row-015/restricted-split');assert([1,2].includes(repeat));
  const arms=[...ARMS].sort((a,b)=>digest({seed:'qb015-r19-v1',arm:a}).localeCompare(digest({seed:'qb015-r19-v1',arm:b})));
  if(repeat===2)arms.reverse();
  return arms.map((variant,position)=>{
    const id=`${PHASE}-${repeat}-${position}`;
    const identity={campaignId:CAMPAIGN,phase:PHASE,taskId:id,inputId:ref.id,inputHash:ref.sha256,variant,repeat,block:repeat,position,role:ref.metadata.dataset,measurementEpoch:19};
    return {id,phase:PHASE,adapter:'triage-fixture',calls:[{...identity,callId:digest(identity),limits:LIMITS}],worstMs:worstCall(LIMITS,JOB)};
  });
}
export function validateReservation(){
  validateBudget({maxParallel:2,overallMs:48*3600000,maxCalls:16,job:JOB});
  assert(8*worstCall(LIMITS,JOB)<=capacity(JOB));assert((2*150+15+30+10)/60<=6);
}
