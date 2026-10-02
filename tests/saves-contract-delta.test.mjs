import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSaveExpressionSpec, compileSaveOutcomeExpression, compileSaveOutcomeMaskExpression, compileExactSaveExpression } from '../src/saves.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';

const COMPLETE = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';
const parsers = [
  ['I', 'I', null], [' I#tag ', 'I', 'tag'], ['I#alias#extra', 'I', 'alias#extra'],
  ['/#/', '/#/', null], ['/a#b/', '/a#b/', null], ['/a#b/#tag', '/a#b/', 'tag'],
  ['/[A-Z#]+/', '/[A-Z#]+/', null], ['/a\\/#b/#tag', '/a\\/#b/', 'tag'],
  ['/a\\\\/#tag', '/a\\\\/', 'tag'], ['/#/#', '/#/', ''], ['/a#b', '/a#b', null],
  ['^(/#/)#tag', '^(/#/)', 'tag'], ['I||/#/#mix', 'I||/#/', 'mix'], ['I\\#tag', 'I\\#tag', null],
];
test('A5: alias delimiters ignore escaped characters and regex bodies', () => {
  for (const [raw, expression, alias] of parsers) {
    assert.deepEqual(parseSaveExpressionSpec(raw), { raw: raw.trim(), expression, alias, label: alias || expression });
  }
  for (const input of ['#tag', '']) assert.throws(() => parseSaveExpressionSpec(input), SyntaxError);
  assert.throws(() => compileSaveOutcomeExpression('/a#b'), /Missing ending/);
  assert.throws(() => compileSaveOutcomeExpression('I\\#tag'), /unknown character/);
  for (const compile of [compileSaveOutcomeExpression, compileExactSaveExpression]) {
    const run = compile('/#/#tag');
    if (compile === compileSaveOutcomeExpression) assert.equal(run(new Set(['I'])).size, 0);
    else assert.equal(run('I'), false);
  }
  assert.equal(compileSaveOutcomeMaskExpression('/#/#tag')(['I'])(1), 0);
});

test('F0: structural errors precede search; lazy regex errors do not', () => {
  for (const singleSaveMask of [true, false]) {
    for (const [wantedSave, throws, expectedCalls] of [['I&J', true, 0], ['/[/', true, 1], ['/[/', false, 1], ['ALL,I', true, 0]]) {
      let calls = 0;
      const sentinel = new Error('search sentinel');
      const solver = { saveOutcomesPattern() { calls++; if (throws) throw sentinel; return new Uint32Array(); } };
      assert.throws(() => calculateSaves({ sourceFumen: COMPLETE, pattern: 'T,*p3', wantedSave, solver, singleSaveMask }),
        error => wantedSave === '/[/' && throws ? error === sentinel : error instanceof SyntaxError);
      assert.equal(calls, expectedCalls);
    }
  }
});

test('F0: clear, board and pattern validation retain their earlier priority', () => {
  const solver = { saveOutcomesPattern() { assert.fail('search called after invalid input'); } };
  for (const [clear, pattern, expected] of [[1, 'T,*p3', /clear height|clear.*2.*6/i],
    [2, 'T,*p3', /height|exceeds/i], [4, '[^TT]p1', /duplicate|pattern/i],
    [4, 'T,*p3;TTJ,IIIIIIII,*p1', /equal queue length/]]) {
    assert.throws(() => calculateSaves({ sourceFumen: COMPLETE, clear, pattern, wantedSave: 'I&J', solver }), expected);
  }
});

test('A5: string and array aliases agree on feature paths, including lazy regex hashes', () => {
  for (const singleSaveMask of [true, false]) {
    const solver = { saveOutcomesPattern() { return new Uint32Array(); } };
    const input = { sourceFumen: COMPLETE, pattern: 'T,*p3', solver, singleSaveMask };
    for (const wantedSave of ['/#/', '/#/#hash', 'I#tag', '/a\\/#b/#tag']) {
      const result = calculateSaves({ ...input, wantedSave });
      assert.equal(result.success, 0);
      assert.equal(result.saveAlias, parseSaveExpressionSpec(wantedSave).alias);
    }
    assert.deepEqual(calculateSaves({ ...input, wantedSave: '/#/#hash,I#i' }),
      calculateSaves({ ...input, wantedSave: ['/#/#hash', 'I#i'] }));
  }
});
