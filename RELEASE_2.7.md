# sfinder-wasm Release 2.7 — 2026-09-03

Release 2.7 promotes the post-2.6 PATH, enumeration-performance, cross-command
routing, and structure-refactor work into one canonical release. The solver's
existing correctness contracts remain unchanged: primary minimum-cover
cardinality stays exact, coverage membership remains separate from human
quality, and specialized existence/full/PATH result profiles keep independently
benchmarked routing thresholds.

## New PATH feature

Release 2.7 adds a dedicated `path` Worker/runtime feature. It enumerates every
distinct reachable PC solution geometry for a queue pattern and emits Fumen
pages ordered by coverage descending, with stable solution-key tie breaking.
Page comments use:

```text
xx.xx% (covered/total)
```

Duplicate semicolon branches remain distinct analysis cases and therefore count
separately in both numerator and denominator.

Broad patterns use a PATH-only compact WASM result that materializes solution
geometry plus coverage counts without constructing per-case human-quality
objects. PATH routing is independently tuned to 64 cases on 4L and 4 cases on
5–6L.

## Enumeration and routing performance

### Concrete single-queue search

The shared concrete-queue engine used by `solve-one`, `solve-all`, and
`per-save-all` now:

- uses bounded linear lock dedup instead of allocating a HashSet per placement
  query;
- removes the redundant cached next-board array from `PlacementSet`;
- packs concrete structural-state keys as `u64` on <=4L and `u128` on the 5–6L
  compatibility path.

On the retained empty-4L `TIZLISOZJTO` 11-mino `per-save-all` workload, the
optimized implementation reduced representative runtime by about 9% while
preserving all 1,678 solutions and the exact output Fumen hash.

### Cross-command pattern reuse

Existing high-throughput pattern engines are now reused more broadly where
benchmark crossover justified it:

- broad 4L existence (`chance` / CoverPercent) can use the pattern-existence DAG
  from 2,048 cases;
- full enumeration switches at 64 cases on 4L and 8 cases on 5–6L;
- `fifth` uses the shared 4L full-enumeration threshold instead of its historical
  2,048-case scalar override;
- the integrated Rust Congruent accelerator is used through 10 operations rather
  than only through 4.

Scalar `canPcMany` and `enumeratePcMany` fallback paths also deduplicate repeated
concrete queues internally while remapping results back to original case
multiplicity.

These are result-profile-specific policies. Release 2.7 intentionally does not
collapse existence, full quality-bearing enumeration, and compact PATH output
onto one threshold or one generic materialization path.

## Structure refactor

Four behavior-preserving structure phases make the optimized paths maintainable
without replacing hot-path specialization with dynamic abstraction.

JavaScript responsibilities are now explicit:

```text
feature facade
  -> routing policy / PC enumeration engine
  -> specialized WASM ABI adapter
  -> Rust/WASM kernel
```

Notable boundaries include:

- `pc-routing-policy.mjs` for `existence`, `full`, and `path` profiles;
- `pc-enumeration-engine.mjs` for shared scalar/pattern dispatch and duplicate
  queue reuse;
- `wasm-backend.mjs` as lifecycle/public-class facade;
- focused raw enumeration, minimum-cover, compatibility, and CSR packing
  adapters;
- focused Chance/Saves/Minimals/Fifth/Per-save and Batch feature modules;
- `path-engine.mjs` and `highs-min-cover.mjs` retained as compatibility facades
  only.

Rust `pc-core` is split into board/piece/movement/legal/QueueTrie/DAG,
single-queue, pattern, queue-codec, reverse utility, and minimum-cover
responsibilities. `pc-wasm` and `batch-wasm` `lib.rs` files are thin module
facades while their existing exported WASM symbol set is preserved.

A more aggressive fixed-K minimum-cover source split was benchmarked and
reverted after showing a small hot-path slowdown. Release 2.7 therefore treats
source organization as subordinate to runtime performance.

## Lifecycle hardening

If legal-pack loading fails during `WasmPcSolver` construction after a Rust
solver has already been created, Release 2.7 now frees both the temporary WASM
allocation and the Rust solver pointer before rethrowing the original error.

## Compatibility retained

Release 2.7 preserves Release 2.6 contracts for:

- exact primary minimum cardinality;
- True/Fast human-quality semantics and stable-ID tie breaking;
- separate coverage membership and positive production `playableOrderCount`;
- saves multiplicity and duplicate queue-case semantics;
- T-spin continuous operation histories and Jstris/TETRIO I-piece behavior;
- 2–6 line first-order PC features and intentionally 4-line compound helpers;
- existing public `WasmPcSolver` convenience methods and historical compatibility
  facade exports.
