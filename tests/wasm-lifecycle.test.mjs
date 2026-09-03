import test from "node:test";
import assert from "node:assert/strict";
import { WasmPcSolver } from "../src/wasm-backend.mjs";

test("WasmPcSolver frees legal buffer and Rust solver when constructor legal load fails", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const freedBuffers = [];
  const freedSolvers = [];
  const exports = {
    memory,
    solver_new: () => 123,
    solver_free: (pointer) => freedSolvers.push(pointer),
    wasm_alloc: () => 64,
    wasm_dealloc: (pointer, length) => freedBuffers.push([pointer, length]),
    solver_load_legal_pack: () => 0,
  };
  const legal = Uint8Array.from([1, 2, 3, 4]);

  assert.throws(
    () => new WasmPcSolver(exports, 4, legal),
    /invalid legal-board pack/,
  );
  assert.deepEqual(freedBuffers, [[64, legal.length]]);
  assert.deepEqual(freedSolvers, [123]);
});
