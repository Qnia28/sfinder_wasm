import test from 'node:test';
import assert from 'node:assert/strict';
import { FOURTH_TARGET_LINES, calculateFourthDistribution, validateFourthInput } from '../src/fourth.mjs';
import { runWorkerRequest } from '../src/worker-runtime.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';

const BOARD = 'v115@9gwhQ4HewhR4Gewhg0Q4BtEewhi0BtNeAgH';
const VALID = { sourceFumen: BOARD, hold: 'T', nextPair: 'TO' };

// #14 must run before the Worker picks a solver height. This is the FIRST test
// in this file, so no WASM asset has been loaded yet in this process: building
// any solver would have to cross a real asynchronous I/O boundary. Racing the
// request against a macrotask therefore distinguishes "rejected at the feature
// boundary" from "rejected after a solver was initialized".
test('a malformed fourth request is rejected before any solver is initialized', async () => {
  const afterMacrotask = new Promise((resolve) => { setImmediate(() => resolve('solver-initialization-started')); });
  const outcome = await Promise.race([
    runWorkerRequest({ kind: 'fourth', input: { ...VALID, clear: 5 } })
      .then(() => 'completed-with-mismatched-geometry', (error) => error.name),
    afterMacrotask,
  ]);
  assert.equal(outcome, 'FourthValidationError');
});

test('validateFourthInput checks clear and height independently', () => {
  assert.equal(validateFourthInput({}), FOURTH_TARGET_LINES);
  assert.equal(validateFourthInput({ clear: 4 }), 4);
  assert.equal(validateFourthInput({ height: 4 }), 4);
  assert.equal(validateFourthInput({ clear: 4, height: 4 }), 4);
  assert.equal(validateFourthInput({ clear: undefined, height: null }), 4);

  assert.throws(() => validateFourthInput({ clear: 5 }), { name: 'FourthValidationError', message: /clear=5/ });
  assert.throws(() => validateFourthInput({ clear: 3 }), { name: 'FourthValidationError', message: /clear=3/ });
  assert.throws(() => validateFourthInput({ height: 5 }), { name: 'FourthValidationError', message: /height=5/ });
  assert.throws(() => validateFourthInput({ height: 2 }), { name: 'FourthValidationError', message: /height=2/ });
});

test('validateFourthInput rejects contradictory clear/height pairs', () => {
  // Each pair disagrees with the fixed contract on at least one member, and the
  // rejection names the offending member.
  assert.throws(() => validateFourthInput({ clear: 4, height: 5 }), { name: 'FourthValidationError', message: /height=5/ });
  assert.throws(() => validateFourthInput({ clear: 5, height: 4 }), { name: 'FourthValidationError', message: /clear=5/ });
  assert.throws(() => validateFourthInput({ clear: 3, height: 5 }), { name: 'FourthValidationError', message: /clear=3/ });
  assert.throws(() => validateFourthInput({ clear: '4', height: 4 }), { name: 'FourthValidationError', message: /clear="4"/ });
});

test('the worker rejects every unsupported fourth geometry', async () => {
  for (const input of [{ clear: 5 }, { height: 5 }, { clear: 4, height: 5 }, { clear: 5, height: 4 }]) {
    await assert.rejects(
      runWorkerRequest({ kind: 'fourth', input: { ...VALID, ...input } }),
      { name: 'FourthValidationError' },
      JSON.stringify(input),
    );
  }
});

test('every valid 4-line fourth request is preserved', async () => {
  const golden = {
    pathPattern: 'T,T,O,[LJISZ]p4',
    savePattern: 'T,T,O,[^TO]p4',
    counts: [20, 2, 0, 11, 28, 22, 0, 33, 0, 3, 1, 0, 0],
  };
  for (const extra of [{}, { clear: 4 }, { height: 4 }, { clear: 4, height: 4 }]) {
    const r = await runWorkerRequest({ kind: 'fourth', input: { ...VALID, ...extra } });
    assert.equal(r.pathPattern, golden.pathPattern, JSON.stringify(extra));
    assert.equal(r.savePattern, golden.savePattern, JSON.stringify(extra));
    assert.deepEqual([r.solved, r.total], [120, 120], JSON.stringify(extra));
    assert.deepEqual(r.ranks.map((x) => x.count), golden.counts, JSON.stringify(extra));
  }
});

test('the feature boundary itself validates, not only the worker', async () => {
  const solver = await createWasmSolver(4);
  try {
    assert.throws(() => calculateFourthDistribution({ ...VALID, solver, clear: 5 }), { name: 'FourthValidationError' });
    const r = calculateFourthDistribution({ ...VALID, solver, clear: 4 });
    assert.deepEqual([r.solved, r.total], [120, 120]);
  } finally { solver.close(); }
});
