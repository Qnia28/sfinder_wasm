// Activate only a pre-approved template; origin is the workflow's immutable
// created_at, NOT a per-job/per-retry start time. No automatic dispatch.
import assert from 'node:assert/strict';
import { readJson, writeJson } from './contracts.mjs';
import { validateCampaign } from './campaign.mjs';
import { verifyFiles } from './run.mjs';
const [templateFile, originUtc, runId, outputFile] = process.argv.slice(2);
const template = readJson(templateFile);
assert.equal(template.state, 'APPROVED_TEMPLATE', 'freeze source, inputs and selection before Actions execution');
assert.equal(template.originPolicy, 'GITHUB_RUN_CREATED_AT'); assert.equal(template.originUtc, null);
assert(/^[0-9]+$/.test(runId), 'GitHub run ID required');
const plan = { ...template, state: 'APPROVED', originUtc, campaignId: template.campaignId + '-' + runId };
validateCampaign(plan); verifyFiles(plan.sourceFiles); writeJson(outputFile, plan);
console.log(JSON.stringify({ campaignId: plan.campaignId, originUtc: plan.originUtc,
  overallHours: plan.policy.overallMs / 3600000, extraAdmissionHours: plan.policy.extraAdmissionMs / 3600000 }));
