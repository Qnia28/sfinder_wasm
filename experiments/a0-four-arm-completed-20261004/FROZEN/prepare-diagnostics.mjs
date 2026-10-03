import assert from 'node:assert/strict';
import {HERE,read,write,ARMS} from './common.mjs';
const ids=['board-106--restricted-split--J','board-119--restricted-split--L','board-115--bag--ordinary','board-111--restricted-split--ordinary','board-028--restricted-split--ordinary'];
const entries=read(`${HERE}/INPUTS.json`).entries;assert(ids.every(id=>entries.some(e=>e.id===id)));
write(`${HERE}/DIAGNOSTIC_SCHEDULE.json`,{status:'PRE_REGISTERED_WORK_COUNTS_ONLY',inputs:ids,nativeCalls:20,stateBudget:100000,
 apiMs:30000,processMs:45000,startupMs:30000,auditMs:30000,durableAckMs:10000,reapMs:2000,
 timingEvidence:false,measuredBenchmarkCallsAdded:0,order:'After benchmark jobs on a separate standard runner; no measured calls share instrumentation',
 runs:ids.flatMap((matrixId,index)=>ARMS.map(arm=>({runId:`work-${index}-${arm}`,matrixId,arm,kind:'WORK_DIAGNOSTIC',host:'WORK_ONLY',blockId:`work-${index}`})))});
