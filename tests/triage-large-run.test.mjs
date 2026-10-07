import test from 'node:test';
import assert from 'node:assert/strict';
import { decideExperimentalProbe, DEFAULT_SECONDARY_TRIAGE_POLICY } from '../src/min-cover-triage-experiment.mjs';
import { SECONDARY_CP_LIMIT_MS } from '../src/min-cover-three-engine.mjs';
import { solveCpSecondaryModel } from '../src/cpsat-secondary-model.mjs';
import { LARGE_ARMS, LARGE_JOB } from '../tools/secondary-bench/common/triage/large-run.mjs';
import { compileTasks, chunksFor } from '../tools/secondary-bench/common/triage/protocol.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runIsolated } from '../tools/secondary-bench/isolation.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';
import { isORToolsSupported } from '../src/ortools-min-cover.mjs';

test('H9 preserves non-hard A and bounds the new hard probe at d9',()=>{
  assert.equal(DEFAULT_SECONDARY_TRIAGE_POLICY,'A_H9');assert.equal(SECONDARY_CP_LIMIT_MS,null);
  for(const hard of [false,true])for(const d of [0,7,9,10,11,16,17,40]) {
    const s={candidateCount:100,count:d+2,forcedCount:2};
    assert.equal(decideExperimentalProbe('A_H9',hard,s).useProbe,hard?d<=9:d<=16);
  }
  for(const hard of [false,true])assert.equal(decideExperimentalProbe('A_H9',hard,null).useProbe,!hard);
});

test('unlimited CP omits native time limit on every quality and stable-ID stage',async()=>{
  const settings=[];
  const expression={eq:()=>({})};
  class CpModel { newBoolVar(){return expression;} add(){} addBoolOr(){} addMaxEquality(){} maximize(){} proto(){return {};} addHint(){} }
  class CpSolver { async solve(model,options){settings.push(options);return 'OPTIMAL';} statusName(s){return s;} value(){return 1;} objectiveValue(){return 1;} bestObjectiveBound(){return 1;} }
  const api={CpModel,CpSolver,LinearExpr:{sum:()=>expression,weightedSum:()=>expression}};
  const r=await solveCpSecondaryModel({keys:['a'],rows:[[[0,1]]],count:1,seed:[0]},api);
  assert.equal(r.completed,true);assert.equal(settings.length,2);
  assert(settings.every(s=>!Object.hasOwn(s,'maxTimeInSeconds')&&s.numWorkers===1));
});

test('broad schedule is 4640 ten-minute calls in 194 bounded common chunks',()=>{
  const inputs=Array.from({length:580},(_,i)=>({id:'fixture/'+i,sha256:'a'.repeat(64)}));
  const arms=Object.keys(LARGE_ARMS);
  const templates=inputs.map((f,i)=>{const a=arms.slice(i%4).concat(arms.slice(0,i%4));return {
    task_id:'r8/'+i,phase:'H9_CP_10M',fixture_ids:[f.id],conditional:false,calls:8,arms:[...a,...a.toReversed()],role:'SYNTHETIC'};});
  const m={campaignId:'synthetic',revision:8,largeRun:{},inputs,job:LARGE_JOB};
  const tasks=compileTasks(m,templates,'H9_CP_10M');const chunks=chunksFor(m,templates,'H9_CP_10M');
  assert.equal(chunks.length,194);assert.equal(tasks.flatMap(t=>t.calls).length,4640);
  assert(tasks.flatMap(t=>t.calls).every(c=>c.limits.callMs===600000));
  for(const t of tasks)for(const arm of arms){const cs=t.calls.filter(c=>c.variant===arm);assert.equal(cs.length,2);assert.equal(cs[0].position+cs[1].position,3);}
});

test('large arms execute their declared policy and preserve exact witness on synthetic input',async t=>{
  const root=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Temp','opencode'):os.tmpdir();
  const dir=fs.mkdtempSync(path.join(root,'large-arm-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const f={schema:1,id:'synthetic',keys:['a','b','c'],K:2,seed:[0,1],
    rows:[[[0,1],[1,1]],[[1,1],[2,1]],[[0,1],[2,1]]],primaryHard:false,
    cardinalityProof:{status:'PROVEN',backend:'rust',kernelStats:{cases:3,solutions:3,entries:6}}};
  const file=path.join(dir,'fixture.json');fs.writeFileSync(file,JSON.stringify(f));
  for(const [variant,arm] of Object.entries(LARGE_ARMS)) {
    if(variant==='CP_OPEN'&&!isORToolsSupported())continue;
    const r=await runIsolated({childFile:new URL('../tools/secondary-bench/common/triage/child.mjs',import.meta.url),
      job:{variant,fixturePath:file,fixtureSha256:hash(fs.readFileSync(file)),exactHumanQuality:'true'},
      limits:{startupMs:10000,callMs:10000,reapMs:5000}});
    assert.equal(r.status,'EXACT',JSON.stringify(r));assert.equal(r.reaped,true);
    assert.deepEqual(r.result.armContract,arm);assert.equal(r.result.cpLimitMs,arm.cpLimitMs);
    assert.deepEqual(r.result.verified.selected,[0,1]);
    assert.equal(r.result.result.experimentalTriage?.policy,arm.policy==='baseline'?undefined:arm.policy);
  }
});
