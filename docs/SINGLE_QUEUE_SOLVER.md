# Single-queue solver

`src/pc-solve.mjs` is the application-facing entry point for an exact concrete
queue. It keeps input validation, ranking, Fumen generation, and Rust/WASM
selection policy inside sfinder-wasm rather than duplicating those rules in a
consumer application.

## Operations

- `solveOnePc()` / Worker `solve-one`: queue length is exactly `piecesNeeded`.
  Rust selects one exact preferred solution by maximum playable-order count,
  then lexicographic solution key.
- `solveAllPc()` / Worker `solve-all`: queue length is exactly `piecesNeeded`.
  Every distinct solution is returned as Fumen pages.
- `solvePerSaveAllPc()` / Worker `per-save-all`: queue length is
  `piecesNeeded + 1`. Every distinct solution is grouped by its one unused
  (saved) piece.

All three accept `targetLines` (or the compatible `clear` alias) from 2 through
6 and the normal `useHold` option.

## Shared engine layers

The public wrappers do not own search algorithms. Search policy is split into
shared layers:

1. `pc-input.mjs` validates Fumen geometry and exact queue length.
2. `pc-routing-policy.mjs` owns the validated execution profiles and crossover
   thresholds.
3. `pc-enumeration-engine.mjs` owns scalar-vs-pattern dispatch, duplicate queue
   reuse and case visitation for matrix features.
4. `pc-core` owns placement reachability, line-clear normalization, Hold state,
   flat structural DAG traversal, and solution/order reconstruction.
5. `wasm-backend.mjs` owns queue packing and WASM result materialization.
6. Feature modules apply only feature-specific coverage/save/minimum-cover
   interpretation.

Broad 5-6 line pattern features consume raw pattern rows directly in their hot
loops. This deliberately avoids a generic per-hit callback layer while keeping
the expensive solver dispatch and search implementation shared.

## 4-line fast path

The 4-line solver keeps the existing legal-board pack, stage-8 pair oracle, and
stage-9 exact finishing oracle. The single-queue cleanup does not replace or
disable those optimizations.
