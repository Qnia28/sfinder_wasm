import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Journal, Session } from './supervisor.mjs';
test('raw fsync acknowledged before audit; fresh child cold wall excludes audit and is reaped',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'a0-m1-contract-'));fs.mkdirSync(`${out}/raw`);
  const journal=new Journal(),s=new Session('synthetic','COLD',false,{journal,out,script:'synthetic-session.mjs',args:['good']});
  try{
    const r=await s.call({runId:'synthetic'});const ended=await s.close();
    const raw=fs.readFileSync(`${out}/raw/synthetic.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(raw.map(r=>r.type),['phase-start','phase-result','audit-result']);assert.equal(r.contract.ackReceived,true);
    assert(r.coldRequestMs>0);assert.equal(ended.status,'CLOSED');assert(ended.sessionWallMs>=r.coldRequestMs);
    if(process.platform==='linux'){assert.equal(ended.resources.memoryMaxBytes,3221225472);assert.equal(ended.resources.swapMaxBytes,0);}
  }finally{if(!s.terminal&&!s.proc.killed)s.kill('TEST_CLEANUP');await s.closed;await journal.close();}
});
for(const mode of ['startup','api','audit'])test(`${mode} independent deadline kills and preserves partial evidence`,async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'a0-m1-deadline-'));fs.mkdirSync(`${out}/raw`);
  const journal=new Journal(),s=new Session(mode,'COLD',false,{journal,out,script:'synthetic-session.mjs',args:[mode],
    startupMs:mode==='startup'?100:10000,apiMs:mode==='api'?100:10000,processMs:10000,auditMs:mode==='audit'?100:10000});
  try{await assert.rejects(s.call({runId:mode}),e=>e.failure?.status===`TIMEOUT_${mode.toUpperCase()}`);const ended=await s.closed;assert(ended.killToCloseMs<2000);}
  finally{if(!s.terminal)s.kill('TEST_CLEANUP');await s.closed;await journal.close();}
});
