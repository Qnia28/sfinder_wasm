import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROOT} from './common.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
test('negative hang fixtures use short timers; positive fsync path has independent realistic fixture budget',async()=>{
  const out=`${ROOT}/.a0/preflight-${Date.now()}`;fs.mkdirSync(`${out}/raw`,{recursive:true});
  const j=new Journal();
  const options={journal:j,out,apiMs:1000,processMs:3000,startupMs:3000,auditMs:3000,script:'fixture-session.mjs'};
  try{
    for(const [mode,status,limit]of [['api-hang','TIMEOUT_API',{apiMs:150}],['audit-hang','TIMEOUT_AUDIT',{auditMs:150}],['duplicate','DUPLICATE_PHASE',{}]]){
      const s=new Session('fake','COLD',false,{...options,...limit,args:[mode]});await s.ready;
      await assert.rejects(s.call({runId:mode}),e=>e.failure.status===status);assert((await s.close()).killToCloseMs<2000);
      if(mode==='audit-hang')assert(fs.readFileSync(`${out}/raw/${mode}.jsonl`,'utf8').includes('qualityVector'));
    }
    const delayed={append:async(f,v)=>{if(v.type==='phase-result')await new Promise(r=>setTimeout(r,600));await j.append(f,v);}};
    const p=new Session('fake','COLD',false,{...options,journal:delayed,processMs:150,args:['ok']});await p.ready;
    await assert.rejects(p.call({runId:'process-watch'}),e=>e.failure.status==='TIMEOUT_PROCESS');await p.close();await p.chain;
    const t=new Session('fake','COLD',false,{...options,startupMs:1000,args:['startup-hang']});await assert.rejects(t.ready,e=>e.failure.status==='TIMEOUT_STARTUP');await t.close();
    const ok=new Session('fake','WARM',false,{...options,args:['ok']});await ok.ready;
    for(let i=0;i<2;i++){
      const r=await ok.call({runId:`ok-${i}`});assert.equal(r.status,'FIXTURE_PASS');
      const raw=fs.readFileSync(`${out}/raw/ok-${i}.jsonl`,'utf8').trim().split('\n').map(l=>JSON.parse(l));
      assert.deepEqual(raw.map(r=>r.type),['phase-start','phase-result','audit-result']);
    }
    await ok.close();
  }finally{await j.close();}
});
