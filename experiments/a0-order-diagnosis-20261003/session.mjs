import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {HERE,ROOT,read,MATRIX_ID} from './common.mjs';
const [id,mode,profileArg]=process.argv.slice(2),entry=read(`${ROOT}/experiments/a0-diagnosis-20261003/INPUTS.json`).entries.find(e=>e.id===id);
assert(entry&&id===MATRIX_ID&&mode==='SHARED_PROCESS_FRESH_WORKER');
assert(fs.readFileSync('/proc/self/cgroup','utf8').includes(process.env.A0_CHILD_CGROUP.split('/').at(-1)));
const workers=new Map();let active=null,closing=false;
async function make(variant){
  assert(!workers.has(variant));
  const w=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{entry,variant,profile:profileArg==='1'}});
  const exited=new Promise(resolve=>w.once('exit',code=>{if(!closing){console.error(`Unexpected Worker exit ${code}`);process.exitCode=1;}resolve();}));
  const ready=new Promise((resolve,reject)=>{
    w.once('error',reject);
    w.on('message',m=>{
      if(m.type==='ready'){process.send({...m,type:'worker-ready'});resolve();return;}
      if(m.type==='error'){console.error(m.message);process.exit(1);}
      process.send(m);
      if(m.type==='audit-result'){active=null;process.send({type:'call-done',runId:m.runId});}
    });
  });
  await ready;return {w,exited};
}
process.on('message',async msg=>{
  try{
    if(msg.type==='call'){
      assert(!active);const v=msg.run.actualVariant;assert(!workers.has(v));
      const slot=await make(v);workers.set(v,slot);active={slot,runId:msg.run.runId};slot.w.postMessage(msg);
    }else if(msg.type==='ack'){assert(active?.runId===msg.runId);active.slot.w.postMessage(msg);}
    else if(msg.type==='close'){assert(!active);closing=true;for(const {w}of workers.values())w.postMessage({type:'close'});await Promise.all([...workers.values()].map(s=>s.exited));process.disconnect();}
  }catch(e){console.error(e.stack);process.exit(1);}
});
process.send({type:'session-ready'});
