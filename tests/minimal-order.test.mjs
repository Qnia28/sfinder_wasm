import test from "node:test";
import assert from "node:assert/strict";
import { orderMinimalKeysByCoverage } from "../src/minimal-order.mjs";

test("minimal output orders by coverage descending and key ascending on ties", () => {
  const coverage = new Map([
    ["q0", new Set(["b", "a"])],
    ["q1", new Set(["b", "c"])],
    ["q2", new Set(["a", "c"])],
    ["q3", new Set(["b"])],
  ]);
  const ordered = orderMinimalKeysByCoverage(["c", "a", "b"], coverage);
  assert.deepEqual(ordered.keys, ["b", "a", "c"]);
  assert.deepEqual(ordered.coverageCounts, [3, 2, 2]);
});
