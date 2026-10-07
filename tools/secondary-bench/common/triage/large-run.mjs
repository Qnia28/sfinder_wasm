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
export function validateLarge(m) {
  const l=m.largeRun;
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
  assert.equal(parent.invocationId,'37604369041'); assert.equal(source.invocationId,'37487586383');
  assert.equal(parent.originMs,l.originMs); assert.equal(parent.endMs,l.endMs);
  assert.equal(source.originMs,l.originMs); assert.equal(source.endMs,l.endMs);
  for(const ref of m.inputs)assert.deepEqual(ref,source.manifest.inputs.find(f=>f.id===ref.id));
  const a=load('PRIOR_ACCOUNTING.json',l.accountingSha256);
  assert.equal(a.reservedCalls,l.priorCalls); assert.equal(a.cumulativeCpSyntheticCalls,l.priorCpCalls);
  assert.equal(a.cumulativeReservedRunnerHours,l.priorRunnerHours);
  assert(a.budgetEvidenceComplete && !a.unknownStarts.length);
  return parent;
}
