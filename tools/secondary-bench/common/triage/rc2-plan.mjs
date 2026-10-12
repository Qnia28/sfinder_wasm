import assert from 'node:assert/strict';
import {digest} from '../contracts.mjs';
import {FOLLOWUP_JOB,worstCall,capacity,validateBudget} from '../budget.mjs';
export const CAMPAIGN='RC2_LINMAX_RELEASE_VALIDATION_R18_20261012';
export const JOB=Object.freeze({...FOLLOWUP_JOB,parts:10,jobMs:275*60000,jobMinutes:300});
export const LIMITS=Object.freeze({startupMs:10000,callMs:600000,reapMs:5000});
export const phaseFor=round=>`RC2_VALIDATION_${round}`;
export function blocksFor(inputs,round){
  assert([1,2,3].includes(round));assert.equal(inputs.length,130);assert.equal(new Set(inputs.map(f=>f.id)).size,130);
  const blocks=[];
  for(const repeat of [1,2]){
    const refs=[...inputs].sort((a,b)=>digest({seed:'r18-order-v1',round,id:a.id}).localeCompare(digest({seed:'r18-order-v1',round,id:b.id})));
    const tasks=refs.map(ref=>{
      const phase=phaseFor(round),id=`${phase}-${repeat}-${digest(ref.id).slice(0,24)}`;
      const first=parseInt(digest({seed:'r18-arms-v1',round,id:ref.id}).slice(0,2),16)%2;
      const arms=(first===(repeat-1))?['DEV','RC2']:['RC2','DEV'];
      const calls=arms.map((variant,position)=>{
        const identity={campaignId:CAMPAIGN,phase,taskId:id,inputId:ref.id,inputHash:ref.sha256,variant,repeat,block:repeat,position,role:ref.metadata.dataset,measurementEpoch:18};
        return {...identity,callId:digest(identity),limits:LIMITS};
      });
      return {id,phase,adapter:'triage-fixture',calls,worstMs:2*worstCall(LIMITS,JOB)};
    });
    for(let n=0;n<tasks.length;n+=10)blocks.push({round,repeat,index:blocks.length,tasks:tasks.slice(n,n+10)});
  }
  assert.equal(blocks.length,26);return blocks;
}
export function validateReservation(){
  validateBudget({maxParallel:12,overallMs:72*3600000,maxCalls:1560,job:JOB});
  assert(20*worstCall(LIMITS,JOB)<=capacity(JOB));
  // 78 measurement jobs, plan20m, final audit90m, contract workflow10m.
  assert((78*300+20+90+10)/60<=392);
}
