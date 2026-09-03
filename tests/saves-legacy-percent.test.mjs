import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { calculateSaves } from '../src/features.mjs';
import { evaluateSaveOutcomeExpression } from '../src/saves.mjs';

const FUMEN = 'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH';
const PATTERN = 'T,[^TIL]!,*p2';

test('legacy ezsaves aggregate operators distinguish ^ from ! and concatenation from &&', () => {
  const outcomes = new Set(['I', 'J']);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, '^I'), true);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, '!I'), false);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, 'IJ'), false);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, 'I&&J'), true);
});

test('legacy ezsaves aggregate evaluator preserves duplicate save pieces', () => {
  const outcomes = new Set(['T', 'TT']);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, 'TT'), true);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, '/TT/'), true);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, '^TT'), true);
  assert.equal(evaluateSaveOutcomeExpression(outcomes, '!TT'), false);
});

test('calculateSaves matches legacy ezsaves percent semantics on the 1008-case fixture', async () => {
  const solver = await createWasmSolver(4);
  try {
    const expected = new Map([
      ['^T', 288],
      ['!T', 0],
      ['SZ', 960],
      ['S&&Z', 1008],
      ['TT', 152],
      ['/TT/', 152],
      ['I&&L', 1008],
    ]);
    for (const [wantedSave, success] of expected) {
      const result = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave, solver });
      assert.equal(result.total, 1008);
      assert.equal(result.success, success, wantedSave);
    }
  } finally {
    solver.close();
  }
});

test('calculateSaves without a save expression lists all exact legacy save outcomes', async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, solver });
    assert.equal(result.total, 1008);
    assert.equal(result.success, 1008);
    assert.equal(result.saveResults.length, 46);
    const duplicate = result.saveResults.find(({ save }) => save === 'TTILSZ');
    assert.deepEqual({ save: duplicate.save, success: duplicate.success, total: duplicate.total },
      { save: 'TTILSZ', success: 20, total: 1008 });
    assert.equal(duplicate.percent.toFixed(2), '1.98');
    const common = result.saveResults.find(({ save }) => save === 'TILJSZ');
    assert.deepEqual({ save: common.save, success: common.success, total: common.total },
      { save: 'TILJSZ', success: 288, total: 1008 });
    assert.equal(common.percent.toFixed(2), '28.57');
  } finally {
    solver.close();
  }
});

test('wantedSave=ALL selects the same all-outcomes mode', async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave: 'ALL', solver });
    assert.equal(result.saveResults.length, 46);
    assert.equal(result.success, 1008);
  } finally {
    solver.close();
  }
});

test('calculateSaves supports expr#alias without changing legacy evaluation', async () => {
  const solver = await createWasmSolver(4);
  try {
    const plain = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave: 'TT', solver });
    const aliased = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave: 'TT#T>X', solver });
    assert.equal(aliased.success, plain.success);
    assert.equal(aliased.success, 152);
    assert.equal(aliased.saveExpression, 'TT');
    assert.equal(aliased.saveAlias, 'T>X');
    assert.equal(aliased.saveLabel, 'T>X');
  } finally {
    solver.close();
  }
});

test('calculateSaves evaluates multiple wanted expressions in one shared call', async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculateSaves({
      sourceFumen: FUMEN,
      pattern: PATTERN,
      wantedSave: '^T,!T,SZ,S&&Z,TT#T>X',
      solver,
    });
    assert.equal(result.total, 1008);
    assert.equal(result.success, undefined);
    assert.equal(result.wantedSaveResults.length, 5);
    assert.deepEqual(result.wantedSaveResults.map(({ saveExpression, saveLabel, success }) => ({ saveExpression, saveLabel, success })), [
      { saveExpression: '^T', saveLabel: '^T', success: 288 },
      { saveExpression: '!T', saveLabel: '!T', success: 0 },
      { saveExpression: 'SZ', saveLabel: 'SZ', success: 960 },
      { saveExpression: 'S&&Z', saveLabel: 'S&&Z', success: 1008 },
      { saveExpression: 'TT', saveLabel: 'T>X', success: 152 },
    ]);
  } finally {
    solver.close();
  }
});

test('calculateSaves preserves comma quantifiers inside regex wanted-save expressions', async () => {
  const solver = await createWasmSolver(4);
  try {
    const single = calculateSaves({
      sourceFumen: FUMEN,
      pattern: PATTERN,
      wantedSave: '/O{0,1}/',
      solver,
    });
    assert.equal(single.percent, 100);

    const multiple = calculateSaves({
      sourceFumen: FUMEN,
      pattern: PATTERN,
      wantedSave: '/O{0,1}/,TT',
      solver,
    });

    assert.deepEqual(
      multiple.wantedSaveResults.map(({ saveExpression }) => saveExpression),
      ['/O{0,1}/', 'TT'],
    );
  } finally {
    solver.close();
  }
});

test('calculateSaves also accepts an array of wanted expressions', async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave: ['I&&L', 'JO', 'J&&O'], solver });
    assert.deepEqual(result.wantedSaveResults.map(({ saveExpression, success }) => [saveExpression, success]), [
      ['I&&L', 1008],
      ['JO', 960],
      ['J&&O', 1008],
    ]);
  } finally {
    solver.close();
  }
});

test('calculateSaves rejects mixing ALL with requested expressions', async () => {
  const solver = await createWasmSolver(4);
  try {
    assert.throws(() => calculateSaves({ sourceFumen: FUMEN, pattern: PATTERN, wantedSave: 'ALL,T', solver }), /ALL cannot be combined/);
  } finally {
    solver.close();
  }
});
