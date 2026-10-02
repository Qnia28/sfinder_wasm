import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSaveOutcomeExpression } from '../src/saves.mjs';
import { createSaveOutcomeCache } from '../src/save-outcome-cache.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

const expressions = ['I', 'II', 'I&&J', 'IJ', '^I', '!I', '^(I&&J)', '!^(I&&J)',
  'I||J&&T', 'I||(J&&T)', '/^$/', '/I{8}/', '!/I/', '^(/I/&&/J/)'];
test('all small complete universes agree with original Set semantics, including nonmonotone expressions', () => {
  const evaluate = expressions.map(compileSaveOutcomeExpression);
  const cache = createSaveOutcomeCache(evaluate);
  const outcomes = ['', 'I', 'II', 'J', 'T', 'IIIIIIII'];
  for (let mask = 0; mask < 1 << outcomes.length; mask++) {
    const saves = outcomes.filter((_, i) => mask & (1 << i));
    const expected = evaluate.map(run => run(new Set(saves)).size > 0);
    assert.deepEqual(cache.match(new Set(saves)), expected);
    assert.deepEqual(cache.match(new Set([...saves].reverse())), expected);
  }
  assert.equal(cache.stats().hits, 64);
  assert.notDeepEqual(cache.match(new Set()), cache.match(new Set([''])));
});
test('keys observe caller mutation, hits avoid reevaluation, results cannot corrupt subsequent hits', () => {
  let calls = 0;
  const original = compileSaveOutcomeExpression('^(I&&J)');
  const cache = createSaveOutcomeCache([saves => { calls++; return original(saves); }]);
  const universe = new Set(['I']);
  const first = cache.match(universe); assert.deepEqual(first, [true]);
  assert.throws(() => { first[0] = false; }, TypeError);
  assert.deepEqual(cache.match(universe), [true]); assert.equal(calls, 1);
  universe.add('J'); assert.deepEqual(cache.match(universe), [false]); assert.equal(calls, 2);
  universe.delete('J'); assert.deepEqual(cache.match(universe), [true]); assert.equal(calls, 2);
});
test('entry/payload/outcome limits fall back exactly and retain existing hits', () => {
  const evaluate = [compileSaveOutcomeExpression('I')];
  const cache = createSaveOutcomeCache(evaluate, { maxEntries: 1, maxBytes: 64, maxOutcomes: 2 });
  assert.deepEqual(cache.match(new Set(['I'])), [true]);
  for (const saves of [new Set(['J']), new Set(['I', 'J', 'T']), new Set(['I'.repeat(100)])]) {
    assert.deepEqual(cache.match(saves), evaluate.map(run => run(saves).size > 0));
  }
  assert.deepEqual(cache.match(new Set(['I'])), [true]);
  assert.equal(cache.stats().entries, 1); assert.equal(cache.stats().hits, 1);
  assert(cache.stats().payloadBytes <= 64); assert(cache.stats().bypasses >= 3);
  const disabled = createSaveOutcomeCache(evaluate, { maxEntries: 0 });
  assert.deepEqual(disabled.match(new Set(['I'])), [true]); assert.equal(disabled.stats().entries, 0);
});
test('invalid regex errors remain lazy and repeated failures are not memoized', () => {
  const cache = createSaveOutcomeCache([compileSaveOutcomeExpression('I||/[/')]);
  assert.throws(() => cache.match(new Set(['I'])), SyntaxError);
  assert.throws(() => cache.match(new Set()), SyntaxError);
  assert.equal(cache.stats().entries, 0);
});
test('feature cache preserves aliases, branch bags, duplicate failed queues, ALL and request isolation', () => {
  const input = {
    singleSaveMask: false,
    sourceFumen: 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH',
    pattern: 'IIIIIIII,[I]p1;IIIIIIII,[I]p1;IIIIIIII,[I]p1;IIIIIIII,[IJ]p1',
    wantedSave: '/^$/#empty,/I{8}/#long,J#bag,^(I&&J)#nonmonotone',
    solver: { saveOutcomesPattern: () => Uint32Array.of(9, 3, 0, 2, 3, 1, 1, 1) },
  };
  const baseline = calculateSaves(input), cached = calculateSaves({ ...input, outcomeCache: true });
  assert.deepEqual(cached, baseline);
  cached.wantedSaveResults[0].failedQueues.length = 0;
  assert.deepEqual(calculateSaves({ ...input, outcomeCache: true }), baseline);
  assert.deepEqual(calculateSaves({ ...input, wantedSave: 'ALL', outcomeCache: true }), calculateSaves({ ...input, wantedSave: 'ALL' }));
  const failure = new Error('enumeration before regex');
  assert.throws(() => calculateSaves({ ...input, outcomeCache: true, wantedSave: '/[/',
    solver: { saveOutcomesPattern() { throw failure; } } }), error => error === failure);
});
test('real WASM and geometry fallback both retain complete results with cache enabled', async () => {
  const solver = await createWasmSolver(4), legacy = await createWasmSolver(4);
  legacy.saveOutcomesPattern = undefined;
  try {
    for (const pattern of ['T,*p3;T,*p3', 'TTJ,[I]p1;TTJ,*p1', 'TTJ,IIIIIIII,*p1']) {
      for (const useHold of [false, true]) {
        const input = { sourceFumen: 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH', pattern, useHold, singleSaveMask: false,
          wantedSave: ['/^$/#empty', '/I{8}/#long', '^(I&&J)#group', '!T#absent', 'I&&L', 'IJ'] };
        const reference = calculateSaves({ ...input, solver: legacy });
        assert.deepEqual(calculateSaves({ ...input, solver: legacy, outcomeCache: true }), reference);
        assert.deepEqual(calculateSaves({ ...input, solver, outcomeCache: true }), reference);
      }
    }
  } finally { solver.close(); legacy.close(); }
});
