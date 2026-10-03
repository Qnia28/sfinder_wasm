import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule,LIMITS} from './schedule.mjs';
import {CpuProfiler,inspect,functionIndex} from './profiler.mjs';
import {ExecutionSession} from './supervisor.mjs';
import {jsonSha} from './common.mjs';
test('frozen 16-call schedule: 12 plain/4 profile, paired controls and crossed ordering',()=>{
  assert.equal(schedule.length,16);assert.equal(new Set(schedule.map(r=>r.runId)).size,16);
  assert.equal(schedule.filter(r=>!r.profile).length,12);assert.equal(schedule.filter(r=>r.profile).length,4);
  assert.deepEqual(schedule.filter(r=>r.position===1).map(r=>r.pair),['RR','RA','AR','RA','AA','AR','RA','AR']);
  assert.equal(LIMITS.admissionWorstMs,197000);
});
test('CPU profile lifecycle produces finite samples, rejects duplicate start; frame parser does not invent tier',async()=>{
  const p=new CpuProfiler();await p.start();await assert.rejects(p.start());
  const until=performance.now()+80;while(performance.now()<until){}
  const d=await p.stop(),s=inspect(d.profile);assert(s.samples>5);
  assert.equal(functionIndex({functionName:'wasm-function[363]'}),363);assert.equal(functionIndex({functionName:'native'}),null);
  await assert.rejects(p.stop());
});
test('profile persistence ACK precedes audit; duplicates/failure stop without replacing raw',async()=>{
  const data={profile:{nodes:[],samples:[],timeDeltas:[]}};let release,ack=false,failure=null;
  const s=Object.create(ExecutionSession.prototype);Object.assign(s,{current:{run:{runId:'fake'},raw:{}},exportStarted:true,run:{profile:true},out:'unused',chain:Promise.resolve(),
    journal:{append:()=>new Promise(r=>release=r)},proc:{send:m=>{assert.equal(m.type,'profile-ack');ack=true;}},kill:r=>{failure=r;}});
  const msg={type:'profile-result',runId:'fake',data,record:{profileSha256:jsonSha(data)}};s.message(msg);await Promise.resolve();assert(!ack&&!s.profilePersisted);release();await s.chain;assert(ack&&s.profilePersisted);
  s.message(msg);assert.equal(failure,'PROFILE_PROTOCOL');
  const bad=Object.create(ExecutionSession.prototype);Object.assign(bad,{run:{profile:true},kill:r=>{failure=r;}});bad.message({type:'audit-result'});assert.equal(failure,'AUDIT_BEFORE_PROFILE');
  const broken=Object.create(ExecutionSession.prototype);Object.assign(broken,{current:{run:{runId:'fake'},raw:{}},exportStarted:true,run:{profile:true},out:'unused',chain:Promise.resolve(),
    journal:{append:async()=>{throw Error('fake disk failure');}},proc:{send:()=>{throw Error('Unexpected ACK');}},kill:r=>{failure=r;}});
  broken.message(msg);await broken.chain;assert.equal(failure,'PROFILE_PERSISTENCE_ERROR');
});
