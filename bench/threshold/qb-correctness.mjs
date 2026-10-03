import assert from 'node:assert/strict';
import { manifest, loadFixture } from './fixtures.mjs';
import { openEngine, validateWitness } from './engine.mjs';
const engine = await openEngine('bench/threshold/build/experiment.wasm');
try {
  for (const c of manifest.cases) {
    const { matrix } = loadFixture(c.id);
    for (const stateBudget of [0, 1, 20]) for (const mask of [0, 16, 20]) {
      const result = engine.solve(matrix, { mask, stateBudget });
      validateWitness(matrix, result); assert(result.searchedStates <= stateBudget);
      const levels = [...new Set(matrix.rows.flatMap(row => row.map(([, q]) => q)))].sort((a, b) => a - b);
      if (levels.length > 1) levels.shift();
      for (const [i, target] of result.provenPrefix.entries()) assert.equal(target, result.quality.filter(q => q >= levels[i]).length);
    }
  }
} finally { engine.close(); }
console.log(`Verified ${manifest.cases.length} newly generated QB matrices and bounded witnesses.`);
