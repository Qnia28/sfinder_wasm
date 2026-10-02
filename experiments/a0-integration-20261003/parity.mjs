// Small semantic checks only; prior exhaustive A0 effect evidence is reused.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, write } from './common.mjs';
const roots = [path.join(ROOT, '.a0/original'), path.join(ROOT, '.a0/baseline'), ROOT];
const solvers = [], packers = [], ledger = [];
try {
  for (const root of roots) {
    const { createWasmSolver } = await import(pathToFileURL(path.join(root, 'src/wasm-backend.mjs')));
    const { createNumericCoverage } = await import(pathToFileURL(path.join(root, 'src/numeric-cover-data.mjs')));
    solvers.push(await createWasmSolver(4, { legal: false })); packers.push(createNumericCoverage);
  }
  const fixtures = [
    { keys: ['000', '001', '002'], rows: [[[0, 1], [1, 1]], [[1, 1], [2, 1]], [[0, 1], [2, 1]], [[0, 1], [1, 1]]], K: 2, seed: ['000', '002'] },
    { keys: ['000', '001', '002'], rows: [[[0, 9], [1, 3], [2, 1]], [[0, 8], [1, 2], [2, 1]], [[0, 8], [1, 2], [2, 1]]], K: 1, seed: ['002'] },
    { keys: Array.from({ length: 65 }, (_, i) => String(i).padStart(3, '0')), rows: [Array.from({ length: 65 }, (_, i) => [i, 1])], K: 1, seed: ['064'] },
  ];
  let calls = 0;
  for (let f = 0; f < fixtures.length; f++) for (const budget of [1, 16, 100000]) {
    const m = fixtures[f], results = [];
    for (let i = 0; i < 3; i++) {
      const { coverage } = packers[i](m.keys, new Map(m.rows.map((r, caseId) => [caseId, r])), m.rows.map((_, caseId) => ({ caseId })));
      const result = solvers[i].minimumCoverAtCount(coverage, m.K, { qualityFor: () => { throw Error('numeric-only'); }, seedKeys: m.seed, stateBudget: budget, integrated: true, partitioned: i === 2 });
      results.push(result); ledger.push({ fixture: f, budget, condition: ['O', 'R', 'A'][i], result }); calls++;
    }
    assert.deepEqual(results[0], results[1], 'Rebuilt source altered original unpartitioned semantics');
    for (const r of results) if (r.completed) {
      assert.equal(r.count, m.K); assert.equal(r.qualityVector.length, m.rows.length);
      if (f === 1) assert.deepEqual(r.keys, ['000']);
      if (f === 2) assert.deepEqual(r.keys, ['000']);
    }
    if (results.every(r => r.completed)) { assert.deepEqual(results[2].keys, results[1].keys); assert.deepEqual(results[2].qualityVector, results[1].qualityVector); }
  }
  write(path.join(ROOT, '.a0/build/PARITY.json'), { status: 'PASS', fixtures: fixtures.length, calls, nativeEffectCampaignRepeated: false, ledger });
  console.log(JSON.stringify({ status: 'PASS', smallSemanticCalls: calls, sourceRebuildParity: true }));
} finally { for (const solver of solvers) solver.close(); }
