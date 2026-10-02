import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { createNumericCoverage, numericPacked } from '../src/numeric-cover-data.mjs';
import { findTrivialSecondary, analyzeSecondaryComponents, summarizeSecondaryComponents, solveStructuredSecondary, createSecondarySession } from '../src/min-cover-components.mjs';
import { solveExactSecondary } from '../src/min-cover-exact-secondary.mjs';
import { solveRoutedSecondary } from '../src/min-cover-routing.mjs';

function matrix(keys, rows) {
  const view = createNumericCoverage(keys, new Map(rows.map((row, id) => [id, row])), rows.map((_, caseId) => ({ caseId })));
  return { ...view, qualityFor: (key, id) => view.qualityIndex.get(id).get(key) };
}
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
// Independent exhaustive oracle, including a deliberately unimproved K-seed.
function brute(keys, rows) {
  let best, seedKeys;
  for (let mask = 0; mask < (1 << keys.length); mask++) {
    const selected = keys.filter((_, id) => mask & (1 << id)).sort();
    if (best && selected.length > best.count) continue;
    const qualityVector = rows.map(row => Math.max(0, ...row.filter(([id]) => mask & (1 << id)).map(([, q]) => q))).sort((a, b) => a - b);
    if (qualityVector.some(q => q === 0)) continue;
    if (!best || selected.length < best.count) {
      best = { count: selected.length, keys: selected, qualityVector }; seedKeys = selected;
    } else if (compare(qualityVector, best.qualityVector) > 0 ||
      (compare(qualityVector, best.qualityVector) === 0 && compare(selected, best.keys) < 0)) {
      best = { count: selected.length, keys: selected, qualityVector };
    }
  }
  return { ...best, seedKeys };
}

test('original singleton proof preserves duplicate weighted rows and ignores unused universe keys', () => {
  const m = matrix(['z', 'a', 'unused'], [[[0, 3]], [[0, 8], [1, 99]], [[0, 8], [1, 99]]]);
  const result = findTrivialSecondary(m.coverage, 1, m.qualityFor);
  assert.deepEqual(result.keys, ['z']);
  assert.deepEqual(result.qualityVector, [3, 8, 8]);
  assert.equal(result.secondaryTrivial, 'original-singletons');
  const mapResult = findTrivialSecondary(m.coverage.toMap(), 1, m.qualityFor);
  assert.deepEqual(mapResult, result);
  const duplicate = matrix(['a', 'b'], [[[0, 1], [0, 7]], [[0, 2], [1, 9]]]);
  assert.deepEqual(findTrivialSecondary(duplicate.coverage, 1, duplicate.qualityFor).qualityVector, [2, 7]);
});

test('trivial checks include empty/all candidates and reject insufficient forced coverage', () => {
  assert.deepEqual(findTrivialSecondary(new Map(), 0, () => 1).keys, []);
  const all = matrix(['b', 'a'], [[[0, 2]], [[1, 0xffffffff]]]);
  assert.deepEqual(findTrivialSecondary(all.coverage, 2, all.qualityFor).qualityVector, [2, 0xffffffff]);
  const uncovered = matrix(['a', 'b', 'c'], [[[0, 1]], [[1, 1], [2, 1]]]);
  assert.equal(findTrivialSecondary(uncovered.coverage, 1, uncovered.qualityFor), null);
  const noOriginalSingleton = matrix(['a', 'b'], [[[0, 1], [1, 2]]]);
  assert.equal(findTrivialSecondary(noOriginalSingleton.coverage, 1, noOriginalSingleton.qualityFor), null);
});

test('quality-only redundant rows still connect components', () => {
  const m = matrix(['a', 'b', 'c'], [[[0, 1]], [[1, 1]], [[0, 5], [1, 4], [2, 9]]]);
  assert.equal(analyzeSecondaryComponents(m.coverage, m.qualityFor).components.length, 1);
  assert.deepEqual(summarizeSecondaryComponents(m.coverage, m.qualityFor), { componentCount: 1, largestComponent: 3 });
});

