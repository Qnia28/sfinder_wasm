import {digest} from '../contracts.mjs';
import {FOLLOWUP_JOB,worstCall,validateBudget,capacity} from '../budget.mjs';
import assert from 'node:assert/strict';
export const CAMPAIGN='RC_REGRESSION_R17_FACTORIAL_20261012';
export const PHASE='R17_FACTORIAL';
export const ARMS=Object.freeze(Array.from({length:8},(_,n)=>`P${n>>2}C${(n>>1)&1}M${n&1}`));
export const JOB=Object.freeze({...FOLLOWUP_JOB,parts:8,jobMs:125*60000,jobMinutes:150});
export const LIMITS=Object.freeze({startupMs:10000,callMs:600000,reapMs:5000});
export function tasksFor(ref,input,repeat) {
  assert(Number.isInteger(input)&&input>=0&&input<4&&[1,2].includes(repeat));
  const order=[...ARMS].sort((a,b)=>digest({seed:'r17-pcm-v1',inputId:ref.id,arm:a}).localeCompare(digest({seed:'r17-pcm-v1',inputId:ref.id,arm:b})));
  if(repeat===2)order.reverse();
  return order.map((variant,position)=>{
    const id=`${PHASE}-${input}-${repeat}-${position}`;
    const identity={campaignId:CAMPAIGN,phase:PHASE,taskId:id,inputId:ref.id,inputHash:ref.sha256,variant,repeat,block:repeat,position,role:ref.metadata.dataset,measurementEpoch:17};
    return {id,phase:PHASE,adapter:'triage-fixture',calls:[{...identity,callId:digest(identity),limits:LIMITS}],worstMs:worstCall(LIMITS,JOB)};
  });
}
export function validateReservation(){
  validateBudget({maxParallel:12,overallMs:48*3600000,maxCalls:64,job:JOB});
  assert(8*worstCall(LIMITS,JOB)<=capacity(JOB));
  // 8*150min workers + 15min activation + 30min audit + 10min contract workflow.
  assert((8*150+15+30+10)/60<21);
}
