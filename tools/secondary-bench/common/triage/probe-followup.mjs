import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sha256 } from '../contracts.mjs';
import { FOLLOWUP_JOB } from '../budget.mjs';

export const PROBE_PHASE = 'PROBE_P15_R13';
export const PROBE_ARMS = Object.freeze({
  H9_OPEN: { policy:'A_H9',trace:true,secondary:'auto',cpLimitMs:null },
  P15_OPEN: { policy:'P15',trace:true,secondary:'auto',cpLimitMs:null },
});
export const PROBE_JOB = Object.freeze({ ...FOLLOWUP_JOB,jobMinutes:350 });
export const isProbeRun = m => m.largeRun?.id === 'probe-p15-v1';
export function validateProbe(m) {
  const l=m.largeRun;
  assert.equal(m.revision,13);assert.equal(m.campaignId,'TRIAGE_PROBE_P15_20261010_R13');
  assert(!m.continuation&&!m.followup&&!m.prerequisiteReuse);
  assert.equal(m.maxParallel,16);assert.deepEqual(m.job,PROBE_JOB);
  assert.equal(m.inputs.length,25);assert.deepEqual(m.measurement.variants,Object.keys(PROBE_ARMS));
  assert.equal(l.calls,100);assert.equal(l.chunks,18);assert.equal(l.callMs,600000);
  assert.equal(l.priorCalls,13072);assert.equal(l.priorCpCalls,14);assert.equal(l.priorRunnerHours,2607.8333333333335);
  assert.equal(l.controlHours,6);assert.equal(l.originMs,1791287463000);assert.equal(l.endMs,1791719463000);
  assert.equal(m.maxCalls,20000);assert.equal(m.maxRunnerHours,5000);
  assert.equal(l.budgetAuthorization,'USER_IMPLEMENT_COMPARE_P15_20261010');
  for (const k of ['parentLockSha256','fixtureSourceLockSha256','accountingSha256','designSha256','scheduleSha256'])assert(/^[a-f0-9]{64}$/.test(l[k]));
  assert(l.priorCalls+l.priorCpCalls+l.calls+1<=m.maxCalls);
  assert(l.priorRunnerHours+l.chunks*m.job.jobMinutes/60+l.controlHours<=m.maxRunnerHours);
}
export function verifyProbeDesign(m) {
  const load=(name,hash)=>{const b=fs.readFileSync('config/'+name);assert.equal(sha256(b),hash);return JSON.parse(b);};
  const design=load('P15_DESIGN.json',m.largeRun.designSha256);
  const schedule=load('P15_SCHEDULE.json',m.largeRun.scheduleSha256);
  const targets=design.targets;
  assert.equal(targets.length,25);assert.equal(targets.filter(t=>t.selection_reason==='CHANGED_STRATUM').length,18);
  assert.deepEqual(m.inputs.map(f=>[f.id,f.sha256]).sort(),targets.map(t=>[t.fixture_id,t.fixture_sha256]).sort());
  const tasks=fs.readFileSync('config/TASKS.jsonl','utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(tasks,schedule);assert.equal(tasks.length,50);
  for(const f of m.inputs) {
    const ts=tasks.filter(t=>t.fixture_ids[0]===f.id).sort((a,b)=>a.block-b.block);
    assert.deepEqual(ts.map(t=>t.block),[1,2]);assert.deepEqual(ts[0].arms.toReversed(),ts[1].arms);
    const changed=!f.metadata.primary_hard&&f.metadata.d>=15&&f.metadata.d<=16;
    assert.equal(changed,targets.find(t=>t.fixture_id===f.id).selection_reason==='CHANGED_STRATUM');
  }
}
