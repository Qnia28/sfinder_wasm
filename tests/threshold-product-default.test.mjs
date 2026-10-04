import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';

test('product default B remains independently build-selectable as A or reference', () => {
  const features = readFileSync(new URL('../rust/pc-wasm/Cargo.toml', import.meta.url), 'utf8');
  assert.match(features, /default = \["threshold-current-propagation", "threshold-root-forced"\]/);
  const build = readFileSync(new URL('../scripts/build-wasm.sh', import.meta.url), 'utf8');
  assert.match(build, /SFINDER_THRESHOLD_MODE:-B/);
  assert.match(build, /feature_args=\(--no-default-features\)/);
  assert.match(build, /A\) features="pc-wasm\/threshold-current-propagation"/);
  assert.match(build, /reference\) features=""/);
});

test('product threshold handles forced-prefix budget exits, proof locks and solver reuse', async () => {
  const solver = await createWasmSolver(4, { legal: false });
  const keys = ['000', '001', '002'];
  const rows = [[[0, 2], [0, 2]], [[0, 3]], [[1, 5]], [[0, 7], [1, 1], [2, 3]]];
  const view = createNumericCoverage(keys, new Map(rows.map((r, i) => [i, r])), rows.map((_, caseId) => ({ caseId })));
  const options = { qualityFor: (key, id) => view.qualityIndex.get(id)?.get(key), seedKeys: ['000', '001'] };
  try {
    const exact = solver.minimumCoverAtCount(view.coverage, 2, options);
    assert.equal(exact.completed, true);
    assert.deepEqual(exact.keys, ['000', '001']);
    assert.deepEqual(exact.qualityVector, [2, 3, 5, 7]);
    for (const stateBudget of [0, 1, 2, 5, 20]) {
      const bounded = solver.minimumCoverAtCount(view.coverage, 2, { ...options, stateBudget, proofProgress: true });
      assert(bounded.searchedStates <= Math.max(1, stateBudget));
      assert.deepEqual(bounded.keys, exact.keys);
      assert.deepEqual(bounded.qualityVector, exact.qualityVector);
      assert.deepEqual(solver.minimumCoverAtCount(view.coverage, 2, options), exact);
    }
    const progress = solver.minimumCoverAtCount(view.coverage, 2, { ...options, stateBudget: 1000000, proofProgress: true });
    assert.equal(progress.completed, true);
    const locked = solver.minimumCoverAtCount(view.coverage, 2, { ...options, seedKeys: progress.keys, lockedPrefix: progress.provenPrefix });
    assert.deepEqual(locked.keys, exact.keys);
    assert.deepEqual(locked.qualityVector, exact.qualityVector);
    assert.throws(() => solver.minimumCoverAtCount(view.coverage, 2, { ...options, stateBudget: 1, lockedPrefix: [1] }));
  } finally { solver.close(); }
});
