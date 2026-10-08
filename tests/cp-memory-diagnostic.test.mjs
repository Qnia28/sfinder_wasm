import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installMemoryTrace } from '../tools/secondary-bench/common/triage/memory-trace.mjs';
import { CpModel, CpSolver, CpSat, LinearExpr } from '../src/vendor/ortools/node/cp-sat.js';
import { solveCpSecondaryModel } from '../src/cpsat-secondary-model.mjs';
import { validateManifest, compileTasks, chunksFor } from '../tools/secondary-bench/common/triage/protocol.mjs';

test('durable isolate trace brackets actual model building without native solve',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-memory-synthetic-'));
  const trace=installMemoryTrace('synthetic',dir);
  try {
    class NoSolver { async solve(){return 'UNKNOWN';} statusName(s){return s;} }
    await solveCpSecondaryModel({keys:['a','b'],rows:[[[0,1],[1,2]],[[0,2],[1,1]]],count:1,seed:[0]},
      {CpModel,LinearExpr,CpSolver:NoSolver});
    trace.close();
    const rows=fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]),'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows.map(r=>r.stage),['trace-open','model-begin','normalize-begin','normalize-end','coverage-levels-ready',
      'quality-batch-begin','stage-model-ready','stage-solve-return','trace-close']);
    assert(rows.every((r,i)=>r.sequence===i+1&&r.memory.rss>0));
    assert.equal(rows.find(r=>r.stage==='stage-model-ready').variables,2);
  } finally { trace.close();fs.rmSync(dir,{recursive:true}); }
});

test('frozen diagnostic has eight independent calls, four chunks and original watchdog', {skip:!process.env.MEMORY_CONFIG},()=>{
  const root=process.env.MEMORY_CONFIG,m=validateManifest(JSON.parse(fs.readFileSync(path.join(root,'MANIFEST.json'))));
  const tasks=fs.readFileSync(path.join(root,'TASKS.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const calls=compileTasks(m,tasks,'CP_MEMORY_R9').flatMap(t=>t.calls);
  assert.equal(calls.length,8);assert.equal(new Set(calls.map(c=>c.callId)).size,8);
  assert.equal(chunksFor(m,tasks,'CP_MEMORY_R9').length,4);
  assert(calls.every(c=>c.limits.callMs===600000&&c.measurementEpoch===9));
  assert.throws(()=>validateManifest({...m,maxCalls:20001}));
});

test('vendor serialization markers bracket real protobuf encode without loading native runtime',async()=>{
  const stages=[],original=CpSat.solve;
  globalThis.__secondaryMemoryTrace=(stage,detail)=>stages.push({stage,...detail});
  try {
    CpSat.solve=async bytes=>{assert(bytes.length>0);return {response:{status:0}};};
    const model=new CpModel();model.addBoolOr([model.newBoolVar('x')]);
    await new CpSolver().solve(model,{executor:'direct'});
    assert.deepEqual(stages.map(s=>s.stage),['encode-begin','encode-end']);
    assert(stages[1].modelBytes>0);
  } finally {CpSat.solve=original;delete globalThis.__secondaryMemoryTrace;}
});
