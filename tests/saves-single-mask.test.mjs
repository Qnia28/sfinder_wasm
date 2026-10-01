import test from 'node:test';
import assert from 'node:assert/strict';
import { Field, encoder } from 'tetris-fumen';
import { compileSaveOutcomeExpression, compileSaveOutcomeMaskExpression, saveMaskToString, tetrisSortExact } from '../src/saves.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
const pieces = 'TILJSZO';
const expressions = ['I', 'II', 'I&&J', 'IJ', '^I', '!I', '^(I&&J)', '!^(I&&J)',
  'I||J&&T', 'I||(J&&T)', '/^$/', '/I{2}/', '!/I/', '^(/I/&&/J/)', '!!I', '^^I', '!(I||J)'];
const COMPLETE = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';

test('every last-bag base and residual universe preserves exact Set expression results', () => {
  const references = expressions.map(compileSaveOutcomeExpression);
  const factories = expressions.map(compileSaveOutcomeMaskExpression);
  for (let base = 0; base < 128; base++) {
    const values = [...pieces].map(piece => tetrisSortExact(saveMaskToString(base) + piece));
    const evaluate = factories.map(bind => bind(values));
    for (let mask = 0; mask < 128; mask++) {
      const universe = new Set(values.filter((_, bit) => mask & (1 << bit)));
      for (let e = 0; e < expressions.length; e++) {
        const expected = references[e](universe);
        const actualMask = evaluate[e](mask);
        const actual = new Set(values.filter((_, bit) => actualMask & (1 << bit)));
        assert.deepEqual(actual, expected, `base=${base} mask=${mask} expression=${expressions[e]}`);
      }
    }
  }
});
test('fixed dictionaries isolate mutations and retain empty, long and 31st outcomes', () => {
  const values = ['', ...Array.from({ length: 30 }, (_, i) => 'I'.repeat(i + 1))];
  const original = [...values], bind = compileSaveOutcomeMaskExpression('^/I{2}/||/I{30}/');
  const evaluate = bind(values); values.fill('T');
  const reference = compileSaveOutcomeExpression('^/I{2}/||/I{30}/');
  for (const mask of [0, 1, 1 << 30, 0x7fffffff]) {
    const universe = new Set(original.filter((_, i) => mask & (1 << i)));
    assert.deepEqual(new Set(original.filter((_, i) => evaluate(mask) & (1 << i))), reference(universe));
  }
  assert.throws(() => bind(Array(32).fill('I')), RangeError);
  assert.throws(() => bind(['I', 'I']), RangeError);
  assert.equal(bind([])(0), 0);
});
test('regex errors are lazy but not suppressed by empty masks or disjunction', () => {
  const bind = compileSaveOutcomeMaskExpression('I||/[/');
  const evaluate = bind(['I', 'J']);
  assert.throws(() => evaluate(0), SyntaxError);
  assert.throws(() => evaluate(1), SyntaxError);
  const failure = new Error('search before expression');
  assert.throws(() => calculateSaves({ sourceFumen: COMPLETE, pattern: 'T,*p3', wantedSave: '/[/', singleSaveMask: true,
    solver: { saveOutcomesPattern() { throw failure; } } }), e => e === failure);
});
test('single-mask WASM and geometry paths preserve ALL, aliases, bags, duplicates and long-queue fallback', async () => {
  const solver = await createWasmSolver(4), legacy = await createWasmSolver(4);
  legacy.saveOutcomesPattern = undefined;
  try {
    for (const pattern of ['T,*p3;T,*p3', 'TTJ,[I]p1;TTJ,*p1', 'TTJ,IIIIIIII,*p1']) {
      for (const useHold of [false, true]) for (const wantedSave of ['ALL', expressions.map((e, i) => `${e}#alias${i}`)]) {
        const input = { sourceFumen: COMPLETE, pattern, useHold, wantedSave };
        const reference = calculateSaves({ ...input, solver: legacy, singleSaveMask: false });
        assert.deepEqual(calculateSaves({ ...input, solver }), reference);
        assert.deepEqual(calculateSaves({ ...input, solver, singleSaveMask: true }), reference);
        assert.deepEqual(calculateSaves({ ...input, solver: legacy, singleSaveMask: true }), reference);
        assert.deepEqual(calculateSaves({ ...input, solver, singleSaveMask: true, outcomeCache: true }), reference);
      }
    }
    for (const singleSaveMask of [false, true]) assert.throws(() => calculateSaves({ sourceFumen: COMPLETE,
      pattern: 'T,*p3;TTJ,IIIIIIII,*p1', wantedSave: 'ALL', solver, singleSaveMask }), /equal queue length/);
  } finally { solver.close(); legacy.close(); }
});
test('mask path retains original complete-row placement count at all supported heights', async () => {
  for (let clear = 2; clear <= 6; clear++) {
    const solver = await createWasmSolver(clear);
    try {
      // Four empty cells: one I placement required despite existing complete rows.
      const sourceFumen = encoder.encode([{ field: Field.create('XXXXXXXXXX'.repeat(clear - 1) + 'XXXXXX____') }]);
      for (const useHold of [false, true]) for (const wantedSave of ['ALL', expressions]) {
        const input = { sourceFumen, clear, pattern: '*p2', wantedSave, useHold, solver };
        assert.deepEqual(calculateSaves(input), calculateSaves({ ...input, singleSaveMask: false }));
        assert.deepEqual(calculateSaves({ ...input, singleSaveMask: true }), calculateSaves({ ...input, singleSaveMask: false }));
      }
      const zero = encoder.encode([{ field: Field.create('XXXXXXXXXX'.repeat(clear)) }]);
      assert.deepEqual(calculateSaves({ sourceFumen: zero, clear, pattern: '*p1', wantedSave: 'ALL', solver, singleSaveMask: true }),
        calculateSaves({ sourceFumen: zero, clear, pattern: '*p1', wantedSave: 'ALL', solver, singleSaveMask: false }));
    } finally { solver.close(); }
  }
});
