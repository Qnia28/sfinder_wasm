import fs from 'node:fs';
import {Worker} from 'node:worker_threads';
import {ROOT} from './common.mjs';
// Compile/instantiate only. No solver constructor or actual-input/native call.
const w=new Worker(`
  const {parentPort,workerData}=require('node:worker_threads');
  parentPort.on('message',m=>{if(m==='close')parentPort.close();});
  WebAssembly.instantiate(workerData,{}).then(()=>parentPort.postMessage('compiled'),e=>{parentPort.postMessage({error:e.stack});parentPort.close();});
`,{eval:true,workerData:fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)});
w.on('message',m=>{if(m!=='compiled'){console.error(m);process.exitCode=1;}else console.log('BOOTSTRAP_COMPILE_ONLY_OK');w.postMessage('close');});
w.on('error',e=>{console.error(e.stack);process.exitCode=1;});
