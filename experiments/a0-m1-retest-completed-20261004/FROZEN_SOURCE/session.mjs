import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {HERE,read} from './common.mjs';
assert.equal(process.platform,'linux');assert.equal(process.env.FOUR_SYNTHETIC_FIXTURE,undefined);
assert(fs.readFileSync('/proc/self/cgroup','utf8').includes(process.env.A0_CHILD_CGROUP.split('/').at(-1)));
let slot,active=false,closing=false;
// Parent validates the full frozen schedule once; bind this one fresh child to one exact slot.
// Avoid parsing the73k-call schedule in every subprocess (that would alter startup cost substantially).
const registered=JSON.parse(process.argv[2]);assert(registered.runId&&['R','A0','M1'].includes(registered.arm));
process.on('message',async m=>{
 try{
  if(m.type==='call'){
   assert(!slot&&!active);active=true;
   assert.deepEqual(m.run,registered);
   const entry=read(`${HERE}/INPUTS.json`).entries.find(e=>e.id===m.run.matrixId);assert(entry);assert(['R','A0','M1'].includes(m.run.arm));
   const w=new Worker(new URL('../a0-four-arm-20261003/worker.mjs',import.meta.url),{workerData:{entry,arm:m.run.arm,diagnostic:false,fixture:null}});
   const exited=new Promise(resolve=>w.once('exit',code=>{if(!closing){console.error(`Unexpected Worker exit ${code}`);process.exit(1);}resolve();}));slot={w,exited};
   w.on('error',e=>{console.error(e.stack);process.exit(1);});
   w.on('message',msg=>{if(msg.type==='ready'){process.send({...msg,type:'worker-ready'});w.postMessage(m);return;}
    if(msg.type==='error'){console.error(msg.message);process.exit(1);}process.send(msg);
    if(msg.type==='audit-result'){active=false;process.send({type:'call-done',runId:msg.runId});}});
  }else if(m.type==='ack'){assert(slot&&active);slot.w.postMessage(m);}
  else if(m.type==='close'){assert(!active);closing=true;if(slot){slot.w.postMessage(m);await slot.exited;}process.disconnect();}
 }catch(e){console.error(e.stack);process.exit(1);}
});process.send({type:'session-ready'});