test('topology summary matches an independent graph walk without reading qualities', () => {
  let state = 981;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  const noQuality = () => { throw new Error('topology must not evaluate quality'); };
  assert.deepEqual(summarizeSecondaryComponents(new Map(), noQuality), { componentCount: 0, largestComponent: 0 });
  for (let trial = 0; trial < 100; trial++) {
    const keys = Array.from({ length: 12 }, (_, id) => `k${id}`);
    const rows = [], neighbors = new Map();
    for (let row = 0; row < 15; row++) {
      const group = random(3), entries = [];
      for (let i = 0; i < 1 + random(5); i++) entries.push([group * 3 + random(3), 1 + random(20)]);
      rows.push(entries); // Duplicates and unused candidates are intentional.
      for (const [id] of entries) {
        if (!neighbors.has(id)) neighbors.set(id, new Set());
        for (const [other] of entries) neighbors.get(id).add(other);
      }
    }
    const unseen = new Set(neighbors.keys()), sizes = [];
    while (unseen.size) {
      const pending = [unseen.values().next().value];
      unseen.delete(pending[0]);
      let size = 0;
      while (pending.length) {
        const id = pending.pop(); size++;
        for (const next of neighbors.get(id)) if (unseen.delete(next)) pending.push(next);
      }
      sizes.push(size);
    }
    const expected = { componentCount: sizes.length, largestComponent: Math.max(0, ...sizes) };
    const m = matrix(keys, rows);
    assert.deepEqual(summarizeSecondaryComponents(m.coverage, noQuality), expected);
    assert.deepEqual(summarizeSecondaryComponents(m.coverage.toMap(), noQuality), expected);
    const full = analyzeSecondaryComponents(m.coverage, m.qualityFor);
    assert.deepEqual({ componentCount: full.components.length,
      largestComponent: Math.max(0, ...full.components.map(group => group.ids.length)) }, expected);
  }
});

test('sequential components and whole engines match exhaustive K, quality and stable IDs', async () => {
  const solver = await createWasmSolver(4, { legal: false });
  let state = 87123;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  try {
    for (let trial = 0; trial < 80; trial++) {
      const n = 4 + random(6), split = 1 + random(n - 1);
      // Reverse input keys to test stable ordering across local/global mappings.
      const keys = Array.from({ length: n }, (_, id) => `k${n - id}`), rows = [];
      const groups = trial % 4 === 0 ? [Array.from({ length: n }, (_, id) => id)]
        : [Array.from({ length: split }, (_, id) => id), Array.from({ length: n - split }, (_, id) => id + split)];
      for (const group of groups) {
        rows.push(group.map(id => [id, 1 + random(4)]));
        for (let row = 0; row < 5; row++) {
          const entries = group.filter(() => random(3) !== 0).map(id => [id, 1 + random(6)]);
          if (entries.length) rows.push(entries);
        }
      }
      rows.push(rows[0].map(entry => [...entry]));
      const m = matrix(keys, rows), expected = brute(keys, rows);
      for (const structureFirst of [false, true]) for (const probeStates of [0, 1, 10000]) {
        const routed = solveRoutedSecondary(m.coverage, { solver, qualityFor: m.qualityFor,
          count: expected.count, seedKeys: expected.seedKeys, cardinalityProven: true,
          probeStates, minComponents: 2, structureFirst });
        assert.equal(routed.completed, true);
        assert.deepEqual({ count: routed.count, keys: routed.keys, qualityVector: routed.qualityVector },
          { count: expected.count, keys: expected.keys, qualityVector: expected.qualityVector });
      }
      for (const engine of ['integrated', 'threshold']) for (const decomposition of ['off', 'on', 'auto']) {
        const result = solveStructuredSecondary(m.coverage, { solver, qualityFor: m.qualityFor,
          count: expected.count, seedKeys: expected.seedKeys, cardinalityProven: true, engine, decomposition });
        assert.equal(result.completed, true, `${trial}/${engine}/${decomposition}`);
        assert.deepEqual({ count: result.count, keys: result.keys, qualityVector: result.qualityVector },
          { count: expected.count, keys: expected.keys, qualityVector: expected.qualityVector });
      }
    }
  } finally { solver.close(); }
});

