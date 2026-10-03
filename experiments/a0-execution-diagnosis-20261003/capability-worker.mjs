import fs from 'node:fs';
import {parentPort} from 'node:worker_threads';
import {CpuProfiler,micro,inspect} from './profiler.mjs';
import {HERE} from './common.mjs';
parentPort.on('message',()=>{});
try{
  const {instance}=await WebAssembly.instantiate(fs.readFileSync(`${HERE}/fixture.wasm`),{});
  const p=new CpuProfiler();await p.start();
  const begin=micro(),segments=[];
  for(const [name,args]of [['spinA',[80000000]],['spinB',[80000000]],['recursive',[12,80000000]]]){
    const start=micro();let count=0,value=0;do{value=instance.exports[name](...args);count++;}while(micro()-start<250000);
    segments.push({name,start,end:micro(),count,value});
  }
  const end=micro(),result=await p.stop(),summary=inspect(result.profile);
  parentPort.postMessage({...result,summary,begin,end,segments,pid:process.pid,execArgv:process.execArgv,
    capability:summary.functionIndices.includes(0)&&summary.functionIndices.includes(1)?'FUNCTION_ONLY':'UNUSABLE',
    tierIdentified:false,tierLimitation:'Inspector callFrame has function identity but no explicit validated execution-tier field.'});
}catch(e){parentPort.postMessage({error:e.stack});}
parentPort.close();
