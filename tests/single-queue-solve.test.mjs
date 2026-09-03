import test from "node:test";
import assert from "node:assert/strict";
import { decoder } from "tetris-fumen";
import { createWasmSolver } from "../src/wasm-backend.mjs";
import { preferredSolution } from "../src/human-ranking.mjs";
import { decodeAndValidate } from "../src/pc-input.mjs";
import { solveAllPc, solveOnePc, solvePerSaveAllPc } from "../src/pc-solve.mjs";
import { runWorkerRequest } from "../src/worker-runtime.mjs";

const FIVE_LINE = "v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH";

test("bulk solution export preserves masks/orderCount and exact bestPc ranking", async () => {
  const solver = await createWasmSolver(4);
  try {
    assert.equal(typeof solver.e.solver_copy_solution_words, "function");
    assert.equal(Number(solver.e.solver_solution_word_stride()), 9);
    const board = 0x3c0f03c0fn;
    const queue = "OJILSZT";
    const all = solver.enumeratePc(board, queue, true);
    assert.equal(all.length, 44);
    const expected = preferredSolution(all);
    const best = solver.bestPc(board, queue, true);
    assert.equal(best.key, expected.key);
    assert.equal(best.orderCount, expected.orderCount);
    assert.ok(all.every((solution) => Number.isInteger(solution.saved)));
  } finally {
    solver.close();
  }
});

test("single-queue wrappers support 5-line one/all/per-save-all with shared backend", async () => {
  const solver = await createWasmSolver(5);
  try {
    const { board } = decodeAndValidate(FIVE_LINE, 5);
    const exactQueue = "TOILJS";
    const allRaw = solver.enumeratePc(board, exactQueue, true);
    const expectedBest = preferredSolution(allRaw);

    const one = solveOnePc({
      sourceFumen: FIVE_LINE,
      pattern: exactQueue,
      targetLines: 5,
      title: "one",
      solver,
    });
    assert.equal(one.solutionCount, 1);
    assert.equal(one.solutionKey, expectedBest.key);
    assert.equal(one.playableOrderCount, expectedBest.orderCount);
    assert.equal(decoder.decode(one.fumen).length, 2);

    const all = solveAllPc({
      sourceFumen: FIVE_LINE,
      pattern: exactQueue,
      targetLines: 5,
      title: "all",
      solver,
    });
    assert.equal(all.solutionCount, allRaw.length);
    assert.equal(decoder.decode(all.fumen).length, allRaw.length + 1);

    const perSaveRaw = solver.enumeratePc(board, "TOILJSZ", true);
    const perSave = solvePerSaveAllPc({
      sourceFumen: FIVE_LINE,
      pattern: "TOILJSZ",
      targetLines: 5,
      title: "per-save-all",
      solver,
    });
    assert.equal(perSave.solutionCount, perSaveRaw.length);
    assert.equal(Object.values(perSave.pageCounts).reduce((a, b) => a + b, 0), perSaveRaw.length);
    assert.equal(decoder.decode(perSave.fumen).length, perSaveRaw.length + 1);
  } finally {
    solver.close();
  }
});

test("worker runtime exposes the same dedicated single-queue wrappers", async () => {
  const one = await runWorkerRequest({
    kind: "solve-one",
    input: {
      sourceFumen: FIVE_LINE,
      pattern: "TOILJS",
      targetLines: 5,
      title: "worker",
    },
  });
  assert.equal(one.targetLines, 5);
  assert.equal(one.solutionCount, 1);
  assert.ok(one.fumen);

  const perSave = await runWorkerRequest({
    kind: "per-save-all",
    input: {
      sourceFumen: FIVE_LINE,
      pattern: "TOILJSZ",
      targetLines: 5,
      title: "worker",
    },
  });
  assert.equal(perSave.targetLines, 5);
  assert.equal(Object.values(perSave.pageCounts).reduce((a, b) => a + b, 0), perSave.solutionCount);
});


test("solve-one rejects a returned solution without positive playableOrderCount", () => {
  const masks = Array(7).fill(0n);
  const solver = {
    bestPc() { return { key: "bad", masks, orderCount: 0 }; },
  };
  assert.throws(() => solveOnePc({
    sourceFumen: FIVE_LINE,
    pattern: "TOILJS",
    targetLines: 5,
    solver,
  }), /playableOrderCount must be an integer number in 1/);
});
