import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveCardinalityKernel,
  refineMinimumCoverQuality,
  minimumCoverAsync,
  normalizeUseHiGHS,
  resolveUseHiGHS,
  prepareCoverageMatrix,
  isHardMinimumCover,
  isHardPrimaryKernel,
  primaryKernelStats,
  normalizeExactHumanQuality,
  kernelizeCardinality,
} from '../src/highs-min-cover.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

test('HiGHS cardinality backend solves an exact binary set-cover model', async () => {
  const rows = [
    [0, 2],
    [0, 1],
    [1, 2],
  ];
  const result = await solveCardinalityKernel(rows, 3);
  assert.equal(result.count, 2);
  const selected = new Set(result.selected);
  for (const row of rows) assert.ok(row.some((id) => selected.has(id)));
});


test('Rust/WASM primary kernelization matches JavaScript exact reductions', async () => {
  const solver = await createWasmSolver(4);
  try {
    const rows = [
      [0, 1, 2],
      [0, 1],
      [1, 2, 3],
      [3],
      [0, 1],
      [2, 4],
      [2, 4, 5],
    ];
    const js = kernelizeCardinality(rows, 6);
    const rust = solver.primaryKernelize(rows, 6);
    assert.deepEqual(rust.cases, js.cases);
    assert.deepEqual(rust.solutionIds, js.solutionIds);
    assert.deepEqual(rust.forced, js.forced);
    assert.equal(rust.entryCount, js.cases.reduce((sum, row) => sum + row.length, 0));
  } finally { solver.close(); }
});

test('hard-cover quality refinement preserves coverage/cardinality and improves lexicographic quality', () => {
  const prepared = {
    keys: ['a', 'b', 'c', 'd'],
    maxQuality: 4,
    cases: [
      [[0, 1], [2, 4]],
      [[0, 4], [3, 4]],
      [[1, 1], [2, 4]],
      [[1, 4], [3, 4]],
    ],
  };
  const initial = [0, 1];
  const refined = refineMinimumCoverQuality(prepared, initial);
  assert.equal(refined.selected.length, 2);
  assert.deepEqual(refined.selected, [2, 3]);
  assert.deepEqual(refined.qualityVector, [4, 4, 4, 4]);
});


test('2x2 coverage membership remains independent from zero quality in synthetic prepared data', () => {
  const prepared = {
    keys: ['A', 'B', 'C'],
    maxQuality: 3,
    cases: [
      [[0, 2], [2, 3]],
      [[1, 0]],
    ],
  };
  const refined = refineMinimumCoverQuality(prepared, [0, 1]);
  assert.equal(refined.selected.length, 2);
  const selected = new Set(refined.selected);
  for (const row of prepared.cases) {
    assert.ok(row.some(([id]) => selected.has(id)), `uncovered row: ${JSON.stringify(row)}`);
  }
});

test('2x2 accepts a zero-quality replacement as a real coverage edge', () => {
  const prepared = {
    keys: ['A', 'B', 'C', 'D'],
    maxQuality: 1,
    cases: [
      [[0, 1], [2, 1]],
      [[1, 0], [3, 0]],
    ],
  };
  const refined = refineMinimumCoverQuality(prepared, [2, 3]);
  assert.deepEqual(refined.selected, [0, 1]);
  assert.deepEqual(refined.qualityVector, [0, 1]);
});


test('2x2 preserves coverage and reported quality on zero-inclusive randomized matrices', () => {
  let state = 0x6d2b79f5;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const choose = (n) => next() % n;
  const combinations = (n, k) => {
    const out = [];
    const row = [];
    const visit = (start) => {
      if (row.length === k) { out.push([...row]); return; }
      for (let id = start; id < n; id += 1) {
        row.push(id); visit(id + 1); row.pop();
      }
    };
    visit(0);
    return out;
  };
  const covered = (cases, selected) => {
    const chosen = new Set(selected);
    return cases.every((row) => row.some(([id]) => chosen.has(id)));
  };
  const actualQuality = (cases, selected) => {
    const chosen = new Set(selected);
    return cases.map((row) => {
      let best = 0;
      for (const [id, quality] of row) if (chosen.has(id) && quality > best) best = quality;
      return best;
    }).sort((a, b) => a - b);
  };

  let checked = 0;
  for (let attempt = 0; attempt < 20000 && checked < 3000; attempt += 1) {
    const solutionCount = 4 + choose(5);
    const caseCount = 2 + choose(7);
    const exactCount = 2 + choose(Math.min(3, solutionCount - 1));
    const cases = [];
    let maxQuality = 0;
    for (let ci = 0; ci < caseCount; ci += 1) {
      const row = [];
      for (let id = 0; id < solutionCount; id += 1) {
        if (choose(100) < 45) {
          const quality = choose(5); // zero is deliberately a valid synthetic quality.
          row.push([id, quality]);
          maxQuality = Math.max(maxQuality, quality);
        }
      }
      if (!row.length) {
        const quality = choose(5);
        row.push([choose(solutionCount), quality]);
        maxQuality = Math.max(maxQuality, quality);
      }
      cases.push(row);
    }
    const validInitial = combinations(solutionCount, exactCount).filter((selected) => covered(cases, selected));
    if (!validInitial.length) continue;
    const initial = validInitial[choose(validInitial.length)];
    const refined = refineMinimumCoverQuality({
      keys: Array.from({ length: solutionCount }, (_, id) => `S${id}`),
      maxQuality,
      cases,
    }, initial, { maxPasses: 4 });
    assert.equal(refined.selected.length, exactCount);
    assert.ok(covered(cases, refined.selected));
    assert.deepEqual(refined.qualityVector, actualQuality(cases, refined.selected));
    checked += 1;
  }
  assert.equal(checked, 3000);
});

