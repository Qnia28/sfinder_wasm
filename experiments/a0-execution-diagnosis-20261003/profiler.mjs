import inspector from 'node:inspector';
import assert from 'node:assert/strict';
export const micro=()=>Number(process.hrtime.bigint()/1000n);
export class CpuProfiler{
  constructor(){this.session=new inspector.Session();this.session.connect();this.started=false;}
  post(method,params={}){return new Promise((resolve,reject)=>this.session.post(method,params,(e,r)=>e?reject(e):resolve(r)));}
  async start(){assert(!this.started);await this.post('Profiler.enable');await this.post('Profiler.setSamplingInterval',{interval:1000});this.startBefore=micro();await this.post('Profiler.start');this.startAfter=micro();this.started=true;}
  async stop(){assert(this.started);const stopBefore=micro(),{profile}=await this.post('Profiler.stop'),stopAfter=micro();this.started=false;this.session.disconnect();return {profile,clock:{startBefore:this.startBefore,startAfter:this.startAfter,stopBefore,stopAfter},samplingIntervalUs:1000};}
}
export function functionIndex(frame){const m=frame.functionName.match(/wasm-function(?:\[|#)(\d+)\]?/);return m?Number(m[1]):null;}
export function inspect(profile){
  assert(Array.isArray(profile.nodes)&&Array.isArray(profile.samples)&&Array.isArray(profile.timeDeltas));
  assert.equal(profile.samples.length,profile.timeDeltas.length);assert(profile.endTime>=profile.startTime);
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));assert.equal(nodes.size,profile.nodes.length);
  assert(profile.samples.every(id=>nodes.has(id)));assert(profile.timeDeltas.every(d=>Number.isFinite(d)&&d>=0));
  const sampled=new Set(profile.samples),wasmNodes=profile.nodes.filter(n=>sampled.has(n.id)&&functionIndex(n.callFrame)!==null);
  return {samples:profile.samples.length,sampledWasmNodes:wasmNodes.map(n=>({id:n.id,index:functionIndex(n.callFrame),callFrame:n.callFrame})),
    functionIndices:[...new Set(wasmNodes.map(n=>functionIndex(n.callFrame)))].sort((a,b)=>a-b)};
}
