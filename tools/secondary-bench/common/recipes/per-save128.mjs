// Approved, frozen 128-fixture campaign. No collection or solver invocation here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, sha256, digest, verifySources } from '../contracts.mjs';
import { resolveManifest, PROFILE } from '../manifest.mjs';
import { commonSources } from './followup.mjs';

const directory = 'tools/secondary-bench/experiments/per-save128-20261005';
export function prepareManifest() {
  const input = readJson(directory + '/INPUT_PROVENANCE.json');
  assert.equal(input.fixtures.length, 128); assert.equal(input.selection.selectedCount, 128);
  const legacy = readJson('tools/secondary-bench/prepared-20261005-transportfix/A_TEMPLATE.json');
  const sources = commonSources(legacy.sourceFiles);
  for (const file of [directory + '/INPUT_PROVENANCE.json', directory + '/fixtures.zip']) sources.harness[file] = sha256(fs.readFileSync(file));
  const limits = { startupMs: 10000, callMs: 60000, reapMs: 5000 };
  const manifest = resolveManifest({ schemaVersion: 1, campaignId: 'common-persave128-20261005', revision: 1, purpose: 'information',
    approval: 'USER_APPROVED_ASTRA_SELECTION128_COMMON_HARNESS_4VM_20261005', profile: PROFILE.id, sourceFiles: sources,
    inputs: { commands: [], diagnostics: [], recovery: [], fixtures: input.fixtures.map(f => ({ id: f.id,
      file: 'common-per-save128/inputs/' + f.sha256 + '.json', sha256: f.sha256, acquisition: 'ORIGINAL_PER_SAVE_CAPTURE_REUSED',
      provenance: { role: 'development', originalFile: f.originalFile, originalCaptureRunId: f.captureRunId,
        selectionReason: f.selectionReason, selectionRank: f.selectionRank, selectionSha256: input.selectionSha256 } })) },
    selection: { id: 'all-nontrivial-v1', supplementIds: [] },
    repeats: { initial: 2, additional: 2, threshold: 1.10, seed: input.selection.seed, order: 'six-engine-orders-v1' },
    limits: { secondary: limits, capture: limits, diagnostic: { ...limits, callMs: 120000 }, phases: { enumeration: 30000, primary: 60000 } },
    budget: { maxParallel: 4, overallMs: 36 * 3600000, maxCalls: 1536 },
    provenance: { role: 'development', exposures: ['ALL_SELECTED_INPUTS_PREVIOUSLY_CAPTURED_AND_EXPOSED_NOT_FRESH'],
      selectionSha256: input.selectionSha256, selectionDatabaseSha256: input.selection.databaseSha256,
      concurrentAllocation: { vmCap: 20, reservations: [{ runId: '37280034634', headSha: '6ddfa72340e9371341598078f5ba5d8231ec3366',
        workflowPath: '.github/workflows/secondary-bench-all-a.yml', maxParallel: 12,
        templateFile: 'tools/secondary-bench/prepared-20261005-transportfix/A_TEMPLATE.json',
        templateSha256: sha256(fs.readFileSync('tools/secondary-bench/prepared-20261005-transportfix/A_TEMPLATE.json')) }] } },
    analysis: 'INFORMATION_ONLY' });
  writeJson(directory + '/MANIFEST.json', manifest); return manifest;
}
export function prepareBundle() {
  const marker = readJson('.github/secondary-common/PERSAVE128_START.json');
  assert.equal(marker.confirm, 'RUN_COMMON_HARNESS'); assert.equal(marker.manifest, directory + '/MANIFEST.json');
  const manifest = resolveManifest(readJson(marker.manifest));
  assert.equal(digest(manifest), marker.manifestHash); assert.equal(digest(manifest.sourceFiles), marker.sourceLock);
  verifySources(manifest.sourceFiles);
  assert(!fs.existsSync('common-per-save128'), 'new configuration bundle required');
  fs.mkdirSync('common-per-save128'); // ZIP guard admits space against this existing parent.
  execFileSync('python', [fileURLToPath(new URL('../../followup-extract.py', import.meta.url)),
    directory + '/fixtures.zip', 'common-per-save128/inputs', String(4 * 1024 ** 3)], { stdio: 'inherit', timeout: 120000 });
  for (const f of manifest.inputs.fixtures) assert.equal(sha256(fs.readFileSync(f.file)), f.sha256);
  writeJson('common-per-save128/MANIFEST.json', manifest);
  writeJson('common-per-save128/SELECTION_PROVENANCE.json', readJson(directory + '/INPUT_PROVENANCE.json'));
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(['manifest', 'bundle'].includes(process.argv[2]));
  const manifest = process.argv[2] === 'manifest' ? prepareManifest() : prepareBundle();
  console.log(JSON.stringify({ campaignId: manifest.campaignId, manifestHash: digest(manifest), sourceLock: digest(manifest.sourceFiles),
    fixtures: manifest.inputs.fixtures.length, maxParallel: manifest.budget.maxParallel }));
}
