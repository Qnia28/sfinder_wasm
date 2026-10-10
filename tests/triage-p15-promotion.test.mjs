import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PROMOTION_JOB, PROMOTION_PHASES, selectPromotion } from '../tools/secondary-bench/common/triage/promotion.mjs';
import { compileTasks, chunksFor } from '../tools/secondary-bench/common/triage/protocol.mjs';

const py=(code,input)=>JSON.parse(execFileSync('python',['-B','-c',`import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('a','tools/secondary-bench/common/triage/independent-audit.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)\nx=json.load(sys.stdin)\n${code}`],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:32*1024**2}));
test('promotion 761 census packs both loops separately, conditional confirmation parity',()=>{
  const m={campaignId:'synthetic',revision:14,largeRun:{id:'p15-promotion-v1'},job:PROMOTION_JOB,
    inputs:Array.from({length:761},(_,i)=>({id:`fixture-${i}`,sha256:'a'.repeat(64)}))};
  const templates=PROMOTION_PHASES.flatMap(phase=>[1,2].flatMap(block=>m.inputs.map((f,i)=>({task_id:`${phase}-${block}-${i}`,phase,
    fixture_ids:[f.id],conditional:phase==='P15_CONFIRMATION',calls:2,block,arms:block===1?['H9_OPEN','P15_OPEN']:['P15_OPEN','H9_OPEN'],role:'SYNTHETIC'}))));
  for(const phase of PROMOTION_PHASES) {
    const selected=phase==='P15_INITIAL'?null:m.inputs.filter((_,i)=>i%3===0).map(f=>f.id);
    const ts=compileTasks(m,templates,phase,selected),cs=chunksFor(m,templates,phase,selected);
    assert(cs.every(c=>new Set(c.tasks.map(t=>t.calls[0].block)).size===1));
    if(!selected){assert.equal(cs.length,128);assert.equal(ts.flatMap(t=>t.calls).length,3044);}
    const independent=py("ts=a.compile_calls(x['m'],x['templates'],x['phase'],x['selected']);print(json.dumps(dict(calls=[c for t in ts for c in t],chunks=[[c['callId'] for t in chunk for c in t] for chunk in a.chunks(ts,x['m']['job'])])))",{m,templates,phase,selected});
    assert.deepEqual(independent.calls,ts.flatMap(t=>t.calls));assert.deepEqual(independent.chunks,cs.map(c=>c.tasks.flatMap(t=>t.calls.map(c=>c.callId))));
  }
});
test('promotion selects tails per population, strict >10% loop and changed/status cases once',()=>{
  const m={largeRun:{initialCalls:160},inputs:Array.from({length:40},(_,i)=>({id:`f${String(i).padStart(2,'0')}`,metadata:{dataset:i<20?'ALL':'PER_SAVE',primary_hard:false,d:i===8?15:12}}))};
  const rows=m.inputs.flatMap((f,i)=>[1,2].flatMap(block=>['H9_OPEN','P15_OPEN'].map(variant=>({inputId:f.id,phase:'P15_INITIAL',block,
    variant,runnerId:'runner'+block,condition:{same:true},status:'EXACT',ms:variant==='H9_OPEN'?1000:1000+(i%20-10)*10,
    execution:{result:{verified:{keys:['a']}}}}))));
  const set=(id,block,arm,changes)=>Object.assign(rows.find(r=>r.inputId===id&&r.block===block&&r.variant===arm),changes);
  set('f09',2,'H9_OPEN',{ms:1100}); // exactly10% does not trigger
  set('f10',2,'H9_OPEN',{ms:1100.001});
  set('f11',2,'P15_OPEN',{status:'TIMEOUT_CALL',ms:null});
  const got=selectPromotion(m,rows);assert(got.selected.includes('f08'));assert(got.selected.includes('f10'));assert(got.selected.includes('f11'));
  assert(!got.decisions.some(r=>r.inputId==='f09'&&r.reason==='LOOP_GT_10_PERCENT'));
  assert(got.decisions.some(r=>r.inputId==='f20'&&r.reason==='PER_SAVE_deltaMs_TOP_BENEFIT'));
  assert.deepEqual(got.selected,py("print(json.dumps(sorted(a.promotion_selection(x['m'],x['rows']))))",{m,rows}));
  assert.equal(new Set(got.selected).size,got.selected.length);
  const broken=structuredClone(rows);broken[1].runnerId='different';assert.throws(()=>selectPromotion(m,broken));
  const badWitness=structuredClone(rows);badWitness[1].execution.result.verified={keys:['b']};assert.throws(()=>selectPromotion(m,badWitness));
  assert.throws(()=>selectPromotion(m,rows.slice(1)));
});
