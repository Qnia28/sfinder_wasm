import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, copyFileSync, writeFileSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const source = resolve(process.argv[2]); assert(process.argv[2]);
const output = resolve('bench/threshold-integration/fixtures'); mkdirSync(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const cases = [], provenance = [];
for (const [cohort, dir] of [['cycle1', 'cycle1-100'], ['qb', 'qb-independent100']]) {
  const root = resolve(source, 'bench/threshold', dir), bytes = readFileSync(resolve(root, 'manifest.json'));
  const manifest = JSON.parse(bytes); provenance.push({ cohort, manifestHash: hash(bytes), source: dir });
  mkdirSync(resolve(output, cohort, 'inputs'), { recursive: true });
  for (const c of manifest.cases) {
    const file = `${cohort}/${c.file}`, gzip = readFileSync(resolve(root, c.file));
    assert.equal(hash(gzip), c.compressedSha256);
    copyFileSync(resolve(root, c.file), resolve(output, file), constants.COPYFILE_EXCL);
    cases.push({ ...c, file, cohort, suite: 'validation' });
  }
}
assert.equal(cases.length, 200); assert.equal(new Set(cases.map(c => c.id)).size, 200);
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ version: 1, dataset: 'threshold-product-cycle1-qb200',
  baseline: 'c0cb2a048e7275bfea587d176b1954efff0a8a08', sourceEvidence: '908efa38b932837a0c12e5a26b8fd290c6d03d18',
  provenance, cases, smoke: cases.slice(0, 2).map(c => c.id) }, null, 2) + '\n', { flag: 'wx' });
// Reuse only engine/harness utilities and immutable evidence, not experimental
// Rust/WASM wrappers, product JS, old workflows or old run configurations.
const out = resolve('bench/threshold-integration');
for (const file of ['engine.mjs', 'fixtures.mjs', 'sample.mjs', 'benchmark.mjs', 'timeout-policy.mjs', 'timeout-policy.test.mjs']) {
  copyFileSync(resolve(source, 'bench/threshold', file), resolve(out, file), constants.COPYFILE_EXCL);
}
console.log('Preserved200 matrices and paired harness; no experimental product code copied.');