test('budget is shared across components and incomplete results remain feasible', async () => {
  const m = matrix(['a', 'b', 'c', 'd'], [[[0, 1], [1, 3]], [[2, 1], [3, 4]]]);
  const solver = await createWasmSolver(4, { legal: false });
  const calls = [], original = solver.minimumCoverAtCount.bind(solver);
  solver.minimumCoverAtCount = (coverage, count, options) => {
    calls.push(options.stateBudget); return original(coverage, count, options);
  };
  const options = { solver, qualityFor: m.qualityFor, count: 2, seedKeys: ['a', 'c'], cardinalityProven: true, decomposition: 'on' };
  try {
    const zero = solveStructuredSecondary(m.coverage, { ...options, stateBudget: 0 });
    assert.equal(zero.completed, false); assert.deepEqual(zero.keys, ['a', 'c']); assert.equal(calls.length, 0);
    for (const engine of ['integrated', 'threshold']) {
      calls.length = 0;
      const partial = solveStructuredSecondary(m.coverage, { ...options, engine, stateBudget: 1 });
      assert.equal(partial.completed, false); assert.ok(partial.qualityVector.every(q => q > 0));
      assert.ok(calls.length <= 1); assert.equal(calls[0], 1);
    }
    assert.throws(() => solveStructuredSecondary(m.coverage, { ...options, cardinalityProven: false }), /proven minimum/);
    assert.throws(() => solveStructuredSecondary(m.coverage, { ...options, seedKeys: ['a', 'b'] }), /cover every/);
    assert.throws(() => solveStructuredSecondary(m.coverage, { ...options, seedKeys: ['a', 'a'] }), /invalid minimum/);
  } finally { solver.close(); }
});

test('common exact entry point skips trivial search and never labels an incomplete threshold exact', () => {
  const context = { primary: { count: 1, backend: 'rust' }, primaryKeys: ['a'], primaryHard: true,
    requestedPrimary: 'rust', requested: false, kernelStats: { cases: 1, solutions: 1, entries: 1 } };
  const m = matrix(['a', 'b'], [[[0, 2]], [[0, 3], [1, 9]]]);
  const result = solveExactSecondary(m.coverage, { ...context, qualityFor: m.qualityFor,
    solver: { minimumCoverAtCount() { throw new Error('must not search'); } } });
  assert.equal(result.qualityExact, true); assert.equal(result.qualityDecision, 'trivial-exact');
  const nontrivial = matrix(['a', 'b'], [[[0, 1], [1, 2]]]);
  assert.throws(() => solveExactSecondary(nontrivial.coverage, { ...context, qualityFor: nontrivial.qualityFor,
    solver: { minimumCoverAtCount() { return { count: 1, keys: ['a'], completed: false }; } } }), /failed/);
});

test('engine switches reuse component matrices and only proved components skip further search', async () => {
  const rows = [[[0, 1], [1, 4]], [[0, 1], [1, 4]], [[2, 2], [3, 2]], [[2, 4], [3, 1]]];
  const m = matrix(['a', 'b', 'c', 'd'], rows);
  const session = createSecondarySession(m.coverage, { qualityFor: m.qualityFor, count: 2,
    seedKeys: ['a', 'd'], cardinalityProven: true, decomposition: 'on' });
  const solver = await createWasmSolver(4, { legal: false });
  const seenViews = [];
  try {
    const first = session.run({ stateBudget: 2, solver: { minimumCoverAtCount(coverage, count, options) {
      seenViews.push(coverage);
      if (seenViews.length === 1) return { ...solver.minimumCoverAtCount(coverage, count,
        { ...options, stateBudget: null }), searchedStates: 1 };
      return { count, keys: [...options.seedKeys], completed: false, searchedStates: 1 };
    } } });
    assert.equal(first.completed, false); assert.equal(first.solvedComponents, 1);
    assert.equal(first.preparedComponents, 2); assert.equal(first.searchedStates, 2);
    first.keys.fill('tampered'); first.componentStats[0].completed = false;
    let secondCalls = 0;
    const second = session.run({ engine: 'threshold', solver: { minimumCoverAtCount(coverage, count, options) {
      secondCalls++; assert.equal(coverage, seenViews[1]);
      assert.deepEqual(options.seedKeys, ['d']);
      return solver.minimumCoverAtCount(coverage, count, options);
    } } });
    assert.equal(secondCalls, 1); assert.equal(second.reusedComponents, 1);
    assert.equal(second.preparedComponents, 2); assert.equal(second.completed, true);
    assert.deepEqual(second.keys, ['b', 'c']);
    assert.deepEqual(second.qualityVector, brute(['a', 'b', 'c', 'd'], rows).qualityVector);
    second.qualityVector.fill(0);
    const third = session.run({ stateBudget: 0, solver: { minimumCoverAtCount() { throw Error('already proved'); } } });
    assert.equal(third.completed, true); assert.equal(third.reusedComponents, 2);
    assert.equal(third.searchedStates, 0); assert.deepEqual(third.keys, ['b', 'c']);
    assert.deepEqual(third.qualityVector, [2, 4, 4, 4]);
  } finally { solver.close(); }
});

