// Bounded trace results explain work, not wall-clock performance. Timing uses
// fresh, uninstrumented processes in benchmark.mjs, in a later separate step.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFixture } from './fixtures.mjs';
import { openEngine, validateWitness } from './engine.mjs';
const args = process.argv.slice(2);
const option = name => args[args.indexOf(`--${name}`) + 1];
assert(args.includes('--case') && args.includes('--out'));
const { entry, matrix } = loadFixture(option('case'));
const singletons = matrix.rows.filter(row => new Set(row.map(([id]) => id)).size === 1);
const forced = new Set(singletons.map(row => row[0][0]));
const structural = { rows: matrix.rows.length, singletonRows: singletons.length, uniqueForced: forced.size,
  K: matrix.K, coveredOriginalRows: matrix.rows.filter(row => row.some(([id]) => forced.has(id))).length };
const engine = await openEngine(resolve('bench/threshold/build/trace.wasm'));
const results = [];
try {
  assert(engine.traceEnabled && engine.experimentVersion === 2);
  for (const mask of [0, 4, 16, 20, 36, 68, 100, 116]) {
    const result = engine.solve(matrix, { mask, stateBudget: 1000 });
    validateWitness(matrix, result);
    assert(result.searchedStates <= 1000);
    assert.equal(result.diagnostics.singletonRows, structural.singletonRows);
    if (mask & 4) {
      assert.equal(result.diagnostics.uniqueRootForced, forced.size);
      assert.equal(result.diagnostics.rootCoveredOriginalRows, structural.coveredOriginalRows);
    }
    results.push({ mask, ...result });
  }
  // Both refinements preserve traversal, including bounded partial proofs.
  for (const [base, refined] of [[4, 36], [4, 68], [4, 100], [20, 116]]) {
    const a = results.find(r => r.mask === base), b = results.find(r => r.mask === refined);
    for (const key of ['completed', 'selected', 'quality', 'searchedStates', 'provenPrefix']) {
      assert.deepEqual(a[key], b[key], `root refinement traversal changed: ${base}/${refined}/${key}`);
    }
  }
} finally { engine.close(); }
const out = resolve(option('out')); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'root-diagnostics.json'), JSON.stringify({
  caseId: entry.id, inputHash: entry.sha256, traceWasmHash: engine.wasmHash, stateBudget: 1000,
  note: 'Budgeted trace diagnostics are not timing samples or proofs of full completion when completed=false.',
  structural, results,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ caseId: entry.id, structural,
  traces: results.map(r => ({ mask: r.mask, completed: r.completed, states: r.searchedStates,
    dfs: r.diagnostics.dfsEntries, rootOrs: r.diagnostics.rootCoverageWordOrs })) }, null, 2));
