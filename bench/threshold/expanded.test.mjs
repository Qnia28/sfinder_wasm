import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { openEngine, sha256, validateMatrix, validateWitness } from './engine.mjs';
import { settings, defaults } from './profiles.mjs';

const base = new URL('./cycle1-100/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)));
const oldBytes = readFileSync(new URL('./cycle1/manifest.json', import.meta.url));
const old = JSON.parse(oldBytes);
function matrix(entry) {
  const gzip = readFileSync(new URL(entry.file, base));
  assert.equal(sha256(gzip), entry.compressedSha256);
  const bytes = gunzipSync(gzip); assert.equal(sha256(bytes), entry.sha256);
  const m = JSON.parse(bytes); validateMatrix(m);
  assert.equal(m.K, entry.K); assert.deepEqual(m.seed, entry.seedIds);
  return m;
}
test('expanded100 keeps previous20 unchanged and limits correlated board/mirror groups', () => {
  assert.equal(manifest.cases.length, 100);
  assert.equal(new Set(manifest.cases.map(c => c.id)).size, 100);
  assert.equal(manifest.policy.previousManifestHash, sha256(oldBytes));
  assert.equal(manifest.cases.filter(c => c.cohort === 'previous20').length, 20);
  assert.equal(manifest.cases.filter(c => c.cohort === 'additional80').length, 80);
  const groups = new Map();
  for (const c of manifest.cases) { matrix(c); groups.set(c.mirrorGroup, (groups.get(c.mirrorGroup) ?? 0) + 1); }
  assert.equal(groups.size, 41); assert([...groups.values()].every(n => n <= 3));
  for (const prior of old.cases) {
    const expanded = manifest.cases.find(c => c.id === prior.id); assert(expanded);
    for (const key of ['sha256', 'compressedSha256', 'K', 'seedIds', 'suite']) assert.deepEqual(expanded[key], prior[key]);
    assert.deepEqual(readFileSync(new URL(prior.file, new URL('./cycle1/', import.meta.url))),
      readFileSync(new URL(expanded.file, base)));
  }
});
test('third confirmation is same-binary OFF/ON, not different-VM or original/candidate timing', () => {
  assert.deepEqual(settings('confirm-onoff', 16), [{ left: { engine: 'experiment', mask: 0 },
    right: { engine: 'experiment', mask: 16 } }]);
  assert.deepEqual(defaults('confirm-onoff'), [5, 300]);
  assert.throws(() => settings('confirm-onoff', 0));
});
test('every expanded matrix produces valid bounded OFF/ON witnesses without budget overrun', async () => {
  const engine = await openEngine(resolve(process.env.THRESHOLD_BUILD_ROOT ?? 'bench/threshold/build', 'experiment.wasm'));
  try {
    for (const entry of manifest.cases) {
      const m = matrix(entry);
      const off = engine.solve(m, { mask: 0, stateBudget: 1 });
      const on = engine.solve(m, { mask: 16, stateBudget: 1 });
      for (const r of [off, on]) { validateWitness(m, r); assert(r.searchedStates <= 1); }
      if (off.completed && on.completed) {
        assert.deepEqual(off.selected, on.selected); assert.deepEqual(off.quality, on.quality);
      }
    }
  } finally { engine.close(); }
});
