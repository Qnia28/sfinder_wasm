import assert from 'node:assert/strict';
import {ROOT,read,write,jsonSha} from './common.mjs';
const summary=read(`${ROOT}/.a0/development-summary/SUMMARY.json`),audit=read(`${ROOT}/.a0/development-summary/INDEPENDENT_AUDIT.json`);
assert.equal(summary.status,'PASS_INTEGRATED_SCOPE');assert.equal(audit.summaryGateStatus,summary.status);assert.equal(audit.observedRuns,512);
assert.equal(audit.unverifiedCandidateOnlyExactRows.length,0);assert.equal(audit.stateRegressions.length,0);assert.equal(audit.qualityRegressions.length,0);
write(`${ROOT}/.a0/freeze/FREEZE.json`,{status:'FROZEN_INTEGRATED_SCOPE_NOT_DEV_APPROVAL',buildSha256:jsonSha(summary.build),candidateCommit:summary.build.candidateCommit,
  wasmSha256:summary.build.wasmSha256,developmentSummarySha256:jsonSha(summary),independentAuditSha256:jsonSha(audit),retuningPermitted:false,devApplyAuthorized:false,fullThresholdRouteEvidenceRequired:false,priorFailedRunPreserved:37034641097});
console.log('Unchanged A0 configuration frozen for reserved integrated-only verification, not Dev approval.');
