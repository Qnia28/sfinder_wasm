// Canonical Git index bytes match a Linux checkout (local product checkout is
// CRLF). Every runtime file is staged BEFORE freezing; the manifest never hashes
// itself. Activation verifies the actual Linux checkout, not normalized bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readJson, writeJson, hash } from './contracts.mjs';
import { validateCampaign } from './campaign.mjs';

const [draftFile, outputFile] = process.argv.slice(2);
assert(draftFile && outputFile, 'usage: freeze-campaign.mjs <draft> <new-approved-template>');
const draft = readJson(draftFile); assert.equal(draft.state, 'DRAFT');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const selected = files.filter(name => name.startsWith('src/') || name.startsWith('wasm/') || name.startsWith('rust/')
  || name.startsWith('tools/secondary-bench/') && !name.startsWith('tools/secondary-bench/planning/')
  || name.startsWith('.github/workflows/secondary-bench-') || name.startsWith('tests/secondary-bench')
  || name.startsWith('tests/helpers/secondary-bench-') || ['.gitattributes', 'package.json', 'package-lock.json',
    'tools/secondary-bench/planning/INPUT_PROPOSAL_2FAMILY.json',
    'tools/secondary-bench/planning/REMOTE_PREFLIGHT_RESULT.json',
    'tools/secondary-bench/planning/TESTING_RULES_KO.md'].includes(name));
const sourceFiles = Object.fromEntries(selected.sort().map(name => [name,
  hash(execFileSync('git', ['show', ':' + name], { maxBuffer: 64 * 1024 * 1024 }))]));
assert(sourceFiles['tools/secondary-bench/freeze-campaign.mjs'], 'freeze script must be staged');
const plan = { ...draft, state: 'APPROVED_TEMPLATE', sourceFiles,
  approvalRecord: draft.approvalRecord + '; user explicitly authorizes execution and autonomous correction of execution/harness errors',
  pending: [], sourceByteContract: 'GIT_INDEX_CANONICAL_LINUX_CHECKOUT_NO_TEXT_NORMALIZATION_AT_VERIFY',
  provenance: { baselineCommit: '7ef62d18e1d155b6479e00d651c851ff3baa7112',
    preparationHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    remotePreflightRunId: 37221748946, queueLength: 'N+1_ONLY',
    partition: '220_DEVELOPMENT_55_UNMEASURED_RESERVE_FRESHNESS_UNCONFIRMED',
    exposureAudit: 'PARTIAL_CONSERVATIVE_NO_CLAIM_OF_FRESHNESS',
    executionAuthorization: 'CURRENT_USER_MESSAGE_EXECUTE',
    historicalTimesImported: false,
    fixtureSelection: 'ONE_NONTRIVIAL_SAVE_PER_COMMAND_HASH_BEFORE_ENGINE_MEASUREMENTS',
    campaignVariant: draft.campaignVariant ?? 'initial-1m', reuseCaptureRunId: draft.reuseCaptureRunId ?? null } };
validateCampaign({ ...plan, state: 'APPROVED', originUtc: new Date().toISOString() });
writeJson(outputFile, plan);
console.log(JSON.stringify({ files: selected.length, commands: plan.commands.length,
  outputFile, pcWasmSha256: sourceFiles['wasm/pc_wasm.wasm'], runtimeHours: plan.policy.overallMs / 3600000, maximumConcurrentVMs: 16 }));
