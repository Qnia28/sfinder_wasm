import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { BatchReachability } from '../src/batch-backend.mjs';
import { refineMinimumCoverQuality } from '../src/highs-min-cover.mjs';
import { expandPattern, PatternExpansionError, MAX_PATTERN_CASES } from '../src/pattern.mjs';
import { calculateCover, calculateCongruent } from '../src/batch-features.mjs';

test('WASM u32 quality values survive the JS boundary unsigned', async () => {
  const solver = await createWasmSolver(4, { legal: false });
  try {
    for (const quality of [0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff]) {
      const result = solver.minimumCoverIds([[[0, quality]]], 1);
      assert.equal(result.count, 1);
      assert.deepEqual(result.selectedIds, [0]);
      assert.deepEqual(result.qualityVector, [quality]);
    }
  } finally {
    solver.close();
  }
});

test('batch u32::MAX sentinels are recognized after WASM signed conversion', () => {
  const exports = {
    batch_engine_reset() {},
    batch_engine_run() { return -1; },
    batch_congruent_run() { return -1; },
  };
  const reachability = new BatchReachability(exports, 4, 'jstris');
  assert.throws(
    () => reachability.buildVariants({ base: 0n, operations: [] }),
    /batch engine failed/,
  );
  assert.throws(
    () => reachability.congruent({ base: 0n, fill: 0n, queues: [] }),
    /congruent tiling limit/,
  );
});

test('2x2 refinement rank-compresses sparse high u32 qualities', () => {
  const result = refineMinimumCoverQuality({
    keys: ['A', 'B'],
    cases: [
      [[0, 0xffffffff]],
      [[1, 0x80000000]],
    ],
    maxQuality: 0xffffffff,
  }, [0, 1], { maxPasses: 0 });
  assert.deepEqual(result.selected, [0, 1]);
  assert.deepEqual(result.qualityVector, [0x80000000, 0xffffffff]);
});

test('batch feature clear height must be an integer number in 2..6', async () => {
  for (const clear of [4.5, Number.NaN, '4']) {
    await assert.rejects(
      calculateCover({ sourceFumen: 'not-used', pattern: 'I', clear }),
      /unsupported clear height/,
    );
    await assert.rejects(
      calculateCongruent({ sourceFumen: 'not-used', pattern: 'I', clear }),
      /unsupported clear height/,
    );
  }
});

test('pattern expansion allows useful large products and rejects products above the default cap', () => {
  assert.equal(MAX_PATTERN_CASES, 1_000_000);
  assert.equal(expandPattern('*p7').length, 5040);
  assert.equal(expandPattern('*p7,*p2').length, 211_680);
  assert.throws(() => expandPattern('*p7,*p3'), PatternExpansionError);
  assert.throws(() => expandPattern('*p7', { maxCases: 5039 }), PatternExpansionError);
  assert.equal(expandPattern('*p7', { maxCases: 5040 }).length, 5040);
});
