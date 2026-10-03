import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {ROOT,MATRIX_ID,read} from './common.mjs';
import {TRACE_FLAGS} from './schedule.mjs';
const [id,mode,profileArg,engine,traceArg]=process.argv.slice(2),trace=traceArg==='1';
assert.equal(id,MATRIX_ID);assert.equal(mode,'SHARED_PROCESS_FRESH_WORKER');assert.equal(engine,'DEFAULT');assert.deepEqual(process.execArgv,trace?TRACE_FLAGS:[]);
assert(fs.readFileSync('/proc/self/cgroup','utf8').includes(process.env.A0_CHILD_CGROUP.split('/').at(-1)));
const entry=read(`${ROOT}/experiments/a0-diagnosis-20261003/INPUTS.json`).entries.find(e=>e.id===id);
let slot,active=false,closing=false;
process.on('message',async m=>{
  try{
    if(m.type==='call'){
      assert(!slot&&!active);active=true;
      const w=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{entry,variant:m.run.actualVariant,profile:profileArg==='1',engine,trace}});
      const exited=new Promise(resolve=>w.once('exit',code=>{if(!closing){console.error(`Unexpected Worker exit ${code}`);process.exit(1);}resolve();}));
      slot={w,exited};
      w.once('error',e=>{console.error(e.stack);process.exit(1);});
      w.on('message',msg=>{
        if(msg.type==='ready'){process.send({...msg,type:'worker-ready'});w.postMessage(m);return;}
        if(msg.type==='error'){console.error(msg.message);process.exit(1);}
        process.send(msg);
        if(msg.type==='audit-result'){active=false;process.send({type:'call-done',runId:msg.runId});}
      });
    }else if(m.type==='ack'||m.type==='profile-ack'){assert(slot&&active);slot.w.postMessage(m);}
    else if(m.type==='close'){assert(!active);closing=true;if(slot){slot.w.postMessage(m);await slot.exited;}process.disconnect();}
  }catch(e){console.error(e.stack);process.exit(1);}
});
process.send({type:'engine-ready',pid:process.pid,execArgv:process.execArgv,engine,trace,v8:process.versions.v8});
process.send({type:'session-ready'});
