import test from 'node:test';
import assert from 'node:assert/strict';
import { minCoverMethods } from '../src/pc-wasm-min-cover.mjs';
import { allocateWasmU32Buffers } from '../src/pc-wasm-cover-matrix.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';
import { minimumCoverAsync } from '../src/min-cover-adaptive.mjs';

function mockSolver() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const live = new Map(), allocations = [], inputs = [];
  let next = 8, selected = [], qualities = [], searches = 0;
  const engine = (_solver, offsets, cases, ids, qs, entries, candidates, K, seed, seedLength) => {
    searches++;
    inputs.push({ offsets, ids, qs, values: [...new Uint32Array(memory.buffer, qs, entries)] });
    memory.grow(1); // Every export invalidates previous JS views.
    if (owner.failSearch === searches) throw new Error('search failed');
    selected = [...new Uint32Array(memory.buffer, seed, seedLength)];
    qualities = Array(cases).fill(1);
    return owner.completeAt === searches ? K : 0xfffffffe;
  };
  const owner = { ...minCoverMethods, ptr: 1, live, allocations, inputs, e: {
    memory,
    wasm_alloc_u32(length) {
      const ptr = next; next += Math.max(1, length) * 4;
      if (next > memory.buffer.byteLength) memory.grow(Math.ceil(next / 65536));
      allocations.push(length); live.set(ptr, length); return ptr;
    },
    wasm_dealloc_u32(ptr, length) { assert.equal(live.get(ptr), length); live.delete(ptr); },
    solver_min_cover_at_count_locked: engine,
    solver_min_cover_at_count_bounded: engine,
    solver_min_cover_at_count_integrated_bounded: engine,
    solver_min_cover_at_count_integrated_dominance_bounded: engine,
    solver_min_cover_selected: (_ptr, i) => selected[i],
    solver_min_cover_quality_len: () => qualities.length,
    solver_min_cover_quality: (_ptr, i) => qualities[i],
    solver_min_cover_searched_states: () => 1n,
  } };
  return owner;
}

test('three engines pack/upload once, survive memory growth, isolate sessions and free all buffers', () => {
  const solver = mockSolver();
  const coverage = new Map([[0, new Set(['b', 'a'])]]);
  let reads = 0;
  const qualityFor = key => { reads++; return key === 'a' ? 1 : 2; };
  const session = solver.createMinimumCoverAtCountSession(coverage, { qualityFor });
  assert.equal(solver.allocations.length, 0);
  for (const options of [{ integrated: true, dominance: true }, { integrated: true }, {}]) {
    session.minimumCoverAtCount(1, { seedKeys: ['a'], stateBudget: 1, ...options });
    assert.equal(solver.live.size, 3); // only the immutable matrix survives
  }
  assert.equal(reads, 2);
  assert.equal(solver.allocations.length, 9); // 3 shared + 3*(seed, locks), formerly 15
  assert.equal(new Set(solver.inputs.map(i => i.offsets)).size, 1);
  assert.deepEqual(solver.inputs.map(i => i.values), [[2, 1], [2, 1], [2, 1]]);
  const other = solver.createMinimumCoverAtCountSession(coverage, { qualityFor: () => 9 });
  other.minimumCoverAtCount(1, { seedKeys: ['b'], stateBudget: 1 });
  assert.deepEqual(solver.inputs.at(-1).values, [9, 9]);
  assert.notEqual(solver.inputs[0].offsets, solver.inputs.at(-1).offsets);
  other.close(); session.close(); session.close();
  assert.equal(solver.live.size, 0);
  assert.throws(() => session.minimumCoverAtCount(1), /closed/);
});

test('partial allocation failure rolls back; empty and unavailable engines allocate nothing', () => {
  const solver = mockSolver(), alloc = solver.e.wasm_alloc_u32;
  let attempts = 0;
  solver.e.wasm_alloc_u32 = n => { if (++attempts === 2) throw Error('allocation failed'); return alloc(n); };
  assert.throws(() => allocateWasmU32Buffers(solver, { a: new Uint32Array(1), b: new Uint32Array(1) }), /allocation failed/);
  assert.equal(solver.live.size, 0);
  solver.e.wasm_alloc_u32 = alloc;
  const empty = solver.createMinimumCoverAtCountSession(new Map(), { qualityFor: () => 1 });
  assert.equal(empty.minimumCoverAtCount(0).completed, true); empty.close();
  const unavailable = { ...minCoverMethods, e: {} };
  const session = unavailable.createMinimumCoverAtCountSession(new Map([[0, new Set(['a'])]]), { qualityFor: () => 1 });
  assert.equal(session.minimumCoverAtCount(1), null); session.close();
  assert.equal(solver.allocations.length, 1);
});

