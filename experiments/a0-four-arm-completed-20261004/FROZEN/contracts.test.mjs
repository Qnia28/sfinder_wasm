import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {ROOT,HERE,read,ARMS,ORDERS,matrix,sha} from './common.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
test('frozen 122-input four-arm design: 10 balanced blocks and 80 environment calls',()=>{
 const selection=read(`${HERE}/SELECTION.json`),inputs=read(`${HERE}/INPUTS.json`).entries,runs=read(`${HERE}/SCHEDULE.json`).runs;
 assert.equal(selection.records.length,122);assert.equal(inputs.length,122);assert.equal(runs.length,4960);assert.equal(new Set(runs.map(r=>r.runId)).size,4960);
 assert.equal(runs.filter(r=>r.kind==='ENVIRONMENT_CONTROL').length,80);
 for(const host of [0,1,2,3,4])assert.equal(runs.filter(r=>r.host===host).length,992);
 for(const e of inputs){
  matrix(e);const rr=runs.filter(r=>r.matrixId===e.id&&r.kind!=='ENVIRONMENT_CONTROL'),blocks=new Map();
  for(const r of rr){if(!blocks.has(r.blockId))blocks.set(r.blockId,[]);blocks.get(r.blockId).push(r);}
  assert.equal(blocks.size,10);const positions={},predecessors={};
  for(const rows of blocks.values()){
   assert.deepEqual(rows.map(r=>r.arm),ORDERS[rows[0].orderIndex]);assert.equal(new Set(rows.map(r=>r.arm)).size,4);
   rows.forEach((r,i)=>{positions[`${r.arm}-${i}`]=(positions[`${r.arm}-${i}`]??0)+1;if(i)predecessors[`${rows[i-1].arm}-${r.arm}`]=(predecessors[`${rows[i-1].arm}-${r.arm}`]??0)+1;});
  }
  assert.equal(Object.keys(positions).length,16);assert(Math.max(...Object.values(positions))-Math.min(...Object.values(positions))<=1);
  assert.equal(Object.keys(predecessors).length,12);assert(Math.max(...Object.values(predecessors))-Math.min(...Object.values(predecessors))<=1);
  for(const arm of ARMS)assert.equal(rr.filter(r=>r.arm===arm).length,10);
 }
 const old=read(`${ROOT}/experiments/a0-proof-retest-20261003/RETEST_SELECTION.json`);
 for(const r of old.records.filter(r=>r.selected))assert(selection.records.some(s=>s.id===r.matrixId));
 assert.equal(selection.originalSelectionSha256,sha(fs.readFileSync(`${ROOT}/experiments/a0-proof-retest-20261003/RETEST_SELECTION.json`)));
});
test('arm independence, no automatic activation or actual-input budget increase',()=>{
 const source=fs.readFileSync(`${ROOT}/rust/pc-core/src/min_cover_four_arm.rs`,'utf8');assert(source.includes('compile_error!'));assert(source.includes('#[cfg(not(feature = "a0-lower-cutoff"))]'));
 const sourceBytes=b=>Buffer.from(b.toString('utf8').replaceAll('\r\n','\n'));
 assert.equal(sha(sourceBytes(fs.readFileSync(`${ROOT}/rust/pc-core/src/min_cover.rs`))),sha(sourceBytes(execFileSync('git',['show','c0cb2a048e7275bfea587d176b1954efff0a8a08:rust/pc-core/src/min_cover.rs'],{cwd:ROOT}))));
 const worker=fs.readFileSync(`${HERE}/worker.mjs`,'utf8');assert(!worker.includes('taskset'));assert(worker.includes('state/quality/stable-ID/completion mismatch'));assert(worker.includes('CONTRACT_ONLY_STOP'));
 const run=fs.readFileSync(`${HERE}/run.mjs`,'utf8');assert(run.includes('blockCalls*campaign.perCallAdmissionSeconds'));assert(run.includes('build.benchmarkEligible'));
 const workflow=fs.readFileSync(`${ROOT}/.github/workflows/a0-four-arm.yml`,'utf8');assert(workflow.includes('launch.json'));assert(!workflow.includes('workflow_dispatch'));
 const build=fs.readFileSync(`${HERE}/build-manifest.mjs`,'utf8');assert(build.includes("assert(controlMatches,'Feature-off control differs"));
 const diagnostic=read(`${HERE}/DIAGNOSTIC_SCHEDULE.json`);assert.equal(diagnostic.runs.length,20);assert.equal(diagnostic.timingEvidence,false);
 assert.equal(new Set(diagnostic.runs.map(r=>r.matrixId)).size,5);assert.equal(diagnostic.apiMs,30000);assert.equal(diagnostic.processMs,45000);
});
test('synthetic fresh Worker raw fsync-before-audit and transfer contracts, all four arms',{timeout:90000},async()=>{
 // These eight calls are synthetic fixtures, never campaign inputs.
 if(!fs.existsSync(`${ROOT}/.a0/four/BUILD.json`))throw Error('Build and validate all four binaries before fixture');
 class FixtureSession extends Session{message(m){if(m.type==='worker-ready'){this.events.push(m);return;}super.message(m);}}
 fs.mkdirSync(`${ROOT}/.a0/four/preflight`,{recursive:true});
 const dir=fs.mkdtempSync(`${ROOT}/.a0/four/preflight/ipc-fixture-`);fs.mkdirSync(`${dir}/raw`);const journal=new Journal();
 const saved={flag:process.env.FOUR_SYNTHETIC_FIXTURE,budget:process.env.FOUR_FIXTURE_BUDGET};process.env.FOUR_SYNTHETIC_FIXTURE='1';
 try{
  for(const diagnostic of [false,true])for(const budget of [100000,1])for(const arm of ARMS){
   process.env.FOUR_FIXTURE_BUDGET=String(budget);const run={runId:`synthetic-${arm}-${budget}-${diagnostic}`,matrixId:'SYNTHETIC_FOUR_ARM',arm,kind:diagnostic?'WORK_DIAGNOSTIC':'SYNTHETIC'};
   const session=new FixtureSession(run.matrixId,'COLD',false,{journal,out:dir,apiMs:10000,processMs:30000,startupMs:30000,auditMs:30000,script:'../a0-four-arm-20261003/session.mjs',args:[]});
   try{await session.ready;const row=await session.call(run);assert(row.synthetic);assert.equal(row.worker.callCount,1);
    const raw=fs.readFileSync(`${dir}/${row.rawFile}`,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(raw.map(r=>r.type),['phase-start','phase-result','audit-result']);
    assert.deepEqual(raw[1].raw,row.probe);assert.equal(row.actualPrimaryCalls+row.actualPcCalls+row.nativeThresholdCalls,0);
    assert.equal(row.diagnostic,diagnostic);assert.equal(row.timingEvidence,!diagnostic);assert.deepEqual(raw[1].counters,row.counters);
    if(diagnostic)assert(row.counters&&Object.values(row.counters).every(Number.isSafeInteger));else assert.equal(row.counters,null);
    if(budget===1){assert.equal(row.status,'PROBE_CAPPED');assert.equal(row.contract.calls.length,2);}else assert.equal(row.status,'PROBE_EXACT');
   }finally{const closed=await session.close();assert.equal(closed.code,0);assert.equal(closed.stderr,'');}
  }
 }finally{await journal.close();if(saved.flag===undefined)delete process.env.FOUR_SYNTHETIC_FIXTURE;else process.env.FOUR_SYNTHETIC_FIXTURE=saved.flag;
  if(saved.budget===undefined)delete process.env.FOUR_FIXTURE_BUDGET;else process.env.FOUR_FIXTURE_BUDGET=saved.budget;}
});