test('session proofs remain bound to their owned input despite caller mutation or another session', async () => {
  const m = matrix(['a', 'b'], [[[0, 1], [1, 9]], [[0, 1], [1, 8]]]);
  const options = { qualityFor: m.qualityFor, count: 1, seedKeys: ['a'], cardinalityProven: true };
  const session = createSecondarySession(m.coverage, options);
  const packed = numericPacked(m.prepared.rawCases);
  packed.qualities.fill(1);
  const other = createSecondarySession(m.coverage, options);
  // Both snapshots remain usable after the original buffers are corrupted.
  packed.ids.fill(999);
  const solver = await createWasmSolver(4, { legal: false });
  try {
    assert.deepEqual(session.run({ solver }).keys, ['b']);
    assert.deepEqual(other.run({ solver }).keys, ['a']);
    assert.deepEqual(session.run({ stateBudget: 0 }).qualityVector, [8, 9]);
  } finally { solver.close(); }
});

test('an invalid solver selection does not become a reusable component proof', async () => {
  const m = matrix(['a', 'b', 'c'], [[[0, 1], [1, 5]], [[1, 5], [2, 1]]]);
  const session = createSecondarySession(m.coverage, { qualityFor: m.qualityFor, count: 1,
    seedKeys: ['b'], cardinalityProven: true });
  assert.throws(() => session.run({ solver: { minimumCoverAtCount() {
    return { count: 1, keys: ['a'], completed: true, searchedStates: 1 };
  } } }), /invalid component secondary coverage/);
  const solver = await createWasmSolver(4, { legal: false });
  try { assert.deepEqual(session.run({ solver }).keys, ['b']); }
  finally { solver.close(); }
});

test('common exact orchestration retains component proofs across its integrated-to-threshold fallback', async () => {
  const m = matrix(['a', 'b', 'c', 'd'], [[[0, 1], [1, 4]], [[2, 2], [3, 1]]]);
  const real = await createWasmSolver(4, { legal: false }), calls = [];
  const solver = { minimumCoverAtCount(coverage, count, options) {
    calls.push({ coverage, integrated: !!options.integrated });
    if (calls.length === 2) return { count, keys: [...options.seedKeys], completed: false, searchedStates: 99999 };
    const result = real.minimumCoverAtCount(coverage, count, { ...options, stateBudget: null });
    return calls.length === 1 ? { ...result, searchedStates: 1 } : result;
  } };
  try {
    const result = solveExactSecondary(m.coverage, { solver, qualityFor: m.qualityFor, decomposition: 'on',
      primary: { count: 2, backend: 'rust' }, primaryKeys: ['a', 'd'], primaryHard: false,
      requestedPrimary: 'rust', requested: false, kernelStats: { cases: 2, solutions: 4, entries: 4 } });
    assert.deepEqual(calls.map(call => call.integrated), [true, true, false]);
    assert.equal(calls[1].coverage, calls[2].coverage);
    assert.deepEqual(result.keys, ['b', 'c']); assert.equal(result.qualityExact, true);
    assert.equal(result.reusedComponents, 1); assert.equal(result.integratedProbeStates, 100000);
  } finally { real.close(); }
});