test('Fast owns session cleanup on every exact exit, refine fallback, DIRECT and exceptions', async () => {
  // Small synthetic functional fixture, not a population benchmark.
  const coverage = new Map([[0, new Set(['a', 'b', 'c'])]]), qualityFor = () => 1;
  for (const completeAt of [0, 1, 2, 3]) {
    const solver = mockSolver(); solver.completeAt = completeAt;
    const result = await minimumCoverAsync(coverage, { solver, qualityFor, primary: 'rust' });
    assert.equal(result.count, 1);
    assert.equal(solver.live.size, 0);
    assert.equal(solver.inputs.length, completeAt || 3);
  }
  for (const failSearch of [1, 2, 3]) {
    const solver = mockSolver(); solver.failSearch = failSearch;
    await assert.rejects(minimumCoverAsync(coverage, { solver, qualityFor, primary: 'rust' }), /search failed/);
    assert.equal(solver.live.size, 0);
  }
  const solver = mockSolver();
  await minimumCoverAsync(coverage, { solver, qualityFor, primary: 'rust', fastPolicy: 'DIRECT_2X2' });
  assert.equal(solver.allocations.length, 0);
});

test('actual WASM preserves keys, quality, proof and states through preview/integrated/threshold reuse', async () => {
  const solver = await createWasmSolver(4, { legal: false });
  const keys = ['a', 'b', 'c'];
  const rows = [[[0, 1], [1, 3]], [[1, 1], [2, 3]], [[0, 3], [2, 1]]];
  const numeric = createNumericCoverage(keys, new Map(rows.map((r, i) => [i, r])), rows.map((_, caseId) => ({ caseId })));
  const qualityFor = (key, ci) => rows[ci].find(([id]) => keys[id] === key)?.[1];
  const coverage = new Map(rows.map((r, i) => [i, new Set(r.map(([id]) => keys[id]))]));
  try {
    for (const input of [coverage, numeric.coverage]) {
      const session = solver.createMinimumCoverAtCountSession(input, { qualityFor });
      let seedKeys = ['a', 'b'];
      let provenPrefix = [];
      try {
        for (const options of [
          { integrated: true, dominance: true, stateBudget: 1 },
          { integrated: true, stateBudget: 2 },
          { stateBudget: 1, proofProgress: true },
          { stateBudget: 1000, proofProgress: true },
          { importLocks: true },
        ]) {
          const opts = options.importLocks ? { lockedPrefix: provenPrefix, seedKeys, qualityFor }
            : { ...options, seedKeys, qualityFor };
          const expected = solver.minimumCoverAtCount(input, 2, opts);
          const actual = session.minimumCoverAtCount(2, opts);
          assert.deepEqual(actual, expected);
          assert.equal(actual.keys.length, 2);
          assert(actual.qualityVector.every(q => q > 0));
          seedKeys = actual.keys;
          if (actual.provenPrefix) provenPrefix = actual.provenPrefix;
        }
        assert.throws(() => session.minimumCoverAtCount(2, { qualityFor: () => 2 }), /cannot change/);
        assert.throws(() => session.minimumCoverAtCount(2, { seedKeys: ['unknown'] }), /not a candidate/);
      } finally { session.close(); }
      const shared = await minimumCoverAsync(input, { solver, qualityFor, primary: 'rust', fastStateBudget: 1 });
      const create = solver.createMinimumCoverAtCountSession;
      try {
        solver.createMinimumCoverAtCountSession = undefined;
        const unshared = await minimumCoverAsync(input, { solver, qualityFor, primary: 'rust', fastStateBudget: 1 });
        assert.deepEqual(shared, unshared);
      } finally { solver.createMinimumCoverAtCountSession = create; }
    }
  } finally { solver.close(); }
});
