// User-approved r8: one broad, fixed run; product lifetime != benchmark timeout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readJson, sha256 } from '../contracts.mjs';
import { FOLLOWUP_JOB } from '../budget.mjs';

export const LARGE_PHASE = 'H9_CP_10M';
export const LARGE_ARMS = Object.freeze({
  A_120: { policy:'A', trace:true, secondary:'auto', cpLimitMs:120000 },
  H9_120: { policy:'A_H9', trace:true, secondary:'auto', cpLimitMs:120000 },
  H9_OPEN: { policy:'A_H9', trace:true, secondary:'auto', cpLimitMs:null },
  CP_OPEN: { policy:'baseline', trace:true, secondary:'cpsat', cpLimitMs:null },
});
export const LARGE_JOB = Object.freeze({ ...FOLLOWUP_JOB, jobMs:325*60000, jobMinutes:350 });
export const isMemoryRun = m => m.largeRun?.id === 'cp-memory-stages-v1';
export const largePhase = m => isMemoryRun(m) ? m.revision===11?'CP_COMPACT_R11':'CP_MEMORY_R9' : LARGE_PHASE;
export const MEMORY_JOB = Object.freeze({ ...FOLLOWUP_JOB,parts:1,jobMs:45*60000,jobMinutes:350 });
export const MEMORY_INPUTS = [
  'cycle1-pcinfo-033/all/restricted-split/ALL',
  'cycle1-pcinfo-030/all/restricted-split/ALL',
  'cycle1-pcinfo-031/all/bag-plus-next-draw/ALL',
  'cycle1-pcinfo-040/all/restricted-split/ALL',
];
export function validateLarge(m) {
  const l=m.largeRun;
  if (isMemoryRun(m)) {
    assert([9,10,11].includes(m.revision));
    const compact=m.revision===11;
    assert.equal(m.campaignId,compact?'TRIAGE_CP_COMPACT_20261009_R11':`TRIAGE_CP_MEMORY_20261009_R${m.revision}`);
    assert(!m.continuation&&!m.followup&&!m.prerequisiteReuse);
    assert.deepEqual(m.inputs.map(f=>f.id),MEMORY_INPUTS);
    assert.deepEqual(m.measurement.variants,['CP_OPEN','H9_OPEN']);
    assert.deepEqual(m.job,MEMORY_JOB);assert.equal(m.maxParallel,4);
    assert.equal(l.calls,8);assert.equal(l.chunks,4);assert.equal(l.callMs,600000);
    const repair=m.revision===10;
    assert.equal(l.priorCalls,compact?13063:repair?13055:13047);assert.equal(l.priorCpCalls,compact?12:repair?11:10);
    assert.equal(l.priorRunnerHours,compact?2567.6666666666665:repair?2538.833333333333:2533.333333333333);assert.equal(l.controlHours,6);
    if(compact) {assert.equal(l.modelChange,'BOOLEAN_OR_DUAL_REIFICATION');assert.equal(l.comparatorRunId,'37886233804');assert(!l.recoveryRunId);}
    if(repair) {assert.equal(l.recoveryRunId,'37815474702');assert(/^[a-f0-9]{64}$/.test(l.recoveryProofSha256));}
    assert.equal(l.originMs,1791287463000);assert.equal(l.endMs,1791719463000);
    assert.equal(m.maxCalls,20000);assert.equal(m.maxRunnerHours,5000);
    assert.equal(l.budgetAuthorization,compact?'USER_CONTINUE_CP_COMPACT_20261009':'USER_CONTINUE_CP_MEMORY_20261009');
    for (const k of ['parentLockSha256','fixtureSourceLockSha256','accountingSha256'])assert(/^[a-f0-9]{64}$/.test(l[k]));
    assert(l.priorCalls+l.priorCpCalls+l.calls+1<=m.maxCalls);
    assert(l.priorRunnerHours+4*m.job.jobMinutes/60+l.controlHours<=m.maxRunnerHours);
    return;
  }
  assert.equal(l.id,'h9-cp-10m-v1'); assert.equal(m.revision,8);
  assert.equal(m.campaignId,'TRIAGE_H9_CP10M_20261007_R8');
  assert(!m.continuation && !m.followup && !m.prerequisiteReuse);
  assert.equal(l.calls,4640); assert.equal(l.chunks,194); assert.equal(m.inputs.length,580);
  assert.equal(l.callMs,600000); assert.equal(l.priorCalls,8407); assert.equal(l.priorCpCalls,9);
  assert.equal(l.priorRunnerHours,1363.5); assert.equal(l.controlHours,6);
  assert.equal(l.originMs,1791287463000); assert.equal(l.endMs,1791719463000);
  assert.equal(m.maxCalls,20000); assert.equal(m.maxRunnerHours,5000);
  assert.equal(l.budgetAuthorization,'USER_BROAD_TEST_10MIN_20261007');
  assert(l.priorCalls+l.priorCpCalls+l.calls+1<=m.maxCalls);
  assert(l.priorRunnerHours+l.chunks*m.job.jobMinutes/60+l.controlHours<=m.maxRunnerHours);
  assert.deepEqual(m.job,LARGE_JOB); assert.deepEqual(m.measurement.variants,Object.keys(LARGE_ARMS));
  for(const k of ['parentLockSha256','fixtureSourceLockSha256','accountingSha256'])assert(/^[a-f0-9]{64}$/.test(l[k]));
}
export function largeParent(m) {
  validateLarge(m); const l=m.largeRun;
  const load=(name,hash)=>{const b=fs.readFileSync('config/'+name);assert.equal(sha256(b),hash);return JSON.parse(b);};
  const parent=load('PARENT_LOCK.json',l.parentLockSha256);
  const source=load('FIXTURE_SOURCE_LOCK.json',l.fixtureSourceLockSha256);
  assert.equal(parent.invocationId,m.revision===11?'37886233804':isMemoryRun(m)?l.recoveryRunId??'37623263031':'37604369041');
  assert.equal(source.invocationId,m.revision===11?'37886233804':isMemoryRun(m)?'37623263031':'37487586383');
  assert.equal(parent.originMs,l.originMs); assert.equal(parent.endMs,l.endMs);
  assert.equal(source.originMs,l.originMs); assert.equal(source.endMs,l.endMs);
  for(const ref of m.inputs)assert.deepEqual(ref,source.manifest.inputs.find(f=>f.id===ref.id));
  const a=load('PRIOR_ACCOUNTING.json',l.accountingSha256);
  assert.equal(a.reservedCalls,l.priorCalls); assert.equal(a.cumulativeCpSyntheticCalls,l.priorCpCalls);
  assert.equal(a.cumulativeReservedRunnerHours,l.priorRunnerHours);
  if (isMemoryRun(m)) assert(a.latestPackageCollectionComplete && a.latestPackageMissingCalls===0 && a.latestPackageUnknownAllocations===0);
  else assert(a.budgetEvidenceComplete);
  assert(!a.unknownStarts.length);
  if(m.revision===11) {
    const before=parent.manifest.sourceFiles.product,after=m.sourceFiles.product;
    assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
    assert.deepEqual(Object.keys(after).filter(k=>before[k]!==after[k]),['src/cpsat-secondary-model.mjs']);
  }
  if(l.recoveryRunId) {
    const proof=load('RECOVERY_PROOF.json',l.recoveryProofSha256);
    assert.equal(proof.runId,l.recoveryRunId);assert.equal(proof.populationCalls,0);assert.equal(proof.starts,0);
    assert.equal(proof.reservedUnstartedDesignSlots,8);assert.equal(proof.cpSyntheticCalls,1);assert.equal(proof.reservedHours,5.5);
    assert.equal(proof.sourceProductUnchanged,true);
    assert.deepEqual(m.sourceFiles.product,parent.manifest.sourceFiles.product);
  }
  return parent;
}
