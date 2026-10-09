import assert from 'node:assert/strict';
import test from 'node:test';
import { installWasmFailureTrace } from '../tools/secondary-bench/common/triage/wasm-failure-trace.mjs';

test('native diagnostic preserves WASM bytes, import aliases, result and exception identity', async () => {
  const events=[], bytes=new Uint8Array([0,97,115,109]), memory={buffer:{byteLength:16777216}};
  const tag=new WebAssembly.Tag({parameters:['i32']}), thrown=new WebAssembly.Exception(tag,[123]);
  let fail=false, seen, passed;
  const solve=async value=>{passed=value;if(fail)throw thrown;return 19;};
  const env={memory,emscripten_resize_heap(n){if(n>2147483648)return false;memory.buffer={byteLength:n};return true;}};
  const wasm={Exception:WebAssembly.Exception,
    instantiate:async (b,i)=>{assert.equal(b,bytes);seen=i;return {instance:{exports:{solve_model:solve}}};},
    promising:fn=>fn};
  const original={...wasm}, restore=installWasmFailureTrace((stage,detail)=>events.push({stage,...detail}),wasm);
  try {
    await wasm.instantiate(bytes,{env,wasi_snapshot_preview1:env});
    assert.equal(seen.env,seen.wasi_snapshot_preview1);assert.notEqual(seen.env,env);
    assert.equal(seen.env.emscripten_resize_heap(33554432),true);
    assert.equal(seen.env.emscripten_resize_heap(2147549184),false);
    const invoke=wasm.promising(solve);assert.equal(await invoke(9),19);assert.equal(passed,9);
    fail=true;await assert.rejects(invoke(10),e=>e===thrown);
    const event=events.at(-1);assert.equal(event.stage,'wasm-export-throw');assert.equal(event.wasmException,true);
    assert.equal(event.name,null);assert.equal(event.message,null);assert.equal(event.constructor,'Exception');
    assert.equal(event.lastGrowth.accepted,false);assert.equal(event.lastGrowth.requestedBytes,2147549184);
    // Reproduce the original information loss, without any solver or population call.
    const wire=structuredClone({name:thrown.name,message:thrown.message});
    const reconstructed=Object.assign(new Error(wire.message),{name:wire.name??'Error'});
    assert.equal(reconstructed.name,'Error');assert.equal(reconstructed.message,'');
  } finally {restore();}
  assert.equal(wasm.instantiate,original.instantiate);assert.equal(wasm.promising,original.promising);
});

test('real tiny WASM instantiation and JSPI return remain usable', {skip:typeof WebAssembly.promising!=='function'}, async () => {
  // (module (func (export "solve_model") (result i32) i32.const 7))
  const bytes=Uint8Array.from([0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,
    7,15,1,11,115,111,108,118,101,95,109,111,100,101,108,0,0,10,6,1,4,0,65,7,11]);
  const events=[],restore=installWasmFailureTrace((stage,detail)=>events.push({stage,...detail}));
  try {
    const {instance}=await WebAssembly.instantiate(bytes,{});
    assert.equal(await WebAssembly.promising(instance.exports.solve_model)(),7);
    assert.equal(events.at(-1).stage,'wasm-export-return');
  } finally {restore();}
});
