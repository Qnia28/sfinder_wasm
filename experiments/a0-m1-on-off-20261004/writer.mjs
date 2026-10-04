import fs from 'node:fs/promises';
let queue=Promise.resolve();
process.on('message',m=>{
  queue=queue.then(async()=>{
    if(m.type==='write'){const fd=await fs.open(m.file,'a');try{await fd.writeFile(JSON.stringify(m.value)+'\n');await fd.sync();}finally{await fd.close();}process.send({token:m.token,type:'written'});}
    else if(m.type==='close')process.disconnect();
  }).catch(e=>{process.send?.({type:'error',message:e.stack});process.exitCode=1;process.disconnect?.();});
});
