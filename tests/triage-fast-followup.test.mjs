import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runIsolated } from '../tools/secondary-bench/isolation.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';
import { FAST_ARMS } from '../tools/secondary-bench/common/triage/fast-followup.mjs';

test('all eight arms select actual policy and OFF suppresses trace on synthetic weighted input',async t=>{
  const root=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Temp','opencode'):os.tmpdir();
  const dir=fs.mkdtempSync(path.join(root,'fast-arm-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const fixture={schema:1,id:'synthetic-triangle',keys:['a','b','c'],K:2,seed:[0,1],
    rows:[[[0,1],[1,1]],[[1,1],[2,1]],[[0,1],[2,1]]],primaryHard:false,
    cardinalityProof:{status:'PROVEN',backend:'rust',kernelStats:{cases:3,solutions:3,entries:6}}};
  const file=path.join(dir,'fixture.json');fs.writeFileSync(file,JSON.stringify(fixture));
  for(const [variant,arm] of Object.entries(FAST_ARMS)) {
    const r=await runIsolated({childFile:new URL('../tools/secondary-bench/common/triage/child.mjs',import.meta.url),
      job:{action:'triage',variant,fixturePath:file,fixtureSha256:hash(fs.readFileSync(file)),exactHumanQuality:'true'},
      limits:{startupMs:10000,callMs:10000,reapMs:5000}});
    assert.equal(r.status,'EXACT',JSON.stringify(r));assert.equal(r.reaped,true);
    assert.deepEqual(r.result.verified.selected,[0,1]);assert.deepEqual(r.result.armContract,arm);
    assert.equal(r.result.result.experimentalTriage?.policy,arm.policy==='A'?'A':undefined);
    assert.equal(r.result.trace.length>0,arm.trace);
  }
});
