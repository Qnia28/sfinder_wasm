import fs from 'node:fs';
import assert from 'node:assert/strict';
import {HERE,ROOT,read,write,sha,jsonSha} from './common.mjs';
const resume=read(`${HERE}/resume.json`),summaryFile=`${ROOT}/.a0/development-summary/SUMMARY.json`,summary=read(summaryFile),audit=read(`${ROOT}/.a0/development-summary/INDEPENDENT_AUDIT.json`);
assert.equal(sha(fs.readFileSync(summaryFile)),resume.originalDevelopmentSummaryFileSha256);assert.equal(summary.status,'PASS_INTEGRATED_SCOPE');
assert.equal(audit.summaryGateStatus,summary.status);assert.equal(audit.observedRuns,512);assert.equal(audit.stateRegressions.length+audit.qualityRegressions.length+audit.unverifiedCandidateOnlyExactRows.length,0);
assert.equal(summary.build.candidateCommit,'13b274ef91a2debe07121f7b4a0e670ed39e034f');
write(`${ROOT}/.a0/freeze/FREEZE.json`,{status:'FROZEN_INTEGRATED_SCOPE_NOT_DEV_APPROVAL',buildSha256:jsonSha(summary.build),candidateCommit:summary.build.candidateCommit,wasmSha256:summary.build.wasmSha256,
  developmentSummarySha256:jsonSha(summary),developmentSummaryFileSha256:sha(fs.readFileSync(summaryFile)),independentAuditSha256:jsonSha(audit),auditorCorrection:read(`${ROOT}/.a0/development-summary/AUDIT_CORRECTION.json`),
  sourceMeasurementRunId:37039906398,resumeRunId:Number(process.env.GITHUB_RUN_ID),developmentProbeReruns:0,retuningPermitted:false,devApplyAuthorized:false,priorFailedRunsPreserved:[37034641097,37039906398]});
const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/37039906398`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});assert(response.ok);
const run=await response.json(),deadline=Date.parse(run.created_at)+160*60000;assert(Number.isFinite(deadline)&&Date.now()+92000<deadline);
fs.appendFileSync(process.env.GITHUB_OUTPUT,`allowed=true\ncompute-deadline=${deadline}\n`);
console.log(JSON.stringify({status:'FROZEN',budgetSourceRunId:37039906398,developmentProbeReruns:0,computeDeadline:new Date(deadline).toISOString(),devApplied:false}));
