# Changelog

## Unreleased

_No changes yet._

## 2.7 — 2026-09-03

- Finish the Phase 4 maintainability cleanup without changing solver semantics:
  internal production modules now import focused enumeration/minimum-cover modules
  directly, while `path-engine.mjs` and `highs-min-cover.mjs` remain compatibility
  facades only.
- Separate high-level `WasmPcSolver` compatibility routing into
  `pc-wasm-compat.mjs`; `pc-wasm-enumeration.mjs` now contains only enumeration
  ABI primitives.
- Centralize minimum-cover CSR packing and temporary u32 WASM buffers in
  `pc-wasm-cover-matrix.mjs` without introducing cross-stage prepared-matrix
  caching or changing row semantics.
- Split batch feature orchestration into focused cover, cover-percent, and
  congruent feature modules; `batch-features.mjs` is now a compatibility/public
  facade. `cover-percent` uses the same shared existence execution profile as
  other PC existence consumers.
- Rename the internal shared enumeration API around `enumerateCases` /
  `canUsePatternEnumeration`, keeping the historical `*Path` names only as
  compatibility aliases.
- Harden `WasmPcSolver` construction so a legal-pack load failure frees the
  already-created Rust solver and temporary WASM allocation before rethrowing.
- Continue the structure refactor at the Rust/WASM boundary: split `pc-wasm`
  exports into solver state, lifecycle/memory, enumeration, minimum-cover, and
  diagnostics modules while preserving every exported symbol and JS ABI.
- Split `pc-core` minimum-cover primary kernelization and its large regression
  module out of the integrated quality-search implementation. A more aggressive
  fixed-K module split was benchmarked and intentionally reverted after showing
  a small hot-path slowdown.
- Reduce `batch-wasm/src/lib.rs` to a module facade and separate exact-placement
  ABI/common reachability helpers from the tightly coupled cover/congruent engine.
- Continue the behavior-preserving structure refactor: split Rust `PcSolver`
  single-queue and pattern-DAG algorithms out of `lib.rs`, move shared DAG
  traversal into `dag.rs`, and separate queue codec / reverse-legal utilities /
  tests so `pc-core/src/lib.rs` is primarily solver orchestration and re-exports.
- Split the JavaScript PC WASM adapter into a small lifecycle facade plus
  `pc-wasm-abi.mjs`, `pc-wasm-enumeration.mjs`, and
  `pc-wasm-min-cover.mjs`; the historical `WasmPcSolver` public method surface
  is preserved through prototype composition.
- Split the former monolithic `highs-min-cover.mjs` into focused primary
  cardinality, secondary quality-refinement, and adaptive routing modules while
  retaining `highs-min-cover.mjs` as a compatibility facade.
- Refactor PC execution policy into explicit `existence`, `full`, and `path` routing profiles while preserving their independently benchmarked crossover thresholds.
- Rename the shared PC enumeration router to `pc-enumeration-engine.mjs`; retain `path-engine.mjs` as a compatibility re-export, and move duplicate-queue reuse/remapping into shared queue utilities.
- Separate WASM ABI primitives from high-level scalar/pattern dispatch, split the public feature facade into per-feature orchestration modules, and move shared saved-piece semantics out of Per-save Minimals.
- Extract the Congruent backend cutoff into a batch routing policy module.
- Split low-level Rust `pc-core` responsibilities into hashing, piece, board, movement, legal-pack, QueueTrie, and DAG modules while preserving public re-exports and hot-path specialization.
- Add a dedicated high-throughput `path` feature and Worker request. Broad
  patterns use a PATH-only compact WASM adapter that reads unique solution
  geometry and coverage counts without materializing per-case quality objects.
- Emit PATH results directly as Fumen pages ordered by coverage descending,
  with deterministic stable-key tie breaking and `xx.xx% (covered/total)` page
  comments.
- Add PATH-specific scalar/pattern crossover thresholds (64 cases for 4L, 4
  cases for 5–6L); shared full-enumeration routing is independently tuned to
  64 cases on 4L and 8 cases on 5–6L.
- Speed up concrete single-queue enumeration used by `solve-one`, `solve-all`,
  and `per-save-all`: replace per-query placement HashSet allocation with
  bounded linear dedup, remove the redundant cached next-board array, and pack
  structural DAG keys (`u64` for <=4L, `u128` for 5–6L compatibility).
- Reuse the pattern-existence DAG for broad 4-line `chance` / solve-percent
  workloads (conservative 2048-case crossover), while preserving scalar
  existence for smaller patterns.
- Lower shared full-enumeration pattern crossovers from 256 to 64 cases on 4L
  and from 24 to 8 cases on 5–6L; `fifth` now uses the shared 4L crossover
  instead of its historical 2048-case override.
- Extend the integrated Rust congruent accelerator from targets of at most four
  operations to targets of at most ten operations, with legacy JS parity
  regressions for 7P and 10P cases.
- Deduplicate repeated concrete queues in scalar `canPcMany` and
  `enumeratePcMany` fallback paths without changing output multiplicity.

## 2.6 — 2026-09-01

- Accelerate deterministic 2↔2 secondary refinement with an exact per-case Top-3
  selected-quality table, avoiding an O(K) rescan for every removal pair while
  preserving coverage membership and stable-ID semantics.
- Extend Fast secondary search without changing exact primary cardinality: after
  the historical integrated fixed-K probe, allow a small bounded exact
  sequential-threshold grace search before falling back to deterministic 2↔2.
