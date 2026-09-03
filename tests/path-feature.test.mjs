import test from "node:test";
import assert from "node:assert/strict";
import { decoder } from "tetris-fumen";
import { boardFromFumenPage } from "../src/board.mjs";
import { calculatePath, encodePathFumen } from "../src/path-core.mjs";
import { calculatePathFeature } from "../src/path-feature.mjs";
import { expandPattern } from "../src/pattern.mjs";
import { createWasmSolver } from "../src/wasm-backend.mjs";

const FUMEN = "v115@9gglIeglHewwhlzhBexwzhEewwJeAgH";

function expectedComment(count, total) {
  return `${(count / total * 100).toFixed(2)}% (${count}/${total})`;
}

test("path scalar engine deduplicates solutions and orders by coverage descending", async () => {
  const solver = await createWasmSolver(4);
  try {
    const candidates = expandPattern("*p7");
    const board = boardFromFumenPage(decoder.decode(FUMEN)[0], 4);
    let queues = null;
    for (let left = 0; left < 30 && !queues; left += 1) {
      const leftKeys = new Set(solver.enumeratePc(board, candidates[left], true).map((row) => row.key));
      if (leftKeys.size === 0) continue;
      for (let right = left + 1; right < 30; right += 1) {
        const rightRows = solver.enumeratePc(board, candidates[right], true);
        if (rightRows.some((row) => leftKeys.has(row.key))) {
          queues = [candidates[left], candidates[right]];
          break;
        }
      }
    }
    assert.ok(queues, "expected representative queues with overlapping PC geometry");

    const calculation = calculatePath({
      sourceFumen: FUMEN,
      analysisPattern: queues.join(";"),
      solver,
      height: 4,
    });
    assert.equal(calculation.backend, "scalar");
    assert.equal(calculation.total, 2);
    for (let index = 1; index < calculation.coverageCounts.length; index += 1) {
      assert.ok(calculation.coverageCounts[index - 1] >= calculation.coverageCounts[index]);
      if (calculation.coverageCounts[index - 1] === calculation.coverageCounts[index]) {
        assert.ok(calculation.solutions[index - 1].key.localeCompare(calculation.solutions[index].key) <= 0);
      }
    }
    assert.equal(calculation.coverageCounts[0], 2);

    const pages = decoder.decode(encodePathFumen(calculation));
    assert.equal(pages.length, calculation.solutions.length);
    assert.equal(pages[0].comment, "100.00% (2/2)");
  } finally {
    solver.close();
  }
});

test("path compact pattern adapter preserves generic pattern coverage counts", async () => {
  const solver = await createWasmSolver(4);
  try {
    const board = boardFromFumenPage(decoder.decode(FUMEN)[0], 4);
    const queues = expandPattern("*p7").slice(0, 128);
    const generic = solver.enumeratePcPattern(board, queues, true);
    const compact = solver.enumeratePcPath(board, queues, true);
    assert.ok(compact);
    const expected = generic
      .map((solution) => [solution.key, solution.coverage.length])
      .sort(([left], [right]) => left.localeCompare(right));
    const actual = compact.solutions
      .map((solution, index) => [solution.key, compact.coverageCounts[index]])
      .sort(([left], [right]) => left.localeCompare(right));
    assert.deepEqual(actual, expected);
  } finally {
    solver.close();
  }
});

test("5-line path uses the PATH-specific packed threshold and preserves scalar coverage", async () => {
  const sourceFumen = "v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH";
  const queues = expandPattern("*p7").slice(0, 4);
  const solver = await createWasmSolver(5);
  try {
    const result = calculatePathFeature({
      sourceFumen,
      pattern: queues.join(";"),
      clear: 5,
      solver,
      useHold: true,
    });
    assert.equal(result.backend, "pattern");
    assert.equal(result.total, 4);

    const board = boardFromFumenPage(decoder.decode(sourceFumen)[0], 5);
    const expectedCounts = new Map();
    for (const queue of queues) {
      for (const solution of solver.enumeratePc(board, queue, true)) {
        expectedCounts.set(solution.key, (expectedCounts.get(solution.key) ?? 0) + 1);
      }
    }
    const expected = [...expectedCounts.values()].sort((left, right) => right - left);
    assert.deepEqual([...result.coverageCounts].sort((left, right) => right - left), expected);
  } finally {
    solver.close();
  }
});

test("path broad pattern uses batch engine and emits coverage-sorted Fumen comments", async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculatePathFeature({
      sourceFumen: FUMEN,
      pattern: "*p7",
      clear: 4,
      solver,
      useHold: true,
    });
    assert.equal(result.backend, "pattern");
    assert.equal(result.total, 5040);
    assert.equal(result.solutionCount, 47);
    assert.equal(result.coverageCounts[0], 1656);
    for (let index = 1; index < result.coverageCounts.length; index += 1) {
      assert.ok(result.coverageCounts[index - 1] >= result.coverageCounts[index]);
    }

    const pages = decoder.decode(result.fumen);
    assert.equal(pages.length, result.solutionCount);
    assert.equal(pages[0].comment, expectedComment(result.coverageCounts[0], result.total));
    assert.equal(pages.at(-1).comment, expectedComment(result.coverageCounts.at(-1), result.total));
  } finally {
    solver.close();
  }
});

test("worker-visible path contract preserves duplicate branch multiplicity in coverage", async () => {
  const solver = await createWasmSolver(4);
  try {
    const result = calculatePathFeature({
      sourceFumen: FUMEN,
      pattern: "TIJLOZS;TIJLOZS",
      clear: 4,
      solver,
      useHold: true,
    });
    assert.equal(result.total, 2);
    assert.ok(result.coverageCounts.every((count) => count === 2));
    const pages = decoder.decode(result.fumen);
    assert.ok(pages.every((page) => page.comment === "100.00% (2/2)"));
  } finally {
    solver.close();
  }
});
