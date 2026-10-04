// Creates a separate DRAFT after the first run. Its original matrices and seed
// hashes are reused, but NONE of the first-run timings count as extended repeats.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, hash, identity } from './contracts.mjs';
import { EXTENDED_POLICY, EXTENDED_LIMITS } from './campaign.mjs';
const [firstBundleDir, runId, outputFile] = process.argv.slice(2);
const first = readJson(path.join(firstBundleDir, 'campaign.json'));
const wave = readJson(path.join(firstBundleDir, 'WAVE_PLAN.json'));
const selected = new Set(wave.selection.flatMap(entry => entry.selected));
const lock = fs.readdirSync(path.join(firstBundleDir, 'fixtures')).map(filename => {
  const bytes = fs.readFileSync(path.join(firstBundleDir, 'fixtures', filename)), fixture = JSON.parse(bytes);
  return { id: fixture.id, sha256: hash(bytes) };
}).filter(f => selected.has(f.id)).sort((a, b) => a.id.localeCompare(b.id));
writeJson(outputFile, { ...first, state: 'DRAFT', campaignVariant: 'extended-5m', campaignId: 'secondary-extended-20261005',
  originPolicy: 'GITHUB_RUN_CREATED_AT', originUtc: null, sourceFiles: {}, policy: EXTENDED_POLICY,
  approvalRecord: '2026-10-05 user: after first run completes, 5min timeout;4/8/12/16/20;extra admission before5h;overall6h;one merged final report',
  limits: Object.fromEntries(['integrated', 'threshold', 'cpsat'].map(engine => [engine, EXTENDED_LIMITS])), cpLimitMs: 300000,
  reuseCaptureRunId: String(runId), reuseCampaignId: first.campaignId, reuseSourceLock: identity(first.sourceFiles),
  reusedFixtureLock: lock, provenance: { previous: first.provenance, reuseSourceLock: identity(first.sourceFiles) },
  pending: ['First run must finish before approved extended template is published', 'Current runtime source and workflow lock',
    'Combined final report keeps timeout conditions and repeat populations separate'] });
console.log(JSON.stringify({ reusedFixtures: lock.length, basicCalls: lock.length * 12, maximumCalls: lock.length * 60,
  callSeconds: 300, extraAdmissionHours: 5, wallHours: 6 }));
