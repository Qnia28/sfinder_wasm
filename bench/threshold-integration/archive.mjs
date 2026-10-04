import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256, validateWitness } from './engine.mjs';
import { loadFixture } from './fixtures.mjs';
const [resultsRoot, buildRoot, destination] = process.argv.slice(2); assert(resultsRoot && buildRoot && destination);
mkdirSync(destination, { recursive: true });
const build = JSON.parse(readFileSync(resolve(buildRoot, 'build.json'))), hashes = [];
function store(name, bytes) {
  const file = resolve(destination, name);
  if (process.argv.includes('--resume-identical') && existsSync(file)) assert.equal(sha256(readFileSync(file)), sha256(bytes), `refusing to replace differing archive ${name}`);
  else writeFileSync(file, bytes, { flag: 'wx' });
  hashes.push({ file: name, sha256: sha256(bytes) });
}
store('build.json', readFileSync(resolve(buildRoot, 'build.json')));
for (const [name, path] of [['initial.json', 'review/review.json'], ['control.json', 'control/control-review.json'], ['repeat.json', 'recheck-review/review.json']]) {
  let bytes;
  try { bytes = readFileSync(resolve(resultsRoot, path)); } catch (e) { if (name === 'repeat.json' && e.code === 'ENOENT') continue; throw e; }
  const data = JSON.parse(bytes); assert.deepEqual(data.wasmHashes, build.hashes);
  // Preserve every sample and all environment identity without repeating the
  // full source table in every runner environment (kept once in build.json).
  data.environments = data.environments.map(({ build: repeated, ...environment }) => {
    assert.deepEqual(repeated, build); return { ...environment, buildHash: sha256(JSON.stringify(build)) };
  });
  store(name, JSON.stringify(data, null, 2) + '\n');
}
for (const [name, path] of [['selection.json', 'review/selection.json'], ['resolution.json', 'final/resolution.json'],
  ['REPORT_KO.md', 'final/report.md'], ['correctness.json', 'correctness/abi.json'], ['source-audit.json', 'source-audit.json'],
  ['raw-audit.json', 'raw-audit.json'], ['replay.json', 'replay.json'], ['validation.json', 'validation.json']]) {
  store(name, readFileSync(resolve(resultsRoot, path)));
}
const browserBytes = readFileSync(resolve(resultsRoot, 'correctness/browser.json'));
const known = JSON.parse(readFileSync(new URL('./fixtures/known-witnesses.json', import.meta.url)));
const browser = JSON.parse(browserBytes).map(mode => ({ ...mode, originalRawHash: sha256(browserBytes),
  results: mode.results.map(row => {
    const { matrix } = loadFixture(row.id);
    const index = new Map(matrix.keys.map((key, i) => [key, i]));
    const compact = response => {
      const witnessHash = validateWitness(matrix, { count: response.count, selected: response.keys.map(k => index.get(k)), quality: response.qualityVector });
      assert(response.completed); if (known[row.id]) assert.equal(witnessHash, known[row.id]);
      const { keys, qualityVector, ...rest } = response; return { ...rest, witnessHash };
    };
    return { ...row, worker: compact(row.worker), locked: compact(row.locked) };
  }) }));
store('browser.json', JSON.stringify(browser, null, 2) + '\n');
store('archive.json', JSON.stringify({ baseline: build.baseline, candidate: build.candidate, files: hashes,
  contract: 'All paired measurements and completed witness hashes preserved; no stored full repeated witnesses/build metadata. Raw Actions witnesses retained30days; immutable200 input fixtures tracked separately.' }, null, 2) + '\n');
console.log(`Archived ${hashes.length} files in ${destination}`);
