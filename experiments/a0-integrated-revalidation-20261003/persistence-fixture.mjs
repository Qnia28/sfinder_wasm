const mode=process.argv[2],sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(mode==='startup-hang'){await sleep(60000);}
else{
  process.send({type:'phase-start',engine:'integrated'});
  if(mode==='api-hang')while(true){}
  if(mode==='independent')await sleep(120);
  const ack=new Promise(r=>process.on('message',m=>{if(m.type==='ack')r();}));
  process.send({type:'phase-result',engine:'integrated',id:'raw-fixture',raw:{keys:['000'],qualityVector:[1],count:1,completed:false,searchedStates:100000}});
  await ack;
  if(mode==='post-result-hang')await sleep(60000);
  else if(mode==='audit-failure'){console.error('Injected verifier failure');process.exitCode=1;}
  else if(mode==='bad-json')console.log('{');
  else if(mode==='independent'){
    process.send({type:'phase-start',engine:'threshold'});await sleep(120);
    const ack2=new Promise(r=>process.on('message',m=>{if(m.type==='ack'&&m.id==='threshold')r();}));
    process.send({type:'phase-result',engine:'threshold',id:'threshold',raw:{completed:true}});await ack2;console.log(JSON.stringify({status:'FIXTURE_PASS'}));
  }else console.log(JSON.stringify({status:'FIXTURE_PASS'}));
  process.disconnect();
}
