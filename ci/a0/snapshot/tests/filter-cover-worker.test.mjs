import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { createNumericCoverage, numericPacked } from '../src/numeric-cover-data.mjs';
import { packFilterTask, restoreFilterTask } from '../src/filter-cover-task.mjs';
import { FilterCoverPool } from '../src/filter-cover-pool.mjs';
import { minimumCoverAdaptiveAsync } from '../src/min-cover-adaptive.mjs';
import { exactMinimumCover } from '../src/min-cover.mjs';
import { isORToolsSupported, solveORToolsCardinalityKernel } from '../src/ortools-min-cover.mjs';
import { calculatePerSaveMinimalsFromBoardAsync } from '../src/per-save-minimals-core.mjs';

function matrix() {
  const rows = [[[0, 1], [1, 2]], [[0, 1], [1, 2]], [[1, 3], [2, 1]], [[0, 4], [2, 2]], [[0, 1], [1, 3], [2, 4]]];
  const view = createNumericCoverage(['a', 'b', 'c'], new Map(rows.map((row, i) => [i, row])), rows.map((_, i) => ({ caseId: `q${i}` })));
  return { ...view, qualityFor: (key, id) => view.qualityIndex.get(id)?.get(key) };
}
test('whole-filter transport keeps cardinality rows, duplicate weights, quality callbacks and owner buffers', () => {
  const m = matrix(), original = numericPacked(m.prepared.rawCases);
  const payload = packFilterTask(m.coverage, m.qualityFor, { primary: 'Rust', tinyExactMaxCandidates: 0 });
  const wire = structuredClone(payload, { transfer: [payload.offsets.buffer, payload.ids.buffer, payload.qualities.buffer] });
  const restored = restoreFilterTask(wire);
  assert.equal(original.qualities.length, 11); assert.equal(payload.ids.byteLength, 0);
  assert.deepEqual(restored.prepared.primaryCases, [[0, 1], [0, 1], [1, 2], [0, 2], [0, 1, 2]]);
  assert.equal(restored.qualityFor('b', 'q1'), 2);
  const exact = exactMinimumCover(restored.coverage, { qualityFor: restored.qualityFor });
  assert.equal(exact.count, 2); assert.deepEqual(exact.keys, ['a', 'b']);
  assert.deepEqual(exact.qualityVector, [2, 2, 3, 3, 4]);
  assert.throws(() => restoreFilterTask({ ...wire, offsets: new Uint32Array([0, 99]) }), /payload|offsets/);
});

test('real worker proves K and weighted quality for Rust/HiGHS/Auto, exact/fast and cardinality-only', async () => {
  const solver = await createWasmSolver(4, { legal: false }), m = matrix(), pool = new FilterCoverPool();
  try {
    const modes = ['rust', 'highs', 'auto', ...(isORToolsSupported() ? ['ortools'] : [])];
    for (const primary of modes) for (const exactQuality of ['true', 'fast']) {
      const options = { primary, exactQuality, tinyExactMaxCandidates: 0 };
      const expected = await minimumCoverAdaptiveAsync(m.coverage, { ...options, solver, qualityFor: m.qualityFor });
      const actual = await pool.submit(m.coverage, m.qualityFor, options);
      assert.deepEqual(actual, expected); assert.equal(actual.count, 2);
    }
    const expected = await minimumCoverAdaptiveAsync(m.coverage, { solver, qualityFor: null, primary: 'rust' });
    assert.deepEqual(await pool.submit(m.coverage, null, { primary: 'rust' }), expected);
    assert.equal(pool.slots.length, 2); assert(pool.metrics.every(m => m.transferBytes > 0 && m.wasmMemoryBytes > 0));
  } finally { await pool.dispose(); solver.close(); }
});

test('worker reuse resolves by job ID and never detaches queued source data', async () => {
  const m = matrix(), pool = new FilterCoverPool(), original = numericPacked(m.prepared.rawCases);
  const saved = [...original.ids];
  try {
    const values = await Promise.all(Array.from({ length: 7 }, (_, i) =>
      pool.submit(m.coverage, i % 2 ? null : m.qualityFor, { primary: 'rust', tinyExactMaxCandidates: 0 })));
    assert(values.every(v => v.count === 2));
    assert.deepEqual(values.map(v => v.qualityVector.length), [5, 0, 5, 0, 5, 0, 5]);
    assert.deepEqual([...original.ids], saved);
  } finally { await pool.dispose(); }
});

