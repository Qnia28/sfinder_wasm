import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSaveExpression, compileExactSaveExpression, prepareSaveCase, saveCacheSnapshot } from '../src/saves.mjs';

test('A4: FIFO global maps bound entries while evicted live predicates remain exact', () => {
  const retained = [];
  for (let n = 0; n < 1024; n++) {
    const expression = `/^I{${n}}$/`;
    const predicate = compileExactSaveExpression(expression);
    if (n < 8) retained.push(predicate);
    compileSaveExpression(expression);
    prepareSaveCase('I'.repeat(n) + 'T', 'I'.repeat(n) + ',*p1');
  }
  const snapshot = saveCacheSnapshot();
  for (const key of ['expressionTables', 'exactExpressionPredicates', 'bagInfoCache']) {
    assert.equal(snapshot[key].entries, 512);
    assert.ok(snapshot[key].maxKeyChars <= 4096);
  }
  retained.forEach((run, n) => { assert.equal(run('I'.repeat(n)), true); assert.equal(run('T'), false); });
});

test('A4: per-predicate FIFO and oversize-key bypass preserve exact results', () => {
  const run = compileExactSaveExpression('/I/');
  for (let n = 0; n < 4096; n++) assert.equal(run('I'.repeat(n)), n > 0);
  assert.equal(saveCacheSnapshot(run).memo.entries, 256);
  for (const size of [4096, 4097, 65536]) {
    assert.equal(run('I'.repeat(size)), true);
    assert.ok(saveCacheSnapshot(run).memo.maxKeyChars <= 4096);
    const before = saveCacheSnapshot().exactExpressionPredicates.entries;
    const predicate = compileExactSaveExpression('I'.repeat(size));
    assert.equal(predicate('I'.repeat(size)), true);
    assert.equal(predicate('I'.repeat(size - 1)), false);
    if (size > 4096) assert.equal(saveCacheSnapshot().exactExpressionPredicates.entries, before);
    compileSaveExpression('I'.repeat(size));
    assert.ok(saveCacheSnapshot().expressionTables.maxKeyChars <= 4096);
    prepareSaveCase('I'.repeat(size) + 'T', 'I'.repeat(size) + ',*p1');
    assert.ok(saveCacheSnapshot().bagInfoCache.maxKeyChars <= 4096);
  }
});

test('A4: failed construction/evaluation do not retain invalid results; caller metadata stays live', () => {
  const before = saveCacheSnapshot();
  assert.throws(() => compileExactSaveExpression('I&J'), SyntaxError);
  assert.throws(() => compileSaveExpression('/[/'), SyntaxError);
  assert.deepEqual(saveCacheSnapshot(), before);
  const run = compileExactSaveExpression('/[/');
  for (let i = 0; i < 2; i++) assert.throws(() => run('I'), SyntaxError);
  assert.equal(saveCacheSnapshot(run).memo.entries, 0);
  const metadata = { pieces: new Set(['I', 'T']), drawCount: 1 };
  const first = prepareSaveCase('T', metadata);
  metadata.pieces.delete('I');
  assert.notEqual(prepareSaveCase('T', metadata).baseSavedMask, first.baseSavedMask);
});
