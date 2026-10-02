import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaves } from '../src/saves-feature.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { compileSaveExpression, compileExactSaveExpression, prepareSaveCase, saveCacheSnapshot } from '../src/saves.mjs';

const COMPLETE = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';

test('A5+A4: real baseline WASM results and aliases survive cache churn and live predicate eviction', async () => {
  const solver = await createWasmSolver(4);
  try {
    const input = { sourceFumen: COMPLETE, pattern: 'T,*p3;T,*p3', wantedSave: '/#/#hash,I#literal,/I/#regex', solver };
    const before = calculateSaves(input);
    const retained = compileExactSaveExpression('/I/#retained');
    for (let n = 0; n < 1024; n++) {
      compileSaveExpression(`/^I{${n}}$/`);
      compileExactSaveExpression(`/^I{${n}}$/#alias${n}`);
      prepareSaveCase('I'.repeat(n) + 'T', 'I'.repeat(n) + ',*p1');
    }
    for (let n = 0; n < 4096; n++) assert.equal(retained('I'.repeat(n)), n > 0);
    assert.equal(retained('I'.repeat(65536)), true);
    assert.equal(retained('T'), false);
    assert.ok(saveCacheSnapshot(retained).memo.entries <= 256);
    assert.ok(saveCacheSnapshot(retained).memo.maxKeyChars <= 4096);
    for (const key of ['expressionTables', 'exactExpressionPredicates', 'bagInfoCache']) {
      assert.ok(saveCacheSnapshot()[key].entries <= 512);
    }
    assert.deepEqual(calculateSaves(input), before);
    assert.deepEqual(calculateSaves({ ...input, singleSaveMask: false }), before);
    assert.deepEqual(calculateSaves({ ...input, wantedSave: ['/#/#hash', 'I#literal', '/I/#regex'] }), before);
    assert.equal(before.total, 420);
    assert.deepEqual(before.wantedSaveResults.map(row => row.saveAlias), ['hash', 'literal', 'regex']);
  } finally { solver.close(); }
});
