import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openEngine, oracle, validateWitness } from './engine.mjs';
import { settings } from './profiles.mjs';
const root = resolve(process.env.THRESHOLD_BUILD_ROOT || 'bench/threshold/build');
test('frozen screening runs all100, six serial pairs per repeat, with enough diagnostic/job time', () => {
  const r = spawnSync(process.execPath, ['bench/threshold/workflow-plan.mjs'], { encoding: 'utf8',
    env: { ...process.env, THRESHOLD_RUN_CONFIG: 'bench/threshold/root-screen-run.json', GITHUB_EVENT_NAME: '' } });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  assert.equal(p.matrix.case.length, 100); assert.equal(p.pairs, 1); assert.equal(p.seconds, 300);
  assert.equal(p.maxParallel, 16); assert.equal(p.jobMinutes, 80);
});
test('root comparisons preserve baseline16 and independently ablate two refinements', () => {
  assert.deepEqual(settings('root-screen', 4).map(p => [p.left.mask, p.right.mask]),
    [[0, 4], [16, 20], [4, 36], [4, 68], [4, 100], [16, 116]]);
  assert.deepEqual(settings('root-confirm', 100).map(p => [p.left.mask, p.right.mask]), [[16, 116]]);
  assert.throws(() => settings('root-confirm', 16));
});
test('real WASM root refinements preserve traversal, bounded proofs, oracle and locked tie', async () => {
  const engine = await openEngine(resolve(root, 'experiment.wasm'));
  const trace = await openEngine(resolve(root, 'trace.wasm'));
  let state = 0xade21903;
  const next = () => state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const fixtures = [
    { keys: ['000', '001'], rows: [[[0, 1], [1, 9]], [[0, 9], [1, 1]]] }, // no forced
    { keys: ['000', '001', '002'], rows: [[[0, 1]], [[1, 9]], [[1, 1], [2, 9]]] }, // all forced
    { keys: ['000', '001', '002'], rows: [[[2, 1], [2, 9]], [[2, 3]], [[0, 9], [2, 1]]] },
  ];
  for (let sample = 0; sample < 256; sample++) {
    const n = 3 + next() % 6, rows = [];
    for (let r = 0, length = 2 + next() % 12; r < length; r++) {
      const row = [];
      for (let id = 0; id < n; id++) if (next() % 3 !== 0) row.push([id, [1, 3, 9, 0xffffffff][next() % 4]]);
      if (!row.length) row.push([next() % n, 1]);
      if (r % 3 === 0) row.push(row[0]);
      rows.push(row);
    }
    fixtures.push({ keys: Array.from({ length: n }, (_, i) => String(i).padStart(3, '0')), rows });
  }
  try {
    assert.equal(engine.experimentVersion, 2);
    for (const mask of [36, 52, 68, 84, 100, 116]) {
      const empty = engine.solve({ keys: [], rows: [], K: 0, seed: [] }, { mask, stateBudget: 0 });
      assert(empty.completed); assert.deepEqual(empty.selected, []);
      const zero = engine.solve({ keys: ['000', '001'], rows: [[[0, 0]], [[0, 0], [1, 0]]], K: 1, seed: [0] },
        { mask, allowZero: true });
      assert(zero.completed); assert.deepEqual(zero.selected, [0]); assert.deepEqual(zero.quality, [0, 0]);
    }
    for (const raw of fixtures) {
      const expected = oracle(raw), matrix = { ...raw, K: expected.K, seed: expected.seed };
      const levels = [...new Set(raw.rows.flatMap(row => row.map(([, q]) => q)))].sort((a, b) => a - b);
      if (levels.length > 1) levels.shift();
      const targets = levels.map(t => expected.quality.filter(q => q >= t).length);
      for (const base of [4, 20]) for (const stateBudget of [0, 1, 2, 5, 100, null]) {
        const reference = engine.solve(matrix, { mask: base, stateBudget });
        for (const extra of [32, 64, 96]) {
          const result = engine.solve(matrix, { mask: base | extra, stateBudget });
          assert.deepEqual(result, reference);
          validateWitness(matrix, result);
          if (result.completed) assert.deepEqual(result.selected, expected.selected);
        }
      }
      for (const mask of [36, 52, 68, 84, 100, 116]) {
        for (const length of new Set([1, targets.length])) {
          const result = engine.solve({ ...matrix, seed: expected.selected }, { mask, lockedPrefix: targets.slice(0, length) });
          assert(result.completed); assert.deepEqual(result.selected, expected.selected);
          assert.deepEqual(result.provenPrefix, targets);
        }
        const result = trace.solve(matrix, { mask });
        assert.deepEqual(result.selected, expected.selected);
        if (mask & 32) assert.equal(result.diagnostics.rootCollectionRows, 0);
        if (mask & 64) assert.equal(result.diagnostics.rootCoverageWordOrs, 0);
      }
    }
    for (const mask of [32, 64, 96, 128]) assert.throws(() => engine.solve(
      { keys: ['000'], rows: [[[0, 1]]], K: 1, seed: [0] }, { mask }));
  } finally { engine.close(); trace.close(); }
});
