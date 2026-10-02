import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createNumericCoverage, numericPacked } from '../src/numeric-cover-data.mjs';
import { createWasmSolver, WasmPcSolver } from '../src/wasm-backend.mjs';
import { solveExactSecondary } from '../src/min-cover-exact-secondary.mjs';
import { solveExactSecondaryAsync, SECONDARY_CP_DELAY_MS } from '../src/min-cover-three-engine.mjs';
import { minimumCoverAdaptiveAsync } from '../src/min-cover-adaptive.mjs';
import { ExactSecondaryPool, compiledCoverModule } from '../src/exact-secondary-pool.mjs';

function matrix() {
  const rows = [[[0, 1], [1, 1]], [[1, 1], [2, 1]], [[0, 1], [2, 1]], [[0, 1], [1, 1]]];
  const view = createNumericCoverage(['000', '001', '002'], new Map(rows.map((row, i) => [i, row])), rows.map((_, caseId) => ({ caseId })));
  return { ...view, qualityFor: (key, caseId) => view.qualityIndex.get(caseId).get(key) };
}
const context = { primary: { count: 2, backend: 'rust' }, primaryKeys: ['000', '002'], primaryHard: false,
  requestedPrimary: 'rust', requested: false, kernelStats: { cases: 3, solutions: 3, entries: 6 } };
const done = { count: 2, keys: ['000', '001'], qualityVector: [1, 1, 1, 1], completed: true, searchedStates: 7 };

