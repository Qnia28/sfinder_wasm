import test from 'node:test';
import assert from 'node:assert/strict';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { calculateSaves } from '../src/saves-feature.mjs';
import { decodeAndValidate } from '../src/pc-input.mjs';
import { popcount } from '../src/board.mjs';

const sourceFumen = 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH';
const display = 'TILJSZO', rust = 'IJLOSTZ';
test('B4: direct residuals preserve ordered duplicate IDs and independent scalar/packed oracles', async () => {
  const solver = await createWasmSolver(4);
  const { board } = decodeAndValidate(sourceFumen, 4);
  const queues = ['TTIJ', 'TTJI', 'TJII', 'ITJT', 'TTIJ'];
  try {
    assert.equal(typeof solver.e.solver_save_outcomes_mask, 'function', 'new export required for this gate');
    for (const useHold of [false, true]) for (const budget of [200000, 0]) {
      solver.setProbabilityEngine('auto', { maxLanguageNodes: budget });
      const direct = solver.saveOutcomesMask(board, queues, useHold);
      assert.equal(direct.length, queues.length);
      const scalar = queues.map(queue => {
        let mask = 0;
        for (const solution of solver.enumeratePc(board, queue, useHold)) {
          let unused = '', total = 0;
          for (const piece of display) {
            const remaining = [...queue].filter(p => p === piece).length - popcount(solution.masks[rust.indexOf(piece)]) / 4;
            assert.ok(remaining >= 0); total += remaining;
            if (remaining) unused = piece;
          }
          assert.equal(total, 1); mask |= 1 << display.indexOf(unused);
        }
        return mask;
      });
      assert.deepEqual([...direct], scalar);
      const packed = solver.saveOutcomesPattern(board, queues, useHold), expected = new Uint8Array(queues.length);
      for (let offset = 0; offset < packed.length;) {
        const used = packed[offset++], length = packed[offset++];
        for (let n = 0; n < length; n++) {
          const id = packed[offset++]; let total = 0;
          for (const piece of display) {
            const left = [...queues[id]].filter(p => p === piece).length - ((used >>> (4 * rust.indexOf(piece))) & 15);
            assert.ok(left >= 0); total += left;
            if (left) expected[id] |= 1 << display.indexOf(piece);
          }
          assert.equal(total, 1);
        }
      }
      assert.deepEqual(direct, expected);
    }
    const retained = solver.saveOutcomesMask(board, queues, true), snapshot = retained.slice();
    solver.saveOutcomesMask(board, ['IIII'], false);
    solver.e.memory.grow(1);
    assert.deepEqual(retained, snapshot);
    assert.deepEqual(solver.saveOutcomesMask(board, [], true), new Uint8Array());
    assert.deepEqual(solver.saveOutcomesMask(board, ['I'], true), Uint8Array.of(0));
    assert.equal(solver.saveOutcomesMask(board, ['TTI'], true), null);
    assert.equal(solver.saveOutcomesMask(board, ['TTIJ', 'TTIJI'], true), null);
  } finally { solver.close(); }
});

test('B4: missing or declining direct export falls back once; successful output never calls packed', () => {
  const input = { sourceFumen, pattern: 'TTJ,[I]p1', wantedSave: 'ALL' };
  for (const direct of [undefined, () => null, () => Uint8Array.of(1 << display.indexOf('I'))]) {
    let packedCalls = 0;
    const solver = { saveOutcomesMask: direct, saveOutcomesPattern() { packedCalls++; return new Uint32Array(); } };
    const result = calculateSaves({ ...input, solver });
    assert.equal(packedCalls, direct && direct() != null ? 0 : 1);
    assert.equal(result.success, packedCalls ? 0 : 1);
  }
  for (const output of [new Uint8Array(0), new Uint8Array(2), [1]]) {
    assert.throws(() => calculateSaves({ ...input, solver: { saveOutcomesMask() { return output; },
      saveOutcomesPattern() { assert.fail('invalid result must not silently fall back'); } } }), /invalid mask length or type/);
  }
  assert.throws(() => calculateSaves({ ...input, solver: { saveOutcomesPattern() { return Uint32Array.of(4, 1, 0); } } }), /more I|exactly one/);
});

test('B4: eager validation and lazy regex priority also hold with a direct solver', () => {
  for (const [wantedSave, throws, expectedCalls] of [['I&J', true, 0], ['/[/', true, 1], ['/[/', false, 1]]) {
    let calls = 0;
    const sentinel = new Error('direct search sentinel');
    const solver = { saveOutcomesMask(_board, queues) { calls++; if (throws) throw sentinel; return new Uint8Array(queues.length); },
      saveOutcomesPattern() { assert.fail('must not call packed'); } };
    assert.throws(() => calculateSaves({ sourceFumen, pattern: 'T,*p3', wantedSave, solver }),
      error => wantedSave === '/[/' && throws ? error === sentinel : error instanceof SyntaxError);
    assert.equal(calls, expectedCalls);
  }
});