- Add an exact-only candidate-dominance preview for Fast on conservatively sized
  matrices. Only a fully completed dominance proof is accepted; timeout results
  are discarded and the historical Fast tree is restarted unchanged.
- Make Rust exact-quality comparison adaptive: retain direct quality-vector
  comparison for small searches, then switch after 64 distinct complete K-covers
  to a rank-compressed incremental histogram.
- Rank-compress JavaScript 2↔2 quality histograms as well, so sparse large u32
  quality values do not allocate arrays proportional to the numeric maximum.
- Normalize all WASM u32 return values at the JavaScript boundary, including
  quality values above 2^31-1 and u32::MAX failure sentinels.
- Tighten batch `clear` validation to integer heights 2–6.
- Add a pre-materialization pattern expansion guard with a 1,000,000 concrete
  case default; callers of the direct pattern API may provide an explicit
  `maxCases` override.
- Preserve the intentional 4-line helper behavior that projects analysis onto
  the supported 4-line region.

## 2.5 — 2026-08-31

- Selectively integrate the independent `qnia_tetris` main-branch improvements
  on top of Release 2.4 rather than replacing the newer saves/quality/T-spin
  semantics.
- Fix fixed-K exact-quality stable-ID tie resolution when all covered edges share
  a single quality level.
- Replace Queue/Hold trie per-node subtree bitmaps with DFS-preorder intervals
  plus exact original-case `perm[]` remapping.
- Add the sound pre-frontier empty-anchor early return to generic exact
  reachability and the generic 5–6 line final-piece path.
- Add the 5–6-line-only `column_run_reject` structural prune for disconnected
  empty-column runs with impossible tetromino cell cardinality.
- Make PC/batch/HiGHS/Worker Promise initialization single-flight, cached on
  success, and retryable after rejection; reject invalid Worker heights before
  keyed-cache allocation.
- Remove browser-reachable static Node builtin imports from batch WASM loading.
- Enforce the public 4-line contract for `fourth` before solver initialization.
- Make `test-rust.sh` verification-only; tracked WASM artifacts are produced by
  `build-wasm.sh`.
- Import the donor's stronger self-contained Rust regressions for QueueTrie, C2,
  and column-run soundness while retaining Release 2.4's Java-oracle I-kick and
  T-spin history protections.

## 2.4 — 2026-08-31

- Separate cover membership from human-quality values in minimum-cover refinement; zero-like quality can no longer masquerade as a missing coverage edge.
- Enforce positive integer `playableOrderCount` metadata at production boundaries and fail fast on missing/malformed quality.
- Decode continuous multi-page cover operation histories (including
  solution-finder `spin --split yes`) without losing line-clear/T-spin context.
- Allow 4-line histories to use a temporary exact-reachability roof up to six
  rows when placements occur above rows that are later cleared.
- Correct Jstris/TETRIO exact I-piece CCW orientation-row mapping; this restores
  Java parity for I-tuck TSD and the legacy congruent-cover TSM fixture.
- Add Java-oracle regressions for Mini/Regular TSS, TSD I-tuck coverage,
  six-row TST history, and congruent-cover TSM.
- Preserve upper-row blockers when choosing the internal height for continuous
  operation histories; truncating them can change T-spin reachability.

Only the current behavior is documented in detail elsewhere. This file retains a
compact history so old release-specific documents do not need to remain in the
package.

## 2.3.3 — 2026-08-30

Documentation/licensing maintenance release. No solver behavior change.

- Exposed the upstream HiGHS 1.15.1 third-party notice and individual license
  texts outside the source archive.
- Rewrote README, Korean/English user guides, API/save/architecture/build docs,
  HiGHS notes, and current integration guide around the actual 2.3.2 runtime.
- Removed superseded 2.1–2.3.2 release/migration documents and consolidated
  history here.
- Corrected stale per-save documentation that still described the removed
  `candidateLimit=16` truncation.

## 2.3.2 — 2026-08-30

- `minimals` / `legacy-minimals`: `ALL` now equals no save filter.
- Solution-level save filtering preserves exact multiplicity (`T`, `TT`, `TTT`)
  and regex sees exact save strings.

## 2.3.1 — 2026-08-30

- Replaced the save-expression implementation with an independently structured
  tokenizer → syntax tree → evaluator while preserving tested behavior.
- Added explicit sfinder-strict-minimal MIT provenance notice.

## 2.3 — 2026-08-30

- Restored queue-level legacy Saves semantics for `^`, `!`, concatenation,
  `&&`, `||`, regex, exact duplicate save outcomes, ALL mode, and aliases.
- Added multiple wanted-save expressions with one shared enumeration.

## 2.2 — 2026-08-30

- Production/legacy minimals naming split.
- Broad 4-line multiset-DAG execution for large save/minimals workloads.
- Prepared save metadata and numeric per-save exact-cover path.
- Exact single-queue `perSaveBest`; compatibility `candidateLimit` no longer
  truncates production output.

## 2.1 — 2026-08-29

- Separated exact primary cardinality from fixed-K human-quality optimization.
- Added `UseHiGHS=True/False/Auto`, Rust primary kernelization/cardinality search,
  fixed-K production quality solver, and Fast/True secondary modes.

## Earlier canonical development

The 2026-08-27 baseline introduced hard global-minimals HiGHS routing and `*!`
compatibility. The 2026-08-26 baseline already contained the optimized 4-line
legal-board path, early 5–6 line structural support, single-queue wrappers, and
integrated exact minimum cover.
