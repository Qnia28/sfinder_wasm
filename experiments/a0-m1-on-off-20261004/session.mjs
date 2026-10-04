import { HERE, read, matrix, verify } from './common.mjs';
import { fullRequest } from './request.mjs';
import assert from 'node:assert/strict';
const registered=JSON.parse(process.argv[2]);let called=false,finished=false,ack;
process.on('message',async message=>{
  try {
    if(message.type==='ack'){assert.equal(message.runId,registered.runId);ack();return;}
    if(message.type==='close'){assert(finished);process.disconnect();return;}
    assert.equal(message.type,'call');assert(!called);called=true;assert.deepEqual(message.run,registered);
    const entry=read(`${HERE}/INPUTS.json`).entries.find(e=>e.id===registered.matrixId),m=matrix(entry);
    const acked=new Promise(resolve=>{ack=resolve;});
    process.send({type:'phase-start',runId:registered.runId});
    const raw=await fullRequest(entry,registered.policy,event=>process.send({...event,runId:registered.runId}));
    process.send({type:'phase-result',runId:registered.runId,raw,requestApiMs:raw.requestApiMs});await acked;
    const witness=verify(m,raw),probes=raw.calls.filter(c=>c.integrated);
    assert.equal(probes.length,1);assert.equal(probes[0].stateBudget,100000);
    assert.equal(probes[0].partitioned,registered.policy==='a0-m1');
    assert.equal(raw.exactProbeTrace.policy,registered.policy);
    process.send({type:'audit-result',runId:registered.runId,row:{...registered,...raw,witness,
      contract:{singleProbe:true,realThresholdAllowed:true,cpDelayMs:60000},status:'VERIFIED'}});
    finished=true;process.send({type:'call-done',runId:registered.runId});
  }catch(error){process.send({type:'error',runId:registered.runId,message:error.stack});}
});
process.send({type:'session-ready'});
