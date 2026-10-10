import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { decideExperimentalProbe, DEFAULT_SECONDARY_TRIAGE_POLICY } from '../src/min-cover-triage-experiment.mjs';
import { solveExactSecondary } from '../src/min-cover-exact-secondary.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { PROBE_ARMS,PROBE_JOB,PROBE_PHASE } from '../tools/secondary-bench/common/triage/probe-followup.mjs';
import { compileTasks,chunksFor } from '../tools/secondary-bench/common/triage/protocol.mjs';

test('P15 changes only non-hard d15/16; baseline and invalid structures preserved',()=>{
  assert.equal(DEFAULT_SECONDARY_TRIAGE_POLICY,'A_H9');
  for(const hard of [false,true])for(let d=0;d<=40;d++) {
    const s={candidateCount:100,count:d+2,forcedCount:2};
    const h=decideExperimentalProbe('A_H9',hard,s),p=decideExperimentalProbe('P15',hard,s);
    assert.equal(p.useProbe,hard?d<=9:d<=14);
    assert.equal(p.useProbe!==h.useProbe,!hard&&[15,16].includes(d));
  }
  for(const s of [null,{}, {candidateCount:1,count:2,forcedCount:0},{candidateCount:5,count:3,forcedCount:4}])
    for(const hard of [false,true])assert.equal(decideExperimentalProbe('P15',hard,s).useProbe,!hard);
});
test('real product P15 skips d15 probe and defers original seed, H9 still probes',()=>{
  const keys=Array.from({length:20},(_,i)=>String(i).padStart(2,'0'));
  const m=createNumericCoverage(keys,new Map([[0,keys.map((_,i)=>[i,1])]]),[{caseId:0}]);
  for(const policy of ['P15','A_H9']) {
    const searches=[];const probe={completed:false,count:15,keys:keys.slice(1,16),searchedStates:100000};
    const result=solveExactSecondary(m.coverage,{solver:{minimumCoverAtCount(_c,_k,o){searches.push(o);return probe;}},
      qualityFor:()=>1,primary:{count:15,backend:'rust'},primaryKeys:keys.slice(0,15),primaryHard:false,
      kernelStats:{},experimentalTriagePolicy:policy,deferThreshold:c=>c});
    assert.equal(searches.length,policy==='P15'?0:1);assert.equal(result.experimentalTriagePolicy,policy);
    assert.deepEqual(result.primaryKeys,keys.slice(0,15));assert.equal(result.integratedProbe,policy==='P15'?undefined:probe);
  }
});
test('P15 paired plan preserves18 chunks and independent Python call/hash/packing parity',()=>{
  const inputs=Array.from({length:25},(_,i)=>({id:'fixture/'+i,sha256:'a'.repeat(64)}));
  const m={campaignId:'synthetic',revision:13,largeRun:{id:'probe-p15-v1'},inputs,job:PROBE_JOB};
  const templates=[1,2].flatMap(block=>inputs.map((f,i)=>({task_id:`p15/${block}/${i}`,phase:PROBE_PHASE,
    fixture_ids:[f.id],conditional:false,calls:2,block,arms:block===1?Object.keys(PROBE_ARMS):Object.keys(PROBE_ARMS).toReversed(),role:'SYNTHETIC'})));
  const tasks=compileTasks(m,templates,PROBE_PHASE),chunks=chunksFor(m,templates,PROBE_PHASE);
  assert.equal(chunks.length,18);assert.equal(tasks.flatMap(t=>t.calls).length,100);
  assert(chunks.every(c=>new Set(c.tasks.map(t=>t.calls[0].block)).size===1));
  const script=`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('a','tools/secondary-bench/common/triage/independent-audit.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)\nx=json.load(sys.stdin);t=a.compile_calls(x['m'],x['templates'],'PROBE_P15_R13');print(json.dumps(dict(calls=[c for t1 in t for c in t1],chunks=[[c['callId'] for task in ch for c in task] for ch in a.chunks(t,x['m']['job'])])))`;
  const independent=JSON.parse(execFileSync('python',['-B','-c',script],{input:JSON.stringify({m,templates}),encoding:'utf8'}));
  assert.deepEqual(independent.calls,tasks.flatMap(t=>t.calls));
  assert.deepEqual(independent.chunks,chunks.map(c=>c.tasks.flatMap(t=>t.calls.map(c=>c.callId))));
  assert.throws(()=>compileTasks(m,[{...templates[0],arms:['H9_OPEN','H9_OPEN']}],PROBE_PHASE));
});
