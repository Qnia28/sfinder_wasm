const mode=process.argv[2];let acked=false;
if(mode!=='startup')process.send({type:'session-ready'});
process.on('message',m=>{
  if(m.type==='close'){process.disconnect();return;}
  if(m.type==='ack'){
    acked=true;
    if(mode==='audit')return;
    process.send({type:'audit-result',runId:m.runId,row:{runId:m.runId,status:'VERIFIED',witness:{synthetic:true},contract:{ackReceived:acked}}});
    process.send({type:'call-done',runId:m.runId});return;
  }
  if(m.type==='call'){
    process.send({type:'phase-start',runId:m.run.runId});
    if(mode==='api')return;
    process.send({type:'phase-result',runId:m.run.runId,raw:{synthetic:true}});
  }
});
