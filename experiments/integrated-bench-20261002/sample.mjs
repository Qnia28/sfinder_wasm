import { Worker } from 'node:worker_threads';
import { HERE, read } from './common.mjs';
import path from 'node:path';
const [id,variant,phase]=process.argv.slice(2);
const entry=read(path.join(HERE,'INPUTS.json')).entries.find(m=>m.id===id);
if(!entry)throw Error('Unknown input');
const start=performance.now(), cpu=process.cpuUsage();
const w=new Worker(new URL('./engine-worker.mjs',import.meta.url),{workerData:{entry,variant,phase}});
let result;
w.on('message',message=>{
  if(message.type==='result')result=message.result;
  else process.send?.(message);
});
w.on('error',error=>{console.error(error.stack);process.exitCode=1});
w.on('exit',code=>{
  if(code!==0||!result){process.exitCode=1;return}
  const usage=process.resourceUsage();
  console.log(JSON.stringify({...result,sampleWallMs:performance.now()-start,cpu:process.cpuUsage(cpu),peakRssBytes:usage.maxRSS*1024}));
});