test('abort before startup and during active work rejects all jobs and joins teardown', async () => {
  const m = matrix(), before = new AbortController(); before.abort(new Error('cancel-before'));
  const unused = new FilterCoverPool({ signal: before.signal });
  assert.throws(() => unused.submit(m.coverage, m.qualityFor), /cancel-before/); await unused.dispose();
  const controller = new AbortController(), pool = new FilterCoverPool({ signal: controller.signal });
  const jobs = Array.from({ length: 7 }, () => pool.submit(m.coverage, m.qualityFor, { primary: 'highs', tinyExactMaxCandidates: 0 }));
  while (!pool.slots.some(s => s.active)) await new Promise(resolve => setImmediate(resolve));
  controller.abort(new Error('cancel-active'));
  const outcomes = await Promise.allSettled(jobs); await pool.dispose();
  assert(outcomes.every(r => r.status === 'rejected')); assert.equal(pool.disposed, true);
  assert.equal(pool.queue.length, 0); assert(pool.slots.every(s => !s.active));
});

test('bad worker job rejects both active and queued work without retry', async () => {
  const m = matrix(), pool = new FilterCoverPool();
  const jobs = [pool.submit(m.coverage, m.qualityFor, { exactQuality: 'invalid' }),
    pool.submit(m.coverage, m.qualityFor, { exactQuality: 'invalid' }),
    pool.submit(m.coverage, m.qualityFor)];
  const outcomes = await Promise.allSettled(jobs); await pool.dispose();
  assert(outcomes.every(r => r.status === 'rejected')); assert(pool.error);
});

test('ORTools primary abort terminates its nested worker before rejecting', { skip: !isORToolsSupported() }, async () => {
  const controller = new AbortController();
  const kernel = { forced: [], cases: [[0, 1], [1, 2], [0, 2]], solutionIds: [0, 1, 2], entryCount: 6 };
  const pending = solveORToolsCardinalityKernel(kernel, { signal: controller.signal });
  setTimeout(() => controller.abort(new Error('cancel-nested')), 10);
  await assert.rejects(pending, /cancel-nested/);
});

test('per-save compact/numeric/general paths preserve complete output, display order and tiny/direct results', async () => {
  const solver = await createWasmSolver(4);
  const board = [0n, 10n, 20n, 30n].reduce((value, shift) => value | (255n << shift), 0n);
  const queues = Array.from({ length: 64 }, (_, i) => ['OOI', 'OOO', 'OOT', 'IIO', 'IIT'][i % 5]);
  const compact = solver.enumeratePcPatternCompact, pattern = solver.enumeratePcPattern;
  try {
    for (const route of ['compact', 'numeric', 'general']) {
      if (route !== 'compact') solver.enumeratePcPatternCompact = () => null;
      if (route === 'general') solver.enumeratePcPattern = undefined;
      const input = { board, queues, solver, primary: 'rust', tinyExactMaxCandidates: 0,
        secondaryWorkers: 0, displayOrder: ['T', 'I', 'O', 'J', 'L', 'S', 'Z'] };
      const expected = await calculatePerSaveMinimalsFromBoardAsync(input);
      // Invalid secondary size would reject if the old secondary pool were also created.
      const actual = await calculatePerSaveMinimalsFromBoardAsync({ ...input, filterWorkers: 2, secondaryWorkers: 99 });
      assert.deepEqual(actual, expected, route); assert.equal(actual.total, 64);
      assert.deepEqual(Object.keys(actual.results), input.displayOrder);
    }
    solver.enumeratePcPatternCompact = compact; solver.enumeratePcPattern = pattern;
    for (const sample of [queues, ['OOI']]) {
      const input = { board, queues: sample, solver, secondaryWorkers: 0 };
      assert.deepEqual(await calculatePerSaveMinimalsFromBoardAsync({ ...input, filterWorkers: 2 }),
        await calculatePerSaveMinimalsFromBoardAsync(input));
    }
    await assert.rejects(calculatePerSaveMinimalsFromBoardAsync({ board, queues, solver, filterWorkers: 4 }), /0 or 2/);
  } finally { solver.close(); }
});
