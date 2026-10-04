import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openEngine, sha256, validateWitness } from './engine.mjs';
import { manifest, loadFixture } from './fixtures.mjs';
const [root, output] = process.argv.slice(2); assert(root && output, 'explicit original measured build directory and new receipt required');
const build = JSON.parse(readFileSync(resolve(root, 'build.json')));
const known = JSON.parse(readFileSync(new URL('./fixtures/known-witnesses.json', import.meta.url)));
const modes = ['S', 'D', 'C', 'A', 'B', 'reference'], engines = {};
const result = { buildHash: sha256(readFileSync(resolve(root, 'build.json'))), candidate: build.candidate, hashes: build.hashes,
  correctnessOnly: true, performanceSamples: 0, preservedMatrices: 0, exactQbCalls: 0, boundedCalls: 0, activation: { current: 0, root: 0 } };
try {
  for (const mode of modes) {
    engines[mode] = await openEngine(resolve(root, `${mode}.wasm`));
    assert.equal(engines[mode].wasmHash, build.hashes[mode], `replay identity gate ${mode}`); assert.equal(engines[mode].traceEnabled, false);
  }
  for (const entry of manifest.cases) {
    const { matrix } = loadFixture(entry.id), actual = {};
    for (const mode of modes.filter(m => m !== 'reference')) {
      actual[mode] = engines[mode].solve(matrix, { stateBudget: 20 });
      validateWitness(matrix, actual[mode]); assert(actual[mode].searchedStates <= 20); result.boundedCalls++;
      if (entry.cohort === 'qb') {
        const done = engines[mode].solve(matrix); assert(done.completed);
        assert.equal(validateWitness(matrix, done), known[entry.id]); result.exactQbCalls++;
      }
    }
    assert.deepEqual(actual.D, actual.C);
    for (const key of ['completed', 'selected', 'quality', 'searchedStates']) assert.deepEqual(actual.S[key], actual.D[key]);
    for (const [mode, mask] of [['A', 16], ['B', 20]]) {
      const ref = engines.reference.solve(matrix, { mask, stateBudget: 20 }); assert.deepEqual(actual[mode], ref);
      result.boundedCalls++;
      if (entry.cohort === 'qb') {
        const done = engines.reference.solve(matrix, { mask }); assert(done.completed);
        assert.equal(validateWitness(matrix, done), known[entry.id]); result.exactQbCalls++;
      }
    }
    result.activation.current += actual.C.searchedStates !== actual.A.searchedStates ? 1 : 0;
    result.activation.root += actual.A.searchedStates !== actual.B.searchedStates ? 1 : 0;
    result.preservedMatrices++;
    if (result.preservedMatrices % 20 === 0) console.log(`Measured-build correctness replay ${result.preservedMatrices}/200`);
  }
} finally { for (const engine of Object.values(engines)) engine.close(); }
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result, null, 2));