test('routing shares the integrated budget, retains incumbents, and does not certify bounded results', () => {
  const m = matrix(['a', 'b', 'c', 'd'], [[[0, 1], [1, 3]], [[2, 1], [3, 4]]]);
  const options = { qualityFor: m.qualityFor, count: 2, seedKeys: ['a', 'c'], cardinalityProven: true,
    probeStates: 3, integratedStates: 5, minComponents: 2, thresholdStates: 0 };
  const calls = [];
  const solver = { minimumCoverAtCount(coverage, count, opts) {
    calls.push(opts);
    return { count, keys: [...opts.seedKeys], completed: false, searchedStates: opts.stateBudget };
  } };
  const result = solveRoutedSecondary(m.coverage, { ...options, solver });
  assert.deepEqual(calls.map(x => x.stateBudget), [3, 2]);
  assert.equal(result.completed, false); assert.equal(result.searchedStates, 5);
  assert.deepEqual(result.keys, ['a', 'c']); assert.deepEqual(result.qualityVector, [1, 1]);
  calls.length = 0;
  const zero = solveRoutedSecondary(m.coverage, { ...options, solver, probeStates: 0, integratedStates: 0 });
  assert.equal(zero.completed, false); assert.equal(calls.length, 0);
  const wholeZero = solveRoutedSecondary(m.coverage, { ...options, solver, probeStates: 0,
    integratedStates: 0, minComponents: 3 });
  assert.equal(wholeZero.completed, false); assert.equal(calls.length, 0);
  for (const extra of [{ cardinalityProven: false }, { probeStates: -1 }, { probeStates: 6 },
    { minComponents: 1 }, { integratedStates: 1.5 }, { thresholdStates: -1 }]) {
    assert.throws(() => solveRoutedSecondary(m.coverage, { ...options, solver, ...extra }));
  }
  assert.throws(() => solveRoutedSecondary(m.coverage, { ...options, solver,
    minComponents: 3, thresholdStates: null }), /did not complete/);
});

test('explicit routing preserves worker dispatch options and rejects legacy probe replay', async () => {
  const m = matrix(['a', 'b'], [[[0, 1], [1, 4]]]);
  const context = { primary: { count: 1, backend: 'rust' }, primaryKeys: ['a'], primaryHard: false,
    requestedPrimary: 'rust', requested: false, kernelStats: { cases: 1, solutions: 2, entries: 2 },
    decomposition: 'auto', routingProbeStates: 1, routingMinComponents: 2, routingStructureFirst: true,
    qualityFor: m.qualityFor };
  const deferred = solveExactSecondary(m.coverage, { ...context,
    solver: { minimumCoverAtCount() { throw Error('dispatch before probe'); } }, deferThreshold: ctx => ctx });
  assert.equal(deferred.routingProbeStates, 1); assert.equal(deferred.routingMinComponents, 2);
  assert.equal(deferred.routingStructureFirst, true);
  assert.equal(deferred.decomposition, 'auto'); assert.equal(deferred.integratedProbe, undefined);
  assert.throws(() => solveExactSecondary(m.coverage, { ...context, integratedProbe: {} }), /legacy integrated probe/);
  const solver = await createWasmSolver(4, { legal: false });
  try {
    const result = solveExactSecondary(m.coverage, { ...context, solver });
    assert.equal(result.qualityExact, true); assert.equal(result.completed, true);
    assert.deepEqual(result.keys, ['b']); assert.deepEqual(result.qualityVector, [4]);
  } finally { solver.close(); }
});

test('structure-first keeps a single full integrated invocation for connected problems', () => {
  const m = matrix(['a', 'b'], [[[0, 1], [1, 4]]]);
  const calls = [];
  const result = solveRoutedSecondary(m.coverage, { qualityFor: m.qualityFor, count: 1,
    seedKeys: ['a'], cardinalityProven: true, probeStates: 1, integratedStates: 100,
    structureFirst: true, solver: { minimumCoverAtCount(coverage, count, options) {
      calls.push(options);
      return { count, keys: ['b'], qualityVector: [4], completed: true, searchedStates: 30 };
    } } });
  assert.equal(calls.length, 1); assert.equal(calls[0].stateBudget, 100);
  assert.equal(result.routing.componentCount, 1); assert.equal(result.routing.effectiveWholeBudget, 100);
  assert.equal(result.routing.wholeProbeStates, 30); assert.equal(result.completed, true);
});
