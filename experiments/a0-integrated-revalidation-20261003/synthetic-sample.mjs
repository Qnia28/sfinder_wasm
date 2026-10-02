import {Worker} from 'node:worker_threads';
const [f,variant]=process.argv.slice(2),w=new Worker(new URL('./synthetic-worker.mjs',import.meta.url),{workerData:{fixture:Number(f),variant}});let result;
process.on('message',m=>w.postMessage(m));w.on('message',m=>{if(m.type==='result')result=m.result;else process.send?.(m);});
w.on('error',e=>{console.error(e.stack);process.exitCode=1;});
w.on('exit',code=>{if(code||!result)process.exitCode=1;else console.log(JSON.stringify(result));process.disconnect?.();});