test('prepared production quality rejects zero, missing, non-finite, and non-integer covered quality', () => {
  const coverage = new Map([['A', new Set(['X'])]]);
  assert.throws(() => prepareCoverageMatrix(coverage, () => 0), /human quality must be an integer number in 1/);
  assert.throws(() => prepareCoverageMatrix(coverage, () => undefined), /human quality must be an integer number in 1/);
  assert.throws(() => prepareCoverageMatrix(coverage, () => NaN), /human quality must be an integer number in 1/);
  assert.throws(() => prepareCoverageMatrix(coverage, () => 1.5), /human quality must be an integer number in 1/);
  assert.equal(prepareCoverageMatrix(coverage, () => 1).cases[0][0][1], 1);
});

test('UseHiGHS accepts True/False/Auto and Auto uses exact primary-kernel hardness', () => {
  assert.equal(normalizeUseHiGHS(true), true);
  assert.equal(normalizeUseHiGHS(false), false);
  assert.equal(normalizeUseHiGHS('True'), true);
  assert.equal(normalizeUseHiGHS('False'), false);
  assert.equal(normalizeUseHiGHS('Auto'), 'auto');

  const fakeKernel = (caseCount, solutionCount, entryCount) => {
    const cases = Array.from({ length: caseCount }, () => []);
    for (let i = 0; i < entryCount; i += 1) cases[i % caseCount]?.push(i % solutionCount);
    return {
      cases,
      solutionIds: Array.from({ length: solutionCount }, (_, i) => i),
      forced: [],
    };
  };
  const dummy = { cases: [], keys: [], entryCount: 0 };

  // Primary-only measurements: these representative kernels finish quickly in Rust.
  assert.equal(isHardPrimaryKernel(fakeKernel(10, 8, 20)), false);      // pcinfo-019 full
  assert.equal(isHardPrimaryKernel(fakeKernel(232, 94, 2428)), false);  // pcinfo-022 full
  assert.equal(isHardPrimaryKernel(fakeKernel(456, 95, 5028)), false);  // pcinfo-024-like

  // BOX-derived primary kernels exceeded the Rust cardinality-only timeout.
  assert.equal(isHardPrimaryKernel(fakeKernel(239, 113, 2435)), true);
  assert.equal(isHardPrimaryKernel(fakeKernel(712, 141, 7483)), true);
  assert.equal(isHardPrimaryKernel(fakeKernel(749, 110, 10056)), true);

  const fullySolved = fakeKernel(0, 0, 0);
  assert.equal(resolveUseHiGHS(dummy, 'Auto', fullySolved), false);
  assert.equal(resolveUseHiGHS(dummy, 'Auto', fakeKernel(10, 8, 20)), false);
  assert.equal(resolveUseHiGHS(dummy, 'Auto', fakeKernel(239, 113, 2435)), true);
  assert.deepEqual(primaryKernelStats(fakeKernel(2, 3, 5)), { cases: 2, solutions: 3, entries: 5, forced: 0 });
});