test('A0 is selected only for the ordinary 100K exact probe and completes without threshold', () => {
  const m = matrix(), calls = [];
  const solver = { minimumCoverAtCount(coverage, count, options) { calls.push(options); return done; } };
  const result = solveExactSecondary(m.coverage, { ...context, solver, qualityFor: m.qualityFor });
  assert.equal(calls.length, 1); assert.equal(calls[0].partitioned, true);
  assert.equal(calls[0].integrated, true); assert.equal(calls[0].stateBudget, 100000);
  assert.equal(calls[0].dominance, undefined); assert.deepEqual(calls[0].seedKeys, context.primaryKeys);
  assert.equal(result.qualityDecision, 'integrated-exact');
});
test('capped A0 transfers its incumbent once, keeping threshold options and state accounting', () => {
  const m = matrix(), calls = [], probe = { ...done, completed: false, searchedStates: 100000 };
  const solver = { minimumCoverAtCount(coverage, count, options) { calls.push(options); return options.integrated ? probe : done; } };
  const result = solveExactSecondary(m.coverage, { ...context, solver, qualityFor: m.qualityFor });
  assert.equal(calls.length, 2); assert.equal(calls[0].partitioned, true);
  assert.equal(calls[1].partitioned, undefined); assert.equal(calls[1].integrated, undefined);
  assert.deepEqual(calls[1].seedKeys, probe.keys); assert.deepEqual(calls[1].lockedPrefix, []);
  assert.equal(result.qualitySearchedStates, 100007); assert.equal(result.qualityDecision, 'integrated-budget-to-threshold');
});
test('transferred old probes are never rerun or relabeled as new A0 proofs', () => {
  const m = matrix(), calls = [], probe = { ...done, completed: false, searchedStates: 123 };
  const result = solveExactSecondary(m.coverage, { ...context, qualityFor: m.qualityFor, integratedProbe: probe,
    solver: { minimumCoverAtCount(coverage, count, options) { calls.push(options); return done; } } });
  assert.equal(calls.length, 1); assert.equal(calls[0].integrated, undefined); assert.equal(calls[0].partitioned, undefined);
  assert.equal(result.qualitySearchedStates, 130);
});
test('primaryHard goes directly to unchanged threshold and trivial invokes no solver', () => {
  const m = matrix(), calls = [];
  solveExactSecondary(m.coverage, { ...context, primaryHard: true, qualityFor: m.qualityFor,
    solver: { minimumCoverAtCount(coverage, count, options) { calls.push(options); return done; } } });
  assert.equal(calls.length, 1); assert.equal(calls[0].integrated, undefined); assert.equal(calls[0].partitioned, undefined);
  const t = createNumericCoverage(['000'], new Map([[0, [[0, 2]]]]), [{ caseId: 0 }]);
  const result = solveExactSecondary(t.coverage, { ...context, primary: { count: 1, backend: 'kernel' }, primaryKeys: ['000'],
    qualityFor: () => 2, solver: { minimumCoverAtCount() { throw Error('trivial called solver'); } } });
  assert.equal(result.qualityDecision, 'trivial-exact');
});
test('decomposition on does not select the new partition option', () => {
  const m = matrix(), calls = [];
  solveExactSecondary(m.coverage, { ...context, decomposition: 'on', qualityFor: m.qualityFor,
    solver: { minimumCoverAtCount(coverage, count, options) { calls.push(options); return done; } } });
  assert(calls.length > 0); assert(calls.every(c => !c.partitioned));
});
test('missing partition export fails explicitly rather than silently running baseline', async () => {
  const solver = await createWasmSolver(4, { legal: false }), m = matrix();
  try {
    assert.equal(typeof solver.e.solver_min_cover_at_count_integrated_partitioned_bounded, 'function');
    const exports = { ...solver.e }; delete exports.solver_min_cover_at_count_integrated_partitioned_bounded;
    solver.e = exports;
    assert.throws(() => solveExactSecondary(m.coverage, { ...context, solver, qualityFor: m.qualityFor }), /partitioned integrated export/);
  } finally { solver.close(); }
});
test('low-level default and explicit integrated remain unpartitioned', async () => {
  const m = matrix(), solver = await createWasmSolver(4, { legal: false }), calls = [];
  const original = solver.minimumCoverAtCount;
  solver.minimumCoverAtCount = function(coverage, count, options) { calls.push(options); return original.call(this, coverage, count, options); };
  try {
    const direct = solver.minimumCoverAtCount(m.coverage, 2, { qualityFor: m.qualityFor, seedKeys: context.primaryKeys, integrated: true, stateBudget: 100000 });
    assert.equal(calls[0].partitioned, undefined); assert.equal(direct.completed, true);
    calls.length = 0;
    const result = await solveExactSecondaryAsync(m.coverage, { ...context, secondary: 'integrated', solver, qualityFor: m.qualityFor });
    assert.equal(calls[0].partitioned, undefined); assert.deepEqual(result.keys, done.keys);
    assert.equal(SECONDARY_CP_DELAY_MS, 60000);
  } finally { solver.close(); }
});
test('tiny adaptive early return and Fast calls do not acquire A0 flags', async () => {
  const m = matrix(), solver = await createWasmSolver(4, { legal: false }), calls = [], original = solver.minimumCoverAtCount;
  solver.minimumCoverAtCount = function(coverage, count, options) { calls.push(options); return original.call(this, coverage, count, options); };
  try {
    const tiny = await minimumCoverAdaptiveAsync(m.coverage, { solver, qualityFor: m.qualityFor, exactQuality: 'true' });
    assert.equal(tiny.qualityDecision, 'tiny-legacy-exact'); assert.equal(calls.length, 0);
    await minimumCoverAdaptiveAsync(m.coverage, { solver, qualityFor: m.qualityFor, exactQuality: 'fast', primary: 'rust', tinyExactMaxCandidates: 0 });
    assert(calls.length > 0); assert(calls.every(c => !c.partitioned));
  } finally { solver.close(); }
});
test('ordinary A0 survives full pool dispatch, weighted duplicate rows and buffer ownership', async () => {
  const m = matrix(), solver = await createWasmSolver(4, { legal: false }), pool = new ExactSecondaryPool(1);
  const saved = Array.from(numericPacked(m.prepared.rawCases).qualities);
  try {
    const expected = solveExactSecondary(m.coverage, { ...context, solver, qualityFor: m.qualityFor });
    const actual = await pool.submit(m.prepared, context).secondaryPending;
    assert.deepEqual(actual, expected); assert.deepEqual(Array.from(numericPacked(m.prepared.rawCases).qualities), saved);
    const module = await compiledCoverModule();
    assert(WebAssembly.Module.exports(module).some(e => e.name === 'solver_min_cover_at_count_integrated_partitioned_bounded'));
  } finally { await pool.dispose(); solver.close(); }
  assert.equal(pool.disposed, true);
});
test('deferred capped A0 probe is not repeated in the secondary worker', async () => {
  const m = matrix(), solver = await createWasmSolver(4, { legal: false }), pool = new ExactSecondaryPool(1);
  let probes = 0;
  const original = solver.minimumCoverAtCount;
  solver.minimumCoverAtCount = function(coverage, count, options) {
    const r = original.call(this, coverage, count, options);
    if (options.integrated) { probes++; assert.equal(options.partitioned, true); return { ...r, completed: false }; }
    return r;
  };
  try {
    const deferred = solveExactSecondary(m.coverage, { ...context, solver, qualityFor: m.qualityFor, deferThreshold: ctx => pool.submit(m.prepared, ctx) });
    const result = await deferred.secondaryPending;
    assert.equal(probes, 1); assert.deepEqual(result.keys, done.keys); assert.equal(result.qualityExact, true);
  } finally { await pool.dispose(); solver.close(); }
});
