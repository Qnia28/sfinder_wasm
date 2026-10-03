import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {HERE,ROOT,read} from './common.mjs';
const [id,mode,profileArg]=process.argv.slice(2),entry=read(`${HERE}/INPUTS.json`).entries.find(e=>e.id===id);
assert(entry&&['COLD','COMPILED','WARM'].includes(mode));
if(process.platform==='linux')assert(fs.readFileSync('/proc/self/cgroup','utf8').includes(process.env.A0_CHILD_CGROUP.split('/').at(-1)));
const workers=new Map(),modules=new Map();let active=null,closing=false;
if(mode==='COMPILED'){
  for(const v of ['R','A']){
    const root=v==='R'?`${ROOT}/.a0/baseline`:ROOT;
    const t=performance.now(),{compiledCoverModule}=await import(`${root}/src/exact-secondary-pool.mjs`),module=await compiledCoverModule();modules.set(v,module);
    process.send({type:'module-ready',variant:v,compileWithReadMs:performance.now()-t});
  }
}
async function make(variant){
  const w=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{entry,variant,module:modules.get(variant),profile:profileArg==='1'}});
  const ready=new Promise((resolve,reject)=>{
    w.once('error',reject);
    w.on('message',m=>{
      if(m.type==='ready'){resolve();return;}
      if(m.type==='error'){console.error(m.message);process.exit(1);}
      process.send(m);
      if(m.type==='audit-result'){
        const done=async()=>{if(mode!=='WARM'){w.postMessage({type:'close'});await exited;}active=null;process.send({type:'call-done',runId:m.runId});};void done();
      }
    });
  });
  const exited=new Promise(resolve=>w.once('exit',code=>{if(code&&!closing){console.error(`Worker exit ${code}`);process.exitCode=1;}resolve();}));
  await ready;return {w,exited};
}
process.on('message',async msg=>{
  try{
    if(msg.type==='call'){
      assert(!active);const v=msg.run.actualVariant;
      let slot=workers.get(v);if(!slot||mode!=='WARM'){slot=await make(v);workers.set(v,slot);}active={slot,runId:msg.run.runId};
      slot.w.postMessage(msg);
    }else if(msg.type==='ack'){assert(active?.runId===msg.runId);active.slot.w.postMessage(msg);}
    else if(msg.type==='close'){assert(!active);closing=true;for(const {w}of workers.values())w.postMessage({type:'close'});await Promise.all([...workers.values()].map(s=>s.exited));process.disconnect();}
  }catch(e){console.error(e.stack);process.exit(1);}
});
process.send({type:'session-ready'});
