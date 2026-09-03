import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSaveOutcomeExpression } from '../src/saves.mjs';

function result(universe, expression) {
  return [...compileSaveOutcomeExpression(expression)(new Set(universe))].sort();
}

// Fixed black-box observations from the historical Python percent evaluator.
// These fixtures intentionally include mixed operators and modifier edge cases
// so the independent parser can change internally without changing behavior.
test('queue-level save expression engine preserves historical black-box behavior', () => {
  const cases = [
    [['I', 'J'], '^I', ['J']],
    [['I', 'J'], '!I', []],
    [['I', 'J'], 'I&&J', ['I', 'J']],
    [['S', 'T', 'TS', 'TT'], 'T&&(S||Z)', ['S', 'T', 'TS', 'TT']],
    [['S', 'T', 'TS', 'TT'], 'T||S&&Z', []],
    [['S', 'T', 'Z'], 'T||S&&Z', ['S', 'T', 'Z']],
    [['I', 'IJ', 'J', 'Z'], 'T&&S||Z', ['Z']],
    [['S', 'T', 'TS', 'TT'], '^/TT/', ['S', 'T', 'TS']],
    [['S', 'T', 'TS', 'TT'], '!/TT/', []],
    [['I', 'J'], '!/TT/', ['I', 'J']],
    [['S', 'T', 'TS', 'TT'], '^^T', ['T', 'TS', 'TT']],
    [['S', 'T', 'TS', 'TT'], '^!T', []],
    [[], '!T', []],
  ];
  for (const [universe, expression, expected] of cases) {
    assert.deepEqual(result(universe, expression), expected, expression);
  }
});
