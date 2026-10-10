// Frozen P15 promotion population + one selected confirmation wave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { digest, sha256 } from '../contracts.mjs';
import { FOLLOWUP_JOB } from '../budget.mjs';

export const PROMOTION_PHASES=['P15_INITIAL','P15_CONFIRMATION'];
export const PROMOTION_JOB=Object.freeze({...FOLLOWUP_JOB,parts:12,jobMs:325*60000,jobMinutes:350});
export const PROMOTION_SELECTION=Object.freeze({id:'p15-tails-loops-v1',fraction:0.1,loopRatio:1.1,
  tails:['deltaMs','ratio'],populations:['ALL','PER_SAVE'],changedAlways:true,confirmationLoops:2,
  statusDiscordance:true,recursiveSelection:false});
export const isPromotion=m=>m.largeRun?.id==='p15-promotion-v1';
export const changed=f=>!f.metadata.primary_hard&&[15,16].includes(f.metadata.d);
export function validatePromotion(m) {
  const l=m.largeRun;
  assert.equal(m.revision,14);assert.equal(m.campaignId,'TRIAGE_P15_PROMOTION_20261010_R14');
  assert(!m.continuation&&!m.followup&&!m.prerequisiteReuse);
  assert.equal(m.inputs.length,761);assert.equal(m.inputs.filter(f=>f.metadata.dataset==='ALL').length,548);
  assert.equal(m.inputs.filter(changed).length,97);
  assert.deepEqual(m.job,PROMOTION_JOB);assert.equal(m.maxParallel,16);
  assert.deepEqual(m.measurement.variants,['H9_OPEN','P15_OPEN']);
  assert.deepEqual(m.design.selection,PROMOTION_SELECTION);
  assert.equal(l.calls,6088);assert.equal(l.initialCalls,3044);assert.equal(l.chunks,256);
  assert.equal(l.priorCalls,13272);assert.equal(l.priorCpCalls,16);assert.equal(l.priorRunnerHours,2718.8333333333335);
  assert.equal(l.controlHours,8);assert.equal(l.callMs,600000);
  assert.equal(l.originMs,1791287463000);assert.equal(l.endMs,1791719463000);
  assert.equal(m.maxCalls,20000);assert.equal(m.maxRunnerHours,5000);
  assert.equal(l.budgetAuthorization,'USER_BROAD_P15_PROMOTION_TAIL_LOOP_CONFIRMATION_20261010');
  assert(l.priorCalls+l.priorCpCalls+l.calls+1<=m.maxCalls);
  assert(l.priorRunnerHours+l.chunks*m.job.jobMinutes/60+l.controlHours<=m.maxRunnerHours);
  for(const k of ['parentLockSha256','fixtureSourceLockSha256','accountingSha256','catalogSha256'])assert(/^[a-f0-9]{64}$/.test(l[k]));
}
export function verifyPromotionCatalog(m) {
  const b=fs.readFileSync('config/PROMOTION_CATALOG.json');assert.equal(sha256(b),m.largeRun.catalogSha256);
  const catalog=JSON.parse(b);assert.deepEqual(catalog.selectedRefs,m.inputs);
  const source=JSON.parse(fs.readFileSync('config/FIXTURE_SOURCE_LOCK.json'));
  for(const ref of source.manifest.inputs)assert.deepEqual(m.inputs.find(f=>f.id===ref.id),ref);
  const tasks=fs.readFileSync('config/TASKS.jsonl','utf8').trim().split('\n').map(JSON.parse);
  assert.equal(tasks.length,3044);
  for(const f of m.inputs)for(const phase of PROMOTION_PHASES) {
    const ts=tasks.filter(t=>t.phase===phase&&t.fixture_ids[0]===f.id).sort((a,b)=>a.block-b.block);
    assert.deepEqual(ts.map(t=>t.block),[1,2]);assert.deepEqual(ts[0].arms.toReversed(),ts[1].arms);
    assert(ts.every(t=>t.calls===2&&t.conditional===(phase==='P15_CONFIRMATION')));
  }
}
const med=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;};
export function selectPromotion(m,rows) {
  const refs=new Map(m.inputs.map(f=>[f.id,f]));const selected=new Set(),decisions=[],metrics=[];
  const mark=(id,reason)=>{selected.add(id);decisions.push({inputId:id,reason});};
  const initial=rows.filter(r=>r.phase==='P15_INITIAL');assert.equal(initial.length,m.largeRun.initialCalls);
  for(const [id,ref] of refs) {
    const rs=initial.filter(r=>r.inputId===id);assert.equal(rs.length,4);
    const ratios=[],deltas=[],times={H9_OPEN:[],P15_OPEN:[]};let discordance=false;
    for(const block of [1,2]) {
      const pair=rs.filter(r=>r.block===block);assert.equal(pair.length,2);
      const b=pair.find(r=>r.variant==='H9_OPEN'),c=pair.find(r=>r.variant==='P15_OPEN');assert(b&&c);
      assert.equal(b.runnerId,c.runnerId);assert.equal(digest(b.condition),digest(c.condition));
      for(const r of pair)if(r.status==='EXACT'){assert(Number.isFinite(r.ms)&&r.ms>0);times[r.variant].push(r.ms);}
      if(b.status!==c.status)discordance=true;
      if(b.status==='EXACT'&&c.status==='EXACT') {
        assert.equal(digest(b.execution.result.verified),digest(c.execution.result.verified),'pair witness mismatch');
        ratios.push(c.ms/b.ms);deltas.push(c.ms-b.ms);
      }
    }
    const variability=xs=>xs.length===2?Math.max(...xs)/Math.min(...xs):null;
    const metric={inputId:id,population:ref.metadata.dataset,deltaMs:deltas.length===2?med(deltas):null,
      ratio:ratios.length===2?med(ratios):null,baseLoopRatio:variability(times.H9_OPEN),
      candidateLoopRatio:variability(times.P15_OPEN),effectLoopRatio:variability(ratios)};
    metrics.push(metric);
    if(changed(ref))mark(id,'CHANGED_ALWAYS');
    if(discordance||new Set(rs.map(r=>r.status)).size>1)mark(id,'STATUS_DISCORDANCE');
    if([metric.baseLoopRatio,metric.candidateLoopRatio,metric.effectLoopRatio].some(x=>x>1.1))mark(id,'LOOP_GT_10_PERCENT');
  }
  for(const population of ['ALL','PER_SAVE'])for(const metric of ['deltaMs','ratio']) {
    const valid=metrics.filter(r=>r.population===population&&r[metric]!==null);
    const ordered=valid.sort((a,b)=>a[metric]-b[metric]||(a.inputId<b.inputId?-1:a.inputId>b.inputId?1:0));const n=Math.ceil(ordered.length*.1);
    for(const r of ordered.slice(0,n))mark(r.inputId,`${population}_${metric}_TOP_BENEFIT`);
    for(const r of ordered.slice(-n))mark(r.inputId,`${population}_${metric}_TOP_HARM`);
  }
  return {selected:[...selected].sort(),decisions,metrics,policy:PROMOTION_SELECTION,solverCalls:0};
}
