import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sha256, validateMatrix } from './engine.mjs';

export const root = process.env.THRESHOLD_FIXTURE_ROOT
  ? resolve(process.env.THRESHOLD_FIXTURE_ROOT) : fileURLToPath(new URL('./fixtures/', import.meta.url));
export const manifestPath = resolve(root, 'manifest.json');
export const manifest = JSON.parse(readFileSync(manifestPath));
export function loadFixture(id) {
  const entry = manifest.cases.find(x => x.id === id);
  assert(entry, `unknown fixture: ${id}`);
  const gzip = readFileSync(resolve(root, entry.file));
  assert.equal(sha256(gzip), entry.compressedSha256);
  const bytes = gunzipSync(gzip);
  assert.equal(sha256(bytes), entry.sha256);
  const matrix = JSON.parse(bytes);
  validateMatrix(matrix);
  assert.equal(matrix.K, entry.K);
  assert.deepEqual(matrix.seed, entry.seedIds);
  return { entry, matrix };
}

if (process.argv.includes('--verify')) {
  for (const entry of manifest.cases) loadFixture(entry.id);
  const dev = new Set(manifest.cases.filter(x => x.suite === 'development').map(x => x.mirrorGroup));
  assert(manifest.cases.filter(x => x.suite === 'validation').every(x => !dev.has(x.mirrorGroup)));
  console.log(`Verified ${manifest.cases.length} fixture hashes and mirror-group separation.`);
}
