import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const destination = path.resolve(process.argv[2] ?? path.join(root, '.a0-m1-build/source'));
assert(!fs.existsSync(destination), 'Use a new isolated build tree; never overwrite source');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'candidate/a0-m1/PROVENANCE.json')));
const overlay = fs.readFileSync(path.join(root, 'candidate/a0-m1/min_cover.rs'));
assert.equal(createHash('sha256').update(overlay).digest('hex'), manifest.overlaySha256);
fs.cpSync(path.join(root, 'rust'), path.join(destination, 'rust'), {
  recursive: true, filter: p => !/(?:^|[/\\])target(?:[/\\]|$)/.test(p),
});
fs.writeFileSync(path.join(destination, 'rust/pc-core/src/min_cover.rs'), overlay);
const tests = fs.readFileSync(path.join(root, 'candidate/a0-m1/min_cover_four_arm_tests.rs'));
assert.equal(createHash('sha256').update(tests).digest('hex'), manifest.testsSha256);
fs.writeFileSync(path.join(destination, 'rust/pc-core/src/min_cover_four_arm_tests.rs'), tests);
const reference = fs.readFileSync(path.join(root, 'candidate/a0-m1/four_arm_reference.rs'));
assert.equal(createHash('sha256').update(reference).digest('hex'), manifest.testReferenceSha256);
fs.writeFileSync(path.join(destination, 'rust/pc-core/src/four_arm_reference.rs'), reference);
const baseTests = fs.readFileSync(path.join(root, 'candidate/a0-m1/min_cover_tests.rs'));
assert.equal(createHash('sha256').update(baseTests).digest('hex'), manifest.baseTestsSha256);
fs.writeFileSync(path.join(destination, 'rust/pc-core/src/min_cover_tests.rs'), baseTests);
// These manifests match the measured M1 build; neither feature is enabled in R.
for (const [crate, features] of [['pc-core', 'a0-lower-cutoff = []\na0-last-sibling = []\na0-diagnostics = []'],
  ['pc-wasm', 'a0-diagnostics = ["pc-core/a0-diagnostics"]']]) {
  const file = path.join(destination, `rust/${crate}/Cargo.toml`);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('[lib]', `[features]\n${features}\n\n[lib]`));
}
console.log(destination);
