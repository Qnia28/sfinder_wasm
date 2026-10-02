import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { sha256, validateMatrix } from './engine.mjs';

export const root = fileURLToPath(new URL('.', import.meta.url));
export const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
export function loadFixture(id) {
  const entry = manifest.cases.find(x => x.id === id);
  assert(entry, `unknown fixture: ${id}`);
  const gzip = readFileSync(new URL(entry.file, import.meta.url));
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
