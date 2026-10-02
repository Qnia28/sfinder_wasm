import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileSaveOutcomeExpression,
  compileExactSaveExpression,
} from '../src/saves.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';

const COMPLETE = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';
const PATTERN = 'IIIIIIII,[I]p1;IIIIIIII,[I]p1;IIIIIIII,[I]p1;IIIIIIII,[IJ]p1';
const QUEUE = 'IIIIIIIII';
const FAILED = 'IIIIIIIIJ';

test('compiled regex expressions retain queue-level set semantics across universes', () => {
  const cases = [
    ['/I/&&/J/', ['I', 'II', 'J']],
    ['/IJ/', []],
    ['^/I/', ['J', '']],
    ['!/I/', []],
    ['^(/I/&&/J/)', ['']],
    ['/I/||/J/&&/T/', []],
    ['/I/||(/J/&&/T/)', ['I', 'II']],
    ['/I{2}/', ['II']],
    ['/^$/', ['']],
  ];
  const universe = new Set(['I', 'II', 'J', '']);
  // AND returns the union of nonempty operands, not their intersection.
  for (const [expression, expected] of cases) {
    const evaluate = compileSaveOutcomeExpression(expression);
    assert.deepEqual(evaluate(universe), new Set(expected), expression);
    assert.deepEqual(evaluate(new Set()), new Set(), `${expression}, empty universe`);
    assert.deepEqual(evaluate(universe), new Set(expected), `${expression}, reused evaluator`);
  }
});

test('regex evaluator observes input mutation and returns independent mutable sets', () => {
  const evaluate = compileSaveOutcomeExpression('/I/');
  const universe = new Set(['I', 'J']);
  const first = evaluate(universe);
  first.clear();
  first.add('T');
  assert.deepEqual(universe, new Set(['I', 'J']));
  assert.deepEqual(evaluate(universe), new Set(['I']));
  universe.delete('I');
  universe.add('II');
  assert.deepEqual(evaluate(universe), new Set(['II']));
  assert.deepEqual(evaluate(universe), new Set(['II']));
});

test('regex syntax errors remain lazy and are not suppressed by empty outcomes or OR', () => {
  const evaluate = compileSaveOutcomeExpression('/[/');
  assert.throws(() => evaluate(new Set()), SyntaxError);
  assert.throws(() => evaluate(new Set(['I'])), SyntaxError);
  const afterSuccess = compileSaveOutcomeExpression('I||/[/');
  assert.throws(() => afterSuccess(new Set(['I'])), SyntaxError);
  const scalar = compileExactSaveExpression('/[/');
  assert.throws(() => scalar(0), SyntaxError);

  const failure = new Error('enumeration failed first');
  assert.throws(() => calculateSaves({
    sourceFumen: COMPLETE,
    pattern: '[I]p1',
    wantedSave: '/[/',
    solver: { saveOutcomesPattern() { throw failure; } },
  }), error => error === failure);
});

test('queue-level and scalar regex expressions keep distinct precedence and negation', () => {
  assert.equal(compileSaveOutcomeExpression('/I/||/J/&&/T/')(new Set(['I'])).size, 0);
  assert.equal(compileExactSaveExpression('/I/||/J/&&/T/')('I'), true);
  assert.deepEqual(compileSaveOutcomeExpression('!/I/')(new Set()), new Set());
  assert.deepEqual(compileSaveOutcomeExpression('!/I/')(new Set([''])), new Set(['']));
  const group = compileSaveOutcomeExpression('^(/I/&&/J/)');
  assert.deepEqual(group(new Set(['I'])), new Set(['I']));
  assert.deepEqual(group(new Set(['I', 'J'])), new Set());
});

// This solver fixture isolates JS aggregation with one or nine used Is.
// It does not claim these queues solve COMPLETE's physical board.
function outcomeSolver() {
  return {
    saveOutcomesPattern(_board, queues) {
      assert.deepEqual(queues, [QUEUE, QUEUE, QUEUE, QUEUE, FAILED]);
      return Uint32Array.of(9, 3, 0, 2, 3, 1, 1, 1);
    },
  };
}

test('ALL aggregation preserves empty saves, string fallback and branch multiplicity', () => {
  const result = calculateSaves({
    sourceFumen: COMPLETE,
    pattern: PATTERN,
    wantedSave: 'ALL',
    solver: outcomeSolver(),
  });
  assert.equal(result.total, 5);
  assert.equal(result.success, 4);
  assert.deepEqual(result.failedQueues, [FAILED]);
  assert.deepEqual(result.saveResults, [
    { save: '', success: 2, total: 5, percent: 40 },
    { save: 'IIIIIIII', success: 1, total: 5, percent: 20 },
    { save: 'J', success: 1, total: 5, percent: 20 },
  ]);
});

test('expression aggregation retains aliases and repeated failed queues across requests', () => {
  const input = {
    sourceFumen: COMPLETE,
    pattern: PATTERN,
    wantedSave: '/^$/#empty,/I{8}/#long,J#bag',
    solver: outcomeSolver(),
  };
  const first = calculateSaves(input);
  assert.deepEqual(first.wantedSaveResults.map(({ saveAlias, success, failedQueues }) =>
    ({ saveAlias, success, failedQueues })), [
    { saveAlias: 'empty', success: 2, failedQueues: [QUEUE, QUEUE, FAILED] },
    { saveAlias: 'long', success: 1, failedQueues: [QUEUE, QUEUE, QUEUE, FAILED] },
    { saveAlias: 'bag', success: 1, failedQueues: [QUEUE, QUEUE, QUEUE, FAILED] },
  ]);
  first.wantedSaveResults[0].failedQueues.length = 0;
  const next = calculateSaves(input);
  assert.deepEqual(next.wantedSaveResults[0].failedQueues, [QUEUE, QUEUE, FAILED]);
});
