import test from'node:test';
import assert from'node:assert/strict';
import{SolverWorkerClient}from'../src/worker-client.mjs';

class Mock{
  constructor({throwPost=false}={}){this.sent=[];this.terminated=false;this.throwPost=throwPost}
  postMessage(m){if(this.throwPost){this.throwPost=false;throw new Error('post failed')}this.sent.push(m)}
  terminate(){this.terminated=true}
  reply(m){this.onmessage?.({data:m})}
  fail(message='worker exploded'){this.onerror?.({message,error:new Error(message),preventDefault(){}})}
  messageFail(){this.onmessageerror?.({message:'bad clone'})}
}

function success(worker,index=0,value={success:1}){const id=worker.sent[index].id;worker.reply({id,ok:true,value});return id}

test('cancel terminates, rejects all requests, and respawns worker',async()=>{
  const ws=[],c=new SolverWorkerClient(()=>{const w=new Mock;ws.push(w);return w});
  const p1=c.request('chance',{}),p2=c.request('chance',{});
  assert.equal(ws[0].sent.length,1);
  c.cancel();
  await assert.rejects(p1,{name:'AbortError'});
  await assert.rejects(p2,{name:'AbortError'});
  assert.equal(ws[0].terminated,true);
  assert.equal(ws.length,2);
  const p3=c.request('chance',{});success(ws[1]);assert.deepEqual(await p3,{success:1});
  c.dispose();
});

test('requests are serialized so one request can be cancelled without losing queued work',async()=>{
  const ws=[],c=new SolverWorkerClient(()=>{const w=new Mock;ws.push(w);return w});
  const a=new AbortController(),b=new AbortController();
  const p1=c.request('a',{}, {signal:a.signal});
  const p2=c.request('b',{}, {signal:b.signal});
  const p3=c.request('c',{});
  assert.equal(ws[0].sent.length,1);
  b.abort();
  await assert.rejects(p2,{name:'AbortError'});
  success(ws[0],0,{a:1});assert.deepEqual(await p1,{a:1});
  assert.equal(ws[0].sent.length,2);
  success(ws[0],1,{c:1});assert.deepEqual(await p3,{c:1});
  c.dispose();
});

test('aborting active request restarts worker and continues queued requests',async()=>{
  const ws=[],c=new SolverWorkerClient(()=>{const w=new Mock;ws.push(w);return w});
  const controller=new AbortController();
  const p1=c.request('slow',{}, {signal:controller.signal});
  const p2=c.request('next',{});
  controller.abort();
  await assert.rejects(p1,{name:'AbortError'});
  assert.equal(ws[0].terminated,true);
  assert.equal(ws.length,2);
  assert.equal(ws[1].sent.length,1);
  success(ws[1],0,{next:true});assert.deepEqual(await p2,{next:true});
  c.dispose();
});

test('worker onerror rejects active and queued promises instead of hanging',async()=>{
  const w=new Mock,c=new SolverWorkerClient(()=>w);
  const p1=c.request('a',{}),p2=c.request('b',{});
  w.fail('load wasm failed');
  await assert.rejects(p1,/load wasm failed/);
  await assert.rejects(p2,/load wasm failed/);
  assert.equal(w.terminated,true);
  c.dispose();
});

test('worker onmessageerror rejects pending promises instead of hanging',async()=>{
  const w=new Mock,c=new SolverWorkerClient(()=>w);
  const p=c.request('a',{});w.messageFail();
  await assert.rejects(p,/bad clone|deserialization/);
  c.dispose();
});

test('postMessage synchronous failure rejects request and does not poison the queue',async()=>{
  const w=new Mock({throwPost:true}),c=new SolverWorkerClient(()=>w);
  await assert.rejects(c.request('bad',{}),/post failed/);
  const p=c.request('good',{});
  assert.equal(w.sent.length,1);
  success(w,0,{ok:true});assert.deepEqual(await p,{ok:true});
  c.dispose();
});

test('request after dispose is rejected immediately',async()=>{
  const c=new SolverWorkerClient(()=>new Mock);c.dispose();
  await assert.rejects(c.request('chance',{}),{name:'InvalidStateError'});
});

test('already-aborted signal is rejected without posting',async()=>{
  const w=new Mock,c=new SolverWorkerClient(()=>w),controller=new AbortController();controller.abort();
  await assert.rejects(c.request('chance',{}, {signal:controller.signal}),{name:'AbortError'});
  assert.equal(w.sent.length,0);c.dispose();
});
