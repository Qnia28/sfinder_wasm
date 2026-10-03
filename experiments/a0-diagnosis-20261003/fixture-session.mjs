const mode=process.argv[2];
if(mode==='startup-hang')setTimeout(()=>{},60000);else process.send({type:'session-ready'});
process.on('message',m=>{
  if(m.type==='close'){process.disconnect();return;}
  if(m.type==='call'){
    process.send({type:'phase-start',runId:m.run.runId});
    if(mode==='api-hang')while(true){}
    if(mode==='duplicate'){process.send({type:'phase-start',runId:m.run.runId});return;}
    process.send({type:'phase-result',runId:m.run.runId,raw:{keys:['000'],count:1,completed:false,qualityVector:[1],searchedStates:100000},options:{seedKeys:['000']},apiMs:1});
  }else if(m.type==='ack'){
    if(mode==='audit-hang')return;
    process.send({type:'audit-result',runId:m.runId,row:{runId:m.runId,status:'FIXTURE_PASS',witness:{keys:['000']},contract:null}});
    process.send({type:'call-done',runId:m.runId});
  }
});
