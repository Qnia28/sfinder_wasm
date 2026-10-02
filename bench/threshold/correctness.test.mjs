import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { openEngine, oracle, validateWitness } from './engine.mjs';

const root = resolve(process.env.THRESHOLD_BUILD_ROOT || 'bench/threshold/build');
function generator(seed) {
  let state = seed;
  const next = () => state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return sample => {
    const n = 3 + next() % 6, rows = [];
    for (let r = 0, length = 2 + next() % 9; r < length; r++) {
      const row = [];
      for (let id = 0; id < n; id++) if (next() % 3 !== 0) row.push([id,
        sample % 7 === 0 ? 5 : [1, 3, 9, 0xffffffff][next() % 4]]);
      if (!row.length) row.push([next() % n, 1]);
      if (sample % 3 === 0) row.push(row[0]);
      rows.push(row);
    }
    rows.push(rows[0]);
    return { keys: Array.from({ length: n }, (_, i) => String(i).padStart(3, '0')), rows };
  };
}

async function checkSuite(count, masks, bounded, seed) {
  const original = await openEngine(resolve(root, 'original.wasm'));
  const candidate = await openEngine(resolve(root, 'experiment.wasm'));
  const production = await openEngine(resolve(root, 'production.wasm'));
  const make = generator(seed);
  try {
    for (let sample = 0; sample < count; sample++) {
      const raw = make(sample), expected = oracle(raw), matrix = { ...raw, K: expected.K, seed: expected.seed };
      const levels = [...new Set(raw.rows.flatMap(row => row.map(([,q]) => q)))].sort((a,b) => a-b);
      if (levels.length > 1) levels.shift();
      for (const stateBudget of bounded ? [0,1,2,5,20,100,null] : [null]) {
        const baseline = original.solve(matrix, { stateBudget });
        const defaultResult = production.solve(matrix, { stateBudget });
        assert.deepEqual(defaultResult, baseline, 'production entry point changed');
        for (const mask of masks) {
          const result = candidate.solve(matrix, { mask, stateBudget });
          validateWitness(matrix, result);
          if (stateBudget !== null) assert(result.searchedStates <= stateBudget);
          if (result.completed) {
            assert.deepEqual(result.selected, expected.selected, `sample=${sample} mask=${mask}`);
            assert.deepEqual(result.quality, expected.quality);
            assert.equal(result.provenPrefix.length, levels.length);
          }
          for (const [i, target] of result.provenPrefix.entries()) {
            assert.equal(target, expected.quality.filter(q => q >= levels[i]).length);
            assert.equal(target, result.quality.filter(q => q >= levels[i]).length);
          }
          if ((mask & ~3) === 0) {
            const comparable = { ...result };
            if (stateBudget === null) delete comparable.provenPrefix;
            assert.deepEqual(comparable, baseline, 'all-off / A / B parity');
          }
        }
      }
      const optimalMatrix = { ...matrix, seed: expected.selected };
      const targets = levels.map(t => expected.quality.filter(q => q >= t).length);
      for (const length of new Set([1, targets.length])) for (const mask of masks) {
        const result = candidate.solve(optimalMatrix, { mask, lockedPrefix: targets.slice(0, length) });
        assert.equal(result.completed, true);
        assert.deepEqual(result.selected, expected.selected);
        assert.deepEqual(result.provenPrefix, targets);
      }
    }
  } finally { original.close(); candidate.close(); production.close(); }
}

test('real WASM: 512 fixtures, all 32 masks and trusted locks', () => checkSuite(512,
  Array.from({ length: 32 }, (_, i) => i), false, 0x731ae852));
test('real WASM: independent 2000 fixtures, individual switches', () => checkSuite(2000,
  [0,1,2,4,8,16,31], false, 0x125492ab));
test('real WASM: 160 fixtures, all masks and bounded incumbents/prefixes', () => checkSuite(160,
  Array.from({ length: 32 }, (_, i) => i), true, 0x82461397));
test('experiment masks and trace contracts', async () => {
  const candidate = await openEngine(resolve(root, 'experiment.wasm'));
  const trace = await openEngine(resolve(root, 'trace.wasm'));
  const raw = { keys: ['000','001'], rows: [[[0,1],[1,9]],[[0,1],[1,9]]], K: 1, seed: [0] };
  try {
    assert.equal(candidate.traceEnabled, false);
    assert.equal(trace.traceEnabled, true);
    assert.throws(() => candidate.solve(raw, { mask: 32 }));
    for (let mask = 0; mask < 32; mask++) {
      const a = candidate.solve(raw, { mask });
      const b = trace.solve(raw, { mask });
      assert.deepEqual({ ...b, diagnostics: undefined }, { ...a, diagnostics: undefined });
      assert(b.diagnostics.stages > 0);
    }
  } finally { candidate.close(); trace.close(); }
});

test('empty input, zero qualities, and zero-budget root unwind across reuse', async () => {
  const candidate = await openEngine(resolve(root, 'experiment.wasm'));
  try {
    for (let mask = 0; mask < 32; mask++) {
      const empty = candidate.solve({ keys: [], rows: [], K: 0, seed: [] }, { mask, stateBudget: 0 });
      assert.equal(empty.completed, true); assert.deepEqual(empty.selected, []);
      const zero = candidate.solve({ keys: ['000','001'], rows: [[[0,0],[1,0]]], K: 1, seed: [1] },
        { mask, allowZero: true });
      assert.equal(zero.completed, true); assert.deepEqual(zero.selected, [0]);
      const forced = { keys: ['000','001','002'], rows: [[[0,1]],[[1,1]],[[1,1],[2,9]]], K: 2, seed: [0,1] };
      for (const stateBudget of [0,1,2,3,null]) {
        const result = candidate.solve(forced,{mask,stateBudget});
        validateWitness(forced,result);
        if (stateBudget !== null) assert(result.searchedStates<=stateBudget);
      }
    }
  } finally { candidate.close(); }
});

test('root/prior/current switches exercise actual independent propagation', async () => {
  const trace = await openEngine(resolve(root, 'trace.wasm'));
  const make = generator(0xa3194b28);
  const counts = { root: 0, prior: 0, current: 0 };
  try {
    for (let sample = 0; sample < 200; sample++) {
      const raw = make(sample), expected = oracle(raw), matrix = { ...raw, K: expected.K, seed: expected.seed };
      for (const mask of [4, 8, 16]) {
        const result = trace.solve(matrix, { mask });
        assert.deepEqual(result.selected, expected.selected);
        if (mask === 4) {
          counts.root += result.diagnostics.rootForcedSteps;
          assert.equal(result.diagnostics.propagatedSteps, 0);
        } else {
          assert.equal(result.diagnostics.rootForcedSteps, 0);
          counts[mask === 8 ? 'prior' : 'current'] += result.diagnostics.propagatedSteps;
        }
      }
    }
    assert(counts.root > 0 && counts.prior > 0 && counts.current > 0, JSON.stringify(counts));
  } finally { trace.close(); }
});
