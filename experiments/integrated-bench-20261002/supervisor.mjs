import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {HERE} from './common.mjs';
// All timing limits are independently reset for every variant/repetition.
export async function supervised(args,{apiMs=10000,processMs=30000,cleanupMs=2000,script='sample.mjs'}={}){
 const start=performance.now(),events=[];
 const cg=process.env.BENCH_CGROUP;
 if(process.platform==='linux'&&!cg)throw Error('Hard 3GiB cgroup is required on hosted runners');
 let command=process.execPath,argv=['--max-old-space-size=2048',path.join(HERE,script),...args];
 const oomCount=()=>cg?Number(fs.readFileSync(path.join(cg,'memory.events'),'utf8').match(/^oom_kill (\d+)/m)?.[1]??0):0;
 const previousOOM=oomCount();
 if(cg){command='/bin/bash';argv=['-c',`sudo -n sh -c "echo $$ > '$BENCH_CGROUP/cgroup.procs'" || exit 99; exec "$@"`,'bench',process.execPath,...argv]}
 return await new Promise((resolve,reject)=>{
  const proc=spawn(command,argv,{cwd:path.resolve(HERE,'../..'),env:process.env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe','ipc']});
  let stdout='',stderr='',terminal=null,apiTimer,cleanupTimer,overflow=false;
  function kill(reason){
   if(terminal)return;terminal=reason;events.push({reason,elapsedMs:performance.now()-start});
   try{process.platform==='win32'?proc.kill('SIGKILL'):process.kill(-proc.pid,'SIGKILL')}catch(e){reject(e)}
   cleanupTimer=setTimeout(()=>reject(Error('Unreaped benchmark child')),cleanupMs);
  }
  const timer=setTimeout(()=>kill('TIMEOUT_PROCESS'),processMs);
  proc.on('message',m=>{if(m.type==='api-start'){events.push({type:m.type,elapsedMs:performance.now()-start});apiTimer=setTimeout(()=>kill('TIMEOUT_API'),apiMs)}else if(m.type==='api-done')clearTimeout(apiTimer)});
  proc.stdout.on('data',b=>{stdout+=b;if(stdout.length>16*2**20){overflow=true;kill('ERROR_OUTPUT_LIMIT')}});
  proc.stderr.on('data',b=>{stderr+=b;if(stderr.length>2**20){overflow=true;kill('ERROR_LOG_LIMIT')}});
  proc.once('error',e=>{clearTimeout(timer);clearTimeout(apiTimer);clearTimeout(cleanupTimer);reject(e)});
  proc.once('close',(code,signal)=>{
   clearTimeout(timer);clearTimeout(apiTimer);clearTimeout(cleanupTimer);
   let oom=false;
   if(cg){const current=Number(fs.readFileSync(path.join(cg,'memory.current'),'utf8'));oom=oomCount()>previousOOM;if(current>64*2**20){reject(Error(`Child cgroup not reaped:${current}`));return}}
   let result=null;
   if(!terminal&&code===0&&!overflow){try{result=JSON.parse(stdout.trim())}catch(e){terminal='ERROR_RESULT_PARSE'}}
   resolve({...(result??{}),status:oom?'OOM':terminal??(code===0&&result?result.status:'ERROR'),processWallMs:performance.now()-start,code,signal,stderr,events});
  });
 });
}
