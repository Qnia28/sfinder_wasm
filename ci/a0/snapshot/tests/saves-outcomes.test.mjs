import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';
import { decodeAndValidate } from '../src/pc-input.mjs';
import { expandPattern } from '../src/pattern.mjs';
import { popcount } from '../src/board.mjs';

const COMPLETE = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';
const LEGACY = 'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH';

function unpack(words, length) {
  const output = Array.from({ length }, () => new Set());
  for (let offset = 0; offset < words.length;) {
    const counts = words[offset++], n = words[offset++], end = offset + n;
    assert.ok(end <= words.length);
    for (; offset < end; offset++) output[words[offset]].add(counts);
  }
  return output.map(values => [...values].sort((a, b) => a - b));
}

function scalarReference(solver, board, queues, hold) {
  return queues.map(queue => [...new Set(solver.enumeratePc(board, queue, hold).map(solution =>
    solution.masks.reduce((counts, mask, piece) => counts | ((popcount(mask) / 4) << (piece * 4)), 0),
  ))].sort((a, b) => a - b));
}

test('outcome coverage agrees with scalar geometry for repeated, mixed-length and reordered queues', async () => {
  const solver = await createWasmSolver(4);
  const { board } = decodeAndValidate(COMPLETE, 4);
  const queues = [...expandPattern('T,*p3').reverse(), 'TTJ', 'TTIJ', 'TTIJ', 'T', '', 'TTIJOOOOOOOO'];
  try {
    for (const hold of [true, false]) {
      const expected = scalarReference(solver, board, queues, hold);
      const words = solver.saveOutcomesPattern(board, queues, hold);
      assert.deepEqual(unpack(words, queues.length), expected);
      solver.setProbabilityEngine('compressed', { maxLanguageNodes: 0 });
      assert.deepEqual(unpack(solver.saveOutcomesPattern(board, queues, hold), queues.length), expected,
        'exhausting the language budget must preserve every outcome');
      solver.setProbabilityEngine('auto');
      solver.saveOutcomesPattern(board, ['I'], hold);
      assert.deepEqual(unpack(words, queues.length), expected, 'returned buffer must own its memory');
    }
    assert.deepEqual(solver.saveOutcomesPattern(board, []), new Uint32Array());
  } finally { solver.close(); }
});

test('outcome coverage preserves complete rows at heights 2..6 and both Hold modes', async () => {
  for (let height = 2; height <= 6; height++) {
    const solver = await createWasmSolver(height);
    try {
      const full = (1n << BigInt(height * 10)) - 1n;
      for (let a = 0; a < height; a++) for (let b = a + 1; b < height; b++) {
        const board = full ^ (3n << BigInt(a * 10)) ^ (3n << BigInt(b * 10));
        const queues = ['O', 'I', 'IO', 'OI', 'OO', 'IO', 'OIIIIIIIIII'];
        for (const hold of [false, true]) {
          assert.deepEqual(unpack(solver.saveOutcomesPattern(board, queues, hold), queues.length),
            scalarReference(solver, board, queues, hold));
        }
      }
      assert.deepEqual(solver.saveOutcomesPattern(full, ['O']), new Uint32Array());
      assert.deepEqual(solver.saveOutcomesPattern(full ^ 1n, ['O']), new Uint32Array());
    } finally { solver.close(); }
  }
});

test('saves preserves all results, absence, conjunction, regex and multiplicity against legacy enumeration', async () => {
  const solver = await createWasmSolver(4), reference = await createWasmSolver(4);
  reference.saveOutcomesPattern = undefined;
  try {
    for (const [sourceFumen, pattern] of [[COMPLETE, 'T,*p3'], [LEGACY, 'T,[^TIL]!,*p2'],
      [COMPLETE, 'T,*p3;T,*p3'], [COMPLETE, 'TTJ,[I]p1;TTJ,*p1'],
      [COMPLETE, 'TTJ,IIIIIIII,*p1']]) {
      for (const useHold of [false, true]) for (const wantedSave of ['ALL', '^T,!T,SZ,S&&Z,TT,/TT/,I&&L,IJ']) {
        const input = { sourceFumen, pattern, useHold, wantedSave };
        assert.deepEqual(calculateSaves({ ...input, solver }), calculateSaves({ ...input, solver: reference }));
      }
    }
    const result = calculateSaves({ sourceFumen: COMPLETE, pattern: 'T,*p3', solver });
    assert.equal(result.success, 190);
    // Simulate an older WASM binary with the new JS wrapper: null selects compatibility enumeration.
    solver.saveOutcomesPattern = () => null;
    assert.deepEqual(calculateSaves({ sourceFumen: COMPLETE, pattern: 'T,*p3', solver }), result);
  } finally { solver.close(); reference.close(); }
});
