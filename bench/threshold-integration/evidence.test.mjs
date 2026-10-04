import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { manifest, root as fixtureRoot, loadFixture } from './fixtures.mjs';
import { sha256 } from './engine.mjs';

function blob(path) {
  const r = spawnSync('git', ['show', `${manifest.sourceEvidence}:${path}`], { maxBuffer: 32 * 1024 * 1024 });
  assert.equal(r.status, 0, String(r.stderr)); return r.stdout;
}
test('original selections IDs duplicates order seeds and compressed bytes match immutable evidence', () => {
  for (const p of manifest.provenance) {
    const prefix = `bench/threshold/${p.source}/`, bytes = blob(prefix + 'manifest.json');
    assert.equal(sha256(bytes), p.manifestHash);
    const original = JSON.parse(bytes), entries = manifest.cases.filter(e => e.cohort === p.cohort);
    assert.equal(entries.length, 100);
    assert.deepEqual(entries.map(e => e.id), original.cases.map(e => e.id));
    for (const [i, entry] of entries.entries()) {
      const expected = { ...original.cases[i], cohort: p.cohort, suite: 'validation', file: `${p.cohort}/${original.cases[i].file}` };
      assert.deepEqual(entry, expected);
      assert.equal(sha256(readFileSync(resolve(fixtureRoot, entry.file))), sha256(blob(prefix + original.cases[i].file)));
      const { matrix } = loadFixture(entry.id); assert.deepEqual(matrix.seed, entry.seedIds);
    }
  }
  for (const pair of [['cycle1-grace-system-a-O', 'cycle1-grace-system-b-O'], ['c7-2plus2-qb-row-175-L', 'c7-2plus2-qb-row-018-L']]) {
    const [a, b] = pair.map(id => loadFixture(id).matrix);
    assert.deepEqual({ keys: a.keys, rows: a.rows, K: a.K }, { keys: b.keys, rows: b.rows, K: b.K });
  }
});
const archive = process.env.THRESHOLD_INTEGRATION_ARCHIVE;
test('sealed compact archive retains every sample hashes and complete regression accounting', { skip: !archive && 'set THRESHOLD_INTEGRATION_ARCHIVE to a published archive' }, () => {
  const receipt = JSON.parse(readFileSync(resolve(archive, 'archive.json')));
  for (const file of receipt.files) assert.equal(sha256(readFileSync(resolve(archive, file.file))), file.sha256);
  const build = JSON.parse(readFileSync(resolve(archive, 'build.json')));
  assert.equal(build.candidate, receipt.candidate); assert.equal(build.dirty, '');
  const known = JSON.parse(readFileSync(resolve(fixtureRoot, 'known-witnesses.json')));
  const browser = JSON.parse(readFileSync(resolve(archive, 'browser.json')));
  assert.deepEqual(browser.map(b => b.mode), ['S', 'D', 'C', 'A', 'B']);
  for (const b of browser) {
    assert.equal(b.wasmHash, build.hashes[b.mode]); assert(b.cancellation.reclaimed && b.restarted);
    for (const r of b.results) {
      assert.equal(r.worker.witnessHash, known[r.id]); assert.equal(r.locked.witnessHash, known[r.id]);
      assert.equal(r.worker.qualityVector, undefined); assert.equal(r.locked.qualityVector, undefined);
    }
  }
  for (const name of ['initial.json', 'control.json', 'repeat.json']) {
    if (!existsSync(resolve(archive, name))) { assert.equal(name, 'repeat.json'); continue; }
    const data = JSON.parse(readFileSync(resolve(archive, name)));
    assert.equal(data.samples.length, data.executedSamples);
    assert.equal(data.requestedSamples, data.executedSamples + data.skippedSamples);
    assert.equal(data.exact + data.timeout, data.executedSamples);
    for (const e of data.environments) { assert.equal(e.buildHash, sha256(JSON.stringify(build))); assert.equal(e.build, undefined); }
    for (const row of data.perCase) {
      const samples = data.samples.filter(s => s.caseId === row.caseId && s.comparisonIndex === row.comparisonIndex);
      assert.equal(samples.length, row.executedPairs * 2);
      assert(row.fasterPairs + row.slowerPairs <= row.pairedComplete);
      for (const sample of samples.filter(s => s.status === 'EXACT')) assert.equal(sample.witnessHash, data.witnessHashes[row.caseId]);
    }
  }
});
