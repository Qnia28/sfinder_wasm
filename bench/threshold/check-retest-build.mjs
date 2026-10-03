import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('./ci-run.json', import.meta.url)));
if (config.caseSelection) {
  const selection = JSON.parse(readFileSync(new URL('./retest-selection.json', import.meta.url)));
  const build = JSON.parse(readFileSync(new URL('./build/build.json', import.meta.url)));
  assert.equal(build.hashes.experiment, selection.wasmHash, 'retest must use byte-identical experimental WASM');
  for (const key of ['originalRust', 'candidateRust', 'candidateJs']) {
    assert.equal(build.sourceDigest[key], selection.sourceDigest[key], `changed ${key} during retest`);
  }
  console.log('Retest source and experimental WASM hashes match the expanded100 run.');
}
