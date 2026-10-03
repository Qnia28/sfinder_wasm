import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fork,spawnSync} from 'node:child_process';
import {HERE,ROOT} from './common.mjs';
import {schedule,executionSchedule,resume,MODES,flags} from './schedule.mjs';
import {exportMap} from './wasm-map.mjs';
test('24 locked calls: 18 untraced, 6 trace/profile; one matrix, no warmup',()=>{
  assert.equal(schedule.length,24);assert.equal(new Set(schedule.map(r=>r.runId)).size,24);
  for(const mode of Object.keys(MODES))for(const v of ['R','A']){
    assert.equal(schedule.filter(r=>r.engineMode===mode&&r.label===v&&!r.trace).length,3);
    assert.equal(schedule.filter(r=>r.engineMode===mode&&r.label===v&&r.trace).length,1);
  }
});
test('flags accepted before solver launch, static wasm export-map agrees with engine',()=>{
  for(const mode of Object.keys(MODES)){const r=spawnSync(process.execPath,[...flags(mode,true),'-e','console.log("FLAG_FIXTURE")'],{encoding:'utf8'});assert.equal(r.status,0);assert(r.stdout.includes('FLAG_FIXTURE'));}
  const bytes=fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`),map=exportMap(bytes);
  const names=WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(e=>e.name);
  assert.deepEqual(map.exports.map(e=>e.symbol),names);
  for(const symbol of ['solver_min_cover_at_count_integrated_bounded','solver_min_cover_at_count_integrated_partitioned_bounded'])assert(map.exports.find(e=>e.symbol===symbol).index<map.definedFunctions);
});
test('launcher passes real child flags and preserves IPC ACK/close',async()=>{
  const child=fork(`${HERE}/launcher.mjs`,['fixture','SHARED_PROCESS_FRESH_WORKER','0','LIFTOFF_ONLY','0'],{env:{...process.env,A0_TIER_FIXTURE:'1'},stdio:['ignore','pipe','pipe','ipc']});
  let stderr='';child.stderr.on('data',b=>stderr+=b);let ready=false,config=false,echo=false;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('Launcher fixture5s timeout'));},5000);
    child.on('error',reject);
    child.on('message',m=>{
      if(m.type==='engine-ready'){assert.deepEqual(m.execArgv,['--liftoff-only']);config=true;}
      if(m.type==='session-ready'){ready=true;child.send({type:'ack',runId:'fixture'});}
      if(m.type==='echo'){assert.equal(m.value.type,'ack');echo=true;child.send({type:'close'});}
    });
    child.on('close',(code,signal)=>{clearTimeout(timer);try{assert.equal(code,0);assert.equal(signal,null);assert.equal(stderr,'');assert(ready&&config&&echo);resolve();}catch(e){reject(e);}});
  });
});
test('eager optimized compilation keeps Worker alive without any solver calls',()=>{
  const r=spawnSync(process.execPath,['--no-liftoff','--no-wasm-lazy-compilation',`${HERE}/bootstrap-fixture.mjs`],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0);assert.equal(r.stderr,'');assert(r.stdout.includes('BOOTSTRAP_COMPILE_ONLY_OK'));
});
test('continuation reexecutes zero successful native calls; first four preserved',()=>{
  assert.equal(executionSchedule.length,20);assert.equal(executionSchedule.filter(r=>!r.trace).length,14);assert.equal(executionSchedule.filter(r=>r.trace).length,6);
  assert.equal(resume.successfulCallsReexecuted,0);const completed=new Set(schedule.slice(0,4).map(r=>r.runId));
  assert(executionSchedule.every(r=>!completed.has(r.originalRunId)));
});
