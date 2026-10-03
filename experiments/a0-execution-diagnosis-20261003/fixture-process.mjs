import {Worker} from 'node:worker_threads';
const w=new Worker(new URL('./capability-worker.mjs',import.meta.url));
w.on('message',m=>process.send(m));w.on('error',e=>{console.error(e.stack);process.exitCode=1;});
w.on('exit',code=>{if(code)process.exitCode=code;if(process.connected)process.disconnect();});