test('forced Rust keeps primary independent while True/Fast choose secondary strategy', async () => {
  const solver = await createWasmSolver(4);
  try {
    const coverage = new Map([
      ['A', new Set(['X', 'Y'])],
      ['B', new Set(['X', 'Z'])],
      ['C', new Set(['Y', 'Z'])],
    ]);
    const q = new Map([
      ['A|X',100],['A|Y',30],
      ['B|X',20],['B|Z',90],
      ['C|Y',80],['C|Z',10],
    ]);
    const qualityFor = (key, caseId) => q.get(`${caseId}|${key}`) ?? 0;

    const fast = await minimumCoverAsync(coverage, {
      qualityFor, solver, useHiGHS: false, exactQuality: 'Fast', fastStateBudget: 1000,
    });
    assert.equal(fast.count, 2);
    assert.equal(fast.cardinalityBackend, 'rust');
    assert.equal(fast.qualityBackend, 'fast-dominance-exact');
    assert.equal(fast.qualityExact, true);
    assert.equal(fast.fastDecision, 'dominance-preview-exact');
    assert.equal(fast.fastFallback, false);

    const fallback = await minimumCoverAsync(coverage, {
      qualityFor, solver, useHiGHS: false, exactQuality: 'Fast', fastStateBudget: 1,
    });
    assert.equal(fallback.count, 2);
    assert.equal(fallback.cardinalityBackend, 'rust');
    assert.equal(fallback.qualityBackend, 'fast-2x2');
    assert.equal(fallback.qualityExact, false);
    assert.equal(fallback.fastFallback, true);

    const exact = await minimumCoverAsync(coverage, { qualityFor, solver, useHiGHS: false, exactQuality: true });
    const legacy = solver.minimumCover(coverage, { qualityFor });
    assert.equal(exact.cardinalityBackend, 'rust');
    assert.equal(exact.qualityBackend, 'rust-quality-integrated');
    assert.equal(exact.qualityExact, true);
    assert.equal(exact.fastFallback, false);
    assert.deepEqual(exact.keys, legacy.keys);
    assert.deepEqual(exact.qualityVector, legacy.qualityVector);
  } finally { solver.close(); }
});

test('exactHumanQuality accepts True/Fast and false aliases Fast', () => {
  assert.equal(normalizeExactHumanQuality(true), 'true');
  assert.equal(normalizeExactHumanQuality('True'), 'true');
  assert.equal(normalizeExactHumanQuality('Fast'), 'fast');
  assert.equal(normalizeExactHumanQuality(false), 'fast');
});

test('forced HiGHS separates primary backend from exact quality backend', async () => {
  const solver = await createWasmSolver(4);
  try {
    const coverage = new Map([
      ['A', new Set(['X', 'Y'])],
      ['B', new Set(['X', 'Z'])],
      ['C', new Set(['Y', 'Z'])],
    ]);
    const q = new Map([
      ['A|X',100],['A|Y',30],
      ['B|X',20],['B|Z',90],
      ['C|Y',80],['C|Z',10],
    ]);
    const qualityFor = (key, caseId) => q.get(`${caseId}|${key}`) ?? 0;
    const fast = await minimumCoverAsync(coverage, { qualityFor, solver, useHiGHS: true, exactQuality: 'Fast', fastStateBudget: 1 });
    assert.equal(fast.cardinalityBackend, 'highs');
    assert.equal(fast.useHiGHSResolved, true);
    assert.equal(fast.qualityBackend, 'fast-2x2');
    assert.equal(fast.qualityExact, false);
    const exact = await minimumCoverAsync(coverage, { qualityFor, solver, useHiGHS: true, exactQuality: true });
    assert.equal(exact.cardinalityBackend, 'highs');
    assert.equal(exact.useHiGHSResolved, true);
    assert.equal(exact.qualityBackend, 'rust-quality-integrated');
    assert.equal(exact.qualityExact, true);
    assert.equal(exact.count, 2);
    assert.equal(exact.qualityVector.length, 3);
  } finally { solver.close(); }
});


test('forced HiGHS does not load/claim HiGHS when exact kernelization already proves K', async () => {
  const solver = await createWasmSolver(4);
  try {
    const coverage = new Map([
      ['A', new Set(['X','Y'])],
      ['B', new Set(['Z','W'])],
    ]);
    const result = await minimumCoverAsync(coverage, { solver, useHiGHS: true, exactQuality: 'Fast' });
    assert.equal(result.count, 2);
    assert.equal(result.cardinalityBackend, 'kernel');
    assert.equal(result.backend, 'kernel');
    assert.equal(result.qualityBackend, 'none');
    assert.deepEqual(result.qualityVector, []);
    assert.equal(result.fastDecision, 'cardinality-only');
    assert.equal(result.useHiGHSRequested, true);
    assert.equal(result.useHiGHSResolved, false);
  } finally { solver.close(); }
});

test('Auto takes kernel-only exact path before loading HiGHS when reductions fully solve K', async () => {
  const solver = await createWasmSolver(4);
  try {
    const coverage = new Map([
      ['A', new Set(['X','Y'])],
      ['B', new Set(['Z','W'])],
    ]);
    const result = await minimumCoverAsync(coverage, { solver, useHiGHS: 'Auto', exactQuality: 'Fast' });
    assert.equal(result.count, 2);
    assert.equal(result.cardinalityBackend, 'kernel');
    assert.equal(result.backend, 'kernel');
    assert.equal(result.qualityBackend, 'none');
    assert.deepEqual(result.qualityVector, []);
    assert.equal(result.fastDecision, 'cardinality-only');
    assert.equal(result.useHiGHSRequested, 'auto');
    assert.equal(result.useHiGHSResolved, false);
  } finally { solver.close(); }
});
