// Synthetic inputs only. This does not run a real setup benchmark.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readJson, writeJson, sha256, digest } from '../contracts.mjs';
import { resolveManifest, PROFILE } from '../manifest.mjs';
import { commonSources } from './followup.mjs';

export function prepareSmoke(directory) {
  const command = { id: 'synthetic/all/bag', kind: 'minimals', wantedSave: 'ALL', family: 'bag', pattern: '*!',
    sourceFumen: 'v115@9gwhQ4hlFewhR4glFewhg0Q4glFewhi0PeAgH', clear: 4, useHold: true,
    piecesNeeded: 6, queueLength: 7, savedPieceCount: 1, exactHumanQuality: 'true', primary: 'auto' };
  const fixture = { schema: 1, id: 'synthetic-two-candidates', keys: ['a', 'b'], K: 1, seed: [0], rows: [[[0, 1], [1, 2]]],
    cardinalityProof: { status: 'PROVEN', backend: 'kernel', kernelStats: {} }, primaryHard: false,
    origin: { command, filter: 'ALL' }, trivial: null };
  const input = path.join(directory, 'input.json'); writeJson(input, fixture);
  const limits = { startupMs: 10000, callMs: 60000, reapMs: 5000 };
  const frozen = readJson('tools/secondary-bench/prepared-20261005-transportfix/A_TEMPLATE.json');
  const sources = commonSources(frozen.sourceFiles);
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    const marker = readJson('.github/secondary-common/SMOKE_START.json');
    assert.equal(marker.confirm, 'RUN_COMMON_HARNESS'); assert.equal(marker.sourceLock, digest(sources), 'smoke marker source mismatch');
  }
  const manifest = resolveManifest({ schemaVersion: 1, campaignId: 'common-synthetic-smoke', revision: 1, purpose: 'information',
    approval: 'EXPLICIT_MANUAL_SYNTHETIC_SMOKE_ONLY', profile: PROFILE.id, sourceFiles: sources,
    inputs: { commands: [], diagnostics: [], recovery: [], fixtures: [{ id: fixture.id, file: input.replaceAll('\\', '/'),
      sha256: sha256(fs.readFileSync(input)), acquisition: 'SYNTHETIC', provenance: { role: 'development' } }] },
    selection: { id: 'all-nontrivial-v1', supplementIds: [] },
    repeats: { initial: 2, additional: 2, threshold: 1.10, seed: 'synthetic-smoke', order: 'six-engine-orders-v1' },
    limits: { secondary: limits, capture: limits, diagnostic: limits, phases: { enumeration: 30000, primary: 30000 } },
    budget: { maxParallel: 1, overallMs: 3600000, maxCalls: 12 },
    provenance: { role: 'development', exposures: ['SYNTHETIC_CONTRACT_ONLY'] }, analysis: 'INFORMATION_ONLY' });
  writeJson(path.join(directory, 'MANIFEST.json'), manifest); return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareSmoke(process.argv[2]);
