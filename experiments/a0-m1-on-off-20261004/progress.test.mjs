import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isRecordedTimeout, validateConsumed, jobCompletion } from './progress.mjs';
import { Journal, Session } from './supervisor.mjs';
import { HERE, read } from './common.mjs';

test('timeouts are censored observations, not fatal job errors or successful exact results',()=>{
  for(const status of ['TIMEOUT_STARTUP','TIMEOUT_API','TIMEOUT_PROCESS','TIMEOUT_PROBE','TIMEOUT_AUDIT'])assert(isRecordedTimeout(status));
  for(const status of ['OOM','PERSISTENCE_ERROR','ERROR_CHILD','ERROR_REAP_MEMORY','TIMEOUT_CLOSE'])assert(!isRecordedTimeout(status));
  assert.equal(jobCompletion(3,3,2,1,null),'COMPLETE_WITH_TIMEOUTS');
  assert.equal(jobCompletion(3,3,3,0,null),'COMPLETE');
  assert.equal(jobCompletion(10,3,2,1,'PAIR_ADMISSION_DEADLINE'),'BUDGET_EXHAUSTED_WITH_PARTIAL_RESULTS');
  assert.throws(()=>jobCompletion(3,3,3,1,null));
});

test('resume consumes timeout once, preserves the opposite pending policy and rejects drift or duplicate IDs',()=>{
  const schedule=[{runId:'a',position:1,policy:'reference'},{runId:'b',position:2,policy:'a0-m1'}];
  const consumed=validateConsumed(schedule,[{...schedule[0],status:'TIMEOUT_API'}]);
  assert.deepEqual(schedule.filter(r=>!consumed.has(r.runId)),[schedule[1]]);
  assert.throws(()=>validateConsumed(schedule,[{...schedule[1],status:'VERIFIED'}]));
  assert.throws(()=>validateConsumed(schedule,[{...schedule[0],status:'OOM'}]));
  assert.throws(()=>validateConsumed(schedule,[{...schedule[0],status:'VERIFIED'},{...schedule[0],status:'VERIFIED'}]));
  const resume=read(`${HERE}/RESUME.json`);assert.equal(resume.priorAttemptedCalls,130);
  assert.equal(resume.priorVerifiedCalls,120);assert.equal(resume.priorTimeoutCalls,10);
  assert.equal(resume.hosts.length,10);
});

test('a reaped timeout child is followed by another request with durable outcome order',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'a0-m1-continue-'));fs.mkdirSync(`${out}/raw`);const journal=new Journal();
  try{
    const timed=new Session('timeout','COLD',false,{journal,out,script:'synthetic-session.mjs',args:['api'],apiMs:100});
    let failure;try{await timed.call({runId:'timeout'});}catch(e){failure=e.failure;}
    await timed.closed;assert(isRecordedTimeout(failure.status));assert(failure.killToCloseMs<2000);
    await journal.append(`${out}/outcomes.jsonl`,{runId:'timeout',status:failure.status});
    const next=new Session('next','COLD',false,{journal,out,script:'synthetic-session.mjs',args:['good']});
    const row=await next.call({runId:'next'});assert.equal((await next.close()).status,'CLOSED');
    await journal.append(`${out}/outcomes.jsonl`,{runId:'next',status:row.status});
    const statuses=fs.readFileSync(`${out}/outcomes.jsonl`,'utf8').trim().split('\n').map(l=>JSON.parse(l).status);
    assert.deepEqual(statuses,['TIMEOUT_API','VERIFIED']);
  }finally{await journal.close();}
});
