import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { HERE, ROOT, append } from './common.mjs';
let counter = 0;
export async function supervised(args, { script = 'sample.mjs', log, apiMs = 10000, startupMs = 30000, auditMs = 30000, thresholdApiMs = 30000, thresholdProcessMs = 45000 } = {}) {
  const linux = process.platform === 'linux', parent = process.env.A0_CGROUP_ROOT;
  if (linux && !parent) throw Error('Fresh hosted cgroup required');
  const cg = parent ? path.join(parent, `call-${process.pid}-${counter++}`) : null;
  if (cg) { execFileSync('sudo',['-n','mkdir',cg]); execFileSync('sudo',['-n','sh','-c',`echo 3221225472 > '${cg}/memory.max'; echo 0 > '${cg}/memory.swap.max'`]); }
  const resources = () => cg ? { cgroupPeakBytes: Number(fs.readFileSync(path.join(cg,'memory.peak'),'utf8')), cgroupCurrentBytes: Number(fs.readFileSync(path.join(cg,'memory.current'),'utf8')),
    cgroupEvents: Object.fromEntries(fs.readFileSync(path.join(cg,'memory.events'),'utf8').trim().split('\n').map(l=>{const [k,v]=l.split(' ');return [k,Number(v)];})), memoryMaxBytes:Number(fs.readFileSync(path.join(cg,'memory.max'),'utf8')), swapMaxBytes:Number(fs.readFileSync(path.join(cg,'memory.swap.max'),'utf8')) } : { localWithoutCgroup: true };
  let command = process.execPath, argv = [path.join(HERE,script),...args];
  if (cg) { command='/bin/bash'; argv=['-c',`sudo -n sh -c "echo $$ > '$A0_CHILD_CGROUP/cgroup.procs'" || exit 99; exec "$@"`,'a0',process.execPath,...argv]; }
  const start = performance.now(), events=[], persisted=[];
  return await new Promise((resolve,reject)=>{
    const proc=spawn(command,argv,{cwd:ROOT,env:{...process.env,A0_CHILD_CGROUP:cg??''},detached:linux,stdio:['ignore','pipe','pipe','ipc']});
    let out='',err='',timer,reap,active=null,terminal=null,killMs=null,persistenceMs=0;
    const record=e=>{events.push(e);if(log)append(log,{...e,resources:resources()});};
    const kill=reason=>{if(terminal)return;terminal=reason;killMs=performance.now()-start;const event={type:'kill',reason,engine:active,elapsedMs:killMs};try{record(event);}catch{if(!events.includes(event))events.push(event);}try{if(linux)process.kill(-proc.pid,'SIGKILL');else proc.kill('SIGKILL');}catch(e){reject(e);}reap=setTimeout(()=>reject(Error('Reap exceeded 2s')),2000);};
    const limit=(ms,reason)=>{clearTimeout(timer);timer=setTimeout(()=>kill(reason),ms);}; limit(startupMs,'TIMEOUT_STARTUP');
    proc.on('message',m=>{
      try {
        if(m.type==='phase-start'){if(active||!['integrated','threshold'].includes(m.engine))throw Error('Phase protocol');active=m.engine;record({type:m.type,engine:active,elapsedMs:performance.now()-start});limit(active==='threshold'?thresholdApiMs:apiMs,'TIMEOUT_API');}
        else if(m.type==='phase-result'){if(active!==m.engine)throw Error('Result protocol');clearTimeout(timer);const t=performance.now(),snapshot=resources();const raw={...m,elapsedMs:performance.now()-start,resources:snapshot};if(log)append(log,raw);persisted.push(raw);persistenceMs+=performance.now()-t;events.push({type:'phase-result',engine:active,elapsedMs:raw.elapsedMs});active=null;limit(auditMs,'TIMEOUT_AUDIT');proc.send({type:'ack',id:m.id});}
        else if(m.type==='audit-result'){const t=performance.now();if(log)append(log,m);persisted.push(m);persistenceMs+=performance.now()-t;}
        else if(m.type==='startup-done'){record({type:m.type,elapsedMs:performance.now()-start});limit(startupMs,'TIMEOUT_STARTUP');}
        else if(m.type==='threshold-process-start'){limit(thresholdProcessMs,'TIMEOUT_PROCESS');}
      }catch(e){err+=e.stack;kill('ERROR_PERSISTENCE_OR_PROTOCOL');}
    });
    proc.stdout.on('data',b=>{out+=b;if(out.length>32*2**20)kill('ERROR_OUTPUT_LIMIT');});proc.stderr.on('data',b=>{err+=b;if(err.length>2*2**20)kill('ERROR_LOG_LIMIT');});
    proc.once('error',e=>{clearTimeout(timer);clearTimeout(reap);reject(e);});
    proc.once('close',(code,signal)=>{clearTimeout(timer);clearTimeout(reap);const finalResources=resources();if(cg)execFileSync('sudo',['-n','rmdir',cg]);
      let result;if(!terminal&&code===0)try{result=JSON.parse(out.trim());}catch{terminal='ERROR_RESULT_PARSE';}
      if(finalResources.cgroupEvents?.oom_kill)terminal='OOM';if((finalResources.cgroupCurrentBytes??0)>64*2**20)terminal='ERROR_CGROUP_REAP';
      resolve({...result,status:terminal??result?.status??'ERROR',code,signal,stderr:err,events,persisted,resources:finalResources,persistenceMs,processWallMs:performance.now()-start,killToCloseMs:killMs===null?null:performance.now()-start-killMs});
    });
  });
}
