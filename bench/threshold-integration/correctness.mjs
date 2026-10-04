import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openEngine, oracle, validateWitness, selectedQuality } from './engine.mjs';
import { manifest, loadFixture } from './fixtures.mjs';
const buildRoot = 'bench/threshold-integration/build';
const engines = Object.fromEntries(await Promise.all(['S', 'D', 'C', 'A', 'B', 'reference'].map(async mode => [mode, await openEngine(`${buildRoot}/${mode}.wasm`)])));
const summary = { matrices: 0, synthetic: 0, currentActivation: 0, rootActivation: 0, checks: 0, productAbi: true };
const modes = ['S', 'D', 'C', 'A', 'B'];
function check(matrix, budget = null, locks = []) {
  const out = Object.fromEntries(modes.map(mode => [mode, engines[mode].solve(matrix, { stateBudget: budget, lockedPrefix: locks, allowZero: true })]));
  assert.deepEqual(out.C, out.D, 'inactive product control differs from Dev result/states/progress');
  for (const key of ['completed', 'count', 'selected', 'quality', 'searchedStates']) assert.deepEqual(out.S[key], out.D[key], `tracked Dev asset disagrees with rebuilt Dev/${key}`);
  for (const mode of modes) { validateWitness(matrix, out[mode]); if (budget !== null) assert(out[mode].searchedStates <= budget); }
  for (const [mode, mask] of [['A', 16], ['B', 20]]) {
    const ref = engines.reference.solve(matrix, { mask, stateBudget: budget, lockedPrefix: locks, allowZero: true });
    for (const key of ['completed', 'count', 'selected', 'quality', 'searchedStates']) assert.deepEqual(out[mode][key], ref[key], `${mode} disagrees with experimental mask${mask}/${key}`);
    if (budget !== null) assert.deepEqual(out[mode].provenPrefix, ref.provenPrefix);
  }
  summary.currentActivation += out.A.searchedStates !== out.C.searchedStates ? 1 : 0;
  summary.rootActivation += out.B.searchedStates !== out.A.searchedStates ? 1 : 0;
  const levels = [...new Set(matrix.rows.flatMap(row => row.map(([, q]) => q)))].sort((a, b) => a - b);
  if (levels.length > 1) levels.shift();
  for (const mode of modes) for (const [i, target] of (out[mode].provenPrefix || []).entries()) assert.equal(target, out[mode].quality.filter(q => q >= levels[i]).length);
  if (budget === null) for (const mode of modes) assert.equal(validateWitness(matrix, out[mode]), validateWitness(matrix, out.D));
  summary.checks += modes.length + 2;
  return out;
}
try {
  for (const mode of modes) { assert.equal(engines[mode].experimental, false); assert.equal(engines[mode].traceEnabled, false); }
  let state = 20261004; const next = () => state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  for (let f = 0; f < 60; f++) {
    const n = 3 + next() % 5, keys = Array.from({ length: n }, (_, i) => String(i).padStart(3, '0'));
    const rows = Array.from({ length: 3 + next() % 8 }, () => {
      const r = Array.from({ length: n }, (_, id) => [id, next() % 8]).filter(() => next() % 3 !== 0);
      return r.length ? r : [[next() % n, next() % 8]];
    });
    if (f % 3 === 0) rows.push(rows[0]);
    const expected = oracle({ keys, rows }); const matrix = { keys, rows, K: expected.K, seed: expected.seed };
    for (const budget of [1, 2, 5, 20, null]) {
      const out = check(matrix, budget); if (budget === null) for (const mode of modes) {
        assert.deepEqual(out[mode].selected, expected.selected); assert.deepEqual(out[mode].quality, expected.quality);
      }
      const levels = [...new Set(rows.flatMap(r => r.map(([, q]) => q)))].sort((a, b) => a - b); if (levels.length > 1) levels.shift();
      for (const mode of modes) for (const [i, target] of (out[mode].provenPrefix || []).entries()) assert.equal(target, expected.quality.filter(q => q >= levels[i]).length);
    }
    const best = { ...matrix, seed: expected.selected };
    const levels = [...new Set(rows.flatMap(r => r.map(([, q]) => q)))].sort((a, b) => a - b); if (levels.length > 1) levels.shift();
    const locks = levels.map(level => expected.quality.filter(q => q >= level).length);
    check(best, null, locks.slice(0, 1)); check(best, null, locks);
    summary.synthetic++;
    if (summary.synthetic % 20 === 0) console.log(`Synthetic oracle: ${summary.synthetic}/60`);
  }
  // Real200 inputs: bounded normalization/quality/undo proof; QB inputs also
  // complete, while long cycle1 inputs are not silently given unlimited time.
  for (const entry of manifest.cases) {
    const { matrix } = loadFixture(entry.id); check(matrix, 1); check(matrix, 20);
    if (entry.cohort === 'qb') check(matrix);
    summary.matrices++;
    if (summary.matrices % 20 === 0) console.log(`Preserved real matrices: ${summary.matrices}/200 (${entry.id})`);
  }
  assert(summary.currentActivation > 0, 'current feature never changes traversal on activation fixtures');
  assert(summary.rootActivation > 0, 'root feature never changes traversal on activation fixtures');
  for (const mode of modes) {
    const engine = engines[mode], e = engine.exports;
    // Invalid progress call resets prefix, then the same solver is reusable.
    if (e.solver_min_cover_at_count_progress_bounded) {
      assert.equal(e.solver_min_cover_at_count_progress_bounded(engine.pointer, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1) >>> 0, 0xffffffff);
      assert.equal(e.solver_min_cover_proven_prefix_len(engine.pointer), 0);
    } else assert.equal(mode, 'S', 'new product candidate unexpectedly lacks progress exports');
    const { matrix } = loadFixture('c7-2plus2-qb-row-039-O');
    assert.deepEqual(engine.solve(matrix).quality, selectedQuality(matrix, engine.solve(matrix).selected));
  }
} finally { for (const e of Object.values(engines)) e.close(); }
mkdirSync('bench/threshold-integration/results/correctness', { recursive: true });
writeFileSync('bench/threshold-integration/results/correctness/abi.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
