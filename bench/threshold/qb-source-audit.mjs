import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { BASELINE_SHA, sha256 } from './engine.mjs';
const build = JSON.parse(readFileSync(new URL('./reports/qb-independent-build.json', import.meta.url)));
assert.equal(build.baseline, BASELINE_SHA); assert.equal(build.dirty, '');
const checked = {};
for (const [name, sources] of Object.entries(build.sources)) {
  assert.equal(sha256(JSON.stringify(sources)), build.sourceDigest[name]);
  const rev = name === 'originalRust' ? BASELINE_SHA : build.candidate;
  for (const [path, hash] of Object.entries(sources)) {
    const r = spawnSync('git', ['show', `${rev}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr?.toString()); assert.equal(sha256(r.stdout), hash, `${name}/${path}`);
  }
  checked[name] = { revision: rev, files: Object.keys(sources).length, digest: build.sourceDigest[name] };
}
const reference = JSON.parse(readFileSync(new URL('./reports/root-screen.json', import.meta.url)));
assert.equal(build.hashes.experiment, reference.wasmHashes.experiment);
for (const key of ['originalRust', 'candidateRust', 'candidateJs']) assert.equal(build.sourceDigest[key], reference.sourceDigest[key]);
writeFileSync(new URL('./reports/qb-independent-source-audit.json', import.meta.url), JSON.stringify({
  candidate: build.candidate, baseline: BASELINE_SHA, checked, experimentWasmHash: build.hashes.experiment,
  previousRootCampaignEngineUnchanged: true,
  audit: 'Every source-map file hash matched immutable Git blob bytes at pinned baseline/campaign commits, not current working-tree files. Each map digest recomputed. Experiment WASM and original/candidate Rust/product JS digests match the completed root-screen reference.',
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(checked, null, 2));
