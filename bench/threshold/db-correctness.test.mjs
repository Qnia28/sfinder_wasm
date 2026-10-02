import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { openEngine, sha256, validateWitness } from './engine.mjs';

// Development inputs only: validation inputs are not searched during screening.
// Small budgets exercise undo/proof without turning this into a timing campaign.
test('frozen cycle1 development rows: all masks return valid bounded witnesses and prefixes', async () => {
  const root = new URL('./cycle1/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
  const build = resolve(process.env.THRESHOLD_BUILD_ROOT || 'bench/threshold/build');
  const original = await openEngine(resolve(build, 'original.wasm'));
  const experiment = await openEngine(resolve(build, 'experiment.wasm'));
  try {
    for (const entry of manifest.cases.filter(c => c.suite === 'development')) {
      const bytes = gunzipSync(readFileSync(new URL(entry.file, root)));
      assert.equal(sha256(bytes), entry.sha256);
      const matrix = JSON.parse(bytes);
      const levels = [...new Set(matrix.rows.flatMap(row => row.map(x => x[1])))].sort((a, b) => a - b);
      if (levels.length > 1) levels.shift();
      const knownTargets = new Map();
      for (const stateBudget of [0, 1, 20]) {
        const baseline = original.solve(matrix, { stateBudget });
        for (let mask = 0; mask < 32; mask++) {
          const result = experiment.solve(matrix, { mask, stateBudget });
          validateWitness(matrix, result);
          assert(result.searchedStates <= stateBudget);
          if ((mask & ~3) === 0) assert.deepEqual(result, baseline, `${entry.id}/${mask} traversal parity`);
          for (const [i, target] of result.provenPrefix.entries()) {
            assert.equal(target, result.quality.filter(q => q >= levels[i]).length);
            if (knownTargets.has(i)) assert.equal(target, knownTargets.get(i), `${entry.id}/${mask} proof mismatch`);
            else knownTargets.set(i, target);
          }
        }
      }
    }
  } finally { original.close(); experiment.close(); }
});
