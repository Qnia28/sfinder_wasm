# Current architecture

This document describes the production architecture as of Release 2.7.
Historical experiments and superseded release-specific paths are intentionally
omitted.

## Layering

```text
Application / Worker request
        |
        +-- PC worker-runtime.mjs
        |      |
        |      +-- input/pattern validation
        |      +-- pc-enumeration-engine.mjs
        |      |      +-- pc-routing-policy.mjs
        |      |      +-- wasm-backend.mjs / pc_wasm.wasm
        |      |      +-- legal_boards_4.lgb (4L)
        |      |
        |      +-- feature aggregation
        |      +-- exact minimum-cover layer when required
        |             +-- Rust/WASM
        |             +-- lazy HiGHS for hard global minimals
        |
        +-- batch-worker-runtime.mjs
               +-- batch feature facade
               |      +-- cover
               |      +-- cover-percent
               |      +-- congruent / congruent-cover
               +-- batch_wasm.wasm + order-aware engine
```

The Rust `batch-wasm` crate likewise keeps `lib.rs` as a tiny module facade.
Exact locked-placement/T-spin ABI lives separately from the shared reachability
helper, while the cover/congruent engine remains a single tightly coupled module
because its structural DAG, queue-prefix automaton, and workspace state are
performance-critical shared data rather than independent services.

## PC search core

`rust/pc-core` owns board normalization, legal placement/reachability, line
clears, Hold state, structural DAG traversal, solution reconstruction, and exact
minimum-cover primitives.

Low-level `pc-core` implementation is split by responsibility: `board.rs`,
`piece.rs`, `movement.rs`, `legal.rs`, `queue_trie.rs`, `dag.rs`, and
`hashing.rs`. Algorithm families are separated as well: `single_queue.rs` owns
concrete queue existence/enumeration/best/per-save search, while `pattern.rs`
owns multiset DAG construction and pattern existence/full enumeration. Shared
flat-DAG productivity and reconstruction remain in `dag.rs`. Queue encoding and
offline reverse-predecessor helpers live in `queue_codec.rs` and `reverse.rs`;
large internal regressions live in `tests.rs`. `lib.rs` is now a small solver
orchestration/re-export surface rather than the implementation container. Hot
loops remain specialized rather than being forced through one generic dynamic
interface.

`src/wasm-backend.mjs` is the lifecycle/public-class facade. Queue packing and
u32 helpers live in `pc-wasm-abi.mjs`; raw solution/pattern/single-queue ABI
methods live in `pc-wasm-enumeration.mjs`; historical high-level convenience
methods live in `pc-wasm-compat.mjs`; minimum-cover ABI methods live in
`pc-wasm-min-cover.mjs`, with CSR packing and temporary u32 WASM buffer
management centralized in `pc-wasm-cover-matrix.mjs`. The Rust `pc-wasm` crate
mirrors that boundary: its
`lib.rs` is only a module facade, with solver state, lifecycle/memory,
enumeration exports, minimum-cover exports, and diagnostics in focused modules.
The historical exported WASM symbols and `WasmPcSolver` method surface are
preserved. `src/pc-enumeration-engine.mjs` owns shared existence and
full-enumeration dispatch, duplicate concrete-queue reuse and scalar/pattern
routing. Its production API uses the neutral `enumerateCases()` and
`canUsePatternEnumeration()` names; historical `*Path` names remain aliases only.
`src/pc-routing-policy.mjs` centralizes the independently benchmarked execution
profiles. `src/path-engine.mjs` is retained only as a compatibility re-export,
and production modules do not re-enter that facade.

The public `path` feature adds a dedicated `src/path-core.mjs` layer. For broad
patterns it uses the PATH-only `enumeratePcPath()` adapter, which reads solution
geometry plus coverage offsets without materializing per-case quality objects.
The public wrapper then orders unique solutions by coverage and emits Fumen
pages directly.

## 4-line fast path

The 4-line engine uses `wasm/legal_boards_4.lgb` with:

- compact legal-board lookup;
- stage-8 two-piece viability oracle;
- stage-9 exact finishing placements.

Small/ordinary 4L workloads stay on this scalar path because its startup cost is
low and late-stage pruning is strong.

For broad full-solution matrices, 4L switches to the shared multiset geometry
DAG at 64 cases; `fifth` uses the same shared full-enumeration profile. `fourth`
stays on scalar cached enumeration. Broad existence-only workloads such as
`chance` use the pattern existence engine from 2048 cases, while smaller batches
retain scalar existence.

The dedicated `path` feature independently switches at 64 cases because it
consumes only geometry plus coverage counts. Equal numeric thresholds here are
coincidental benchmark results, not a shared result contract.

## 5-6 line compatibility path

5–6 line analysis uses the generic structural solver. Broad full-solution
matrices use the shared multiset DAG from 8 cases. Broad existence switches at
256 cases. These profiles avoid one complete geometry search per concrete queue
without forcing small batches onto a high-startup-cost backend.

The dedicated `path` feature switches at 4 cases on 5–6L representative
workloads because its compact result materialization has a lower crossover.

For 5–6 line multiset-DAG child states, a sound `column_run_reject` prune rejects
horizontally disconnected empty-column runs whose remaining cell count cannot be
partitioned into tetrominoes. It is intentionally disabled for 4-line production
routing.

## Shared pattern execution

Concrete pattern expansion estimates Cartesian-product cardinality before materialization and rejects expansions above the default 1,000,000-case safety cap. This is an availability guard, not a solver approximation; accepted cases retain their exact queue semantics.

Broad enumeration is split into:

1. build reachable structural geometry for the few relevant piece multisets;
2. cache playable piece orders for each geometry;
3. project those orders across concrete queues with a prefix-sharing Queue/Hold
   trie;
4. represent each trie subtree as a contiguous DFS-preorder interval rather than
   storing one subtree bitmap per node, then map DFS positions back through a
   stable `perm[]` table to original case IDs;
5. let the feature layer consume per-case solution hits.

This preserves line-clear-dependent geometry; it is not a static tiling shortcut.

## Reachability rejection and asset loading

Generic exact reachability checks the invariant `reach[o] ⊆ valid[o]` before
starting the frontier. If every orientation has `valid[o] & inside[o] == 0`, no
locked placement can ever be emitted, so the search returns immediately. The
same sound early return is used by the generic 5–6 line final-piece path.

PC WASM assets, batch WASM, HiGHS, and Worker solver instances use retry-safe
single-flight Promise loaders: concurrent callers share one initialization,
success is cached, and a rejected initialization clears only its own attempt so
a later request can retry. Invalid Worker heights are rejected before keyed
cache creation. Browser-reachable modules do not statically import Node builtins;
Node-only file reads are dynamically imported behind the Node runtime guard.

## Save metadata

Queue counts, solution piece counts, last-bag metadata and compact saved-piece
representations are prepared once and reused. Two representations are
intentional:

- queue-level `saves`: compact exact outcome code that preserves duplicates;
- solution-level minimals predicate: compact multiplicity code (three bits per
  tetromino count).

Internal distinct-piece predicates such as `fourth`/`fifth` can still use the
smaller seven-bit mask table.

## Exact minimum cover

The JavaScript minimum-cover stack is separated by responsibility.
`highs-cardinality.mjs` owns primary matrix preparation/kernelization and the
Rust-vs-HiGHS cardinality backend. In `pc-core`, primary-only kernelization is
kept in `min_cover_primary.rs`, the large minimum-cover regression corpus is in
`min_cover_tests.rs`, and the integrated/fixed-K quality search remains together
in `min_cover.rs` because a more aggressive source split showed a measurable
hot-path code-layout regression. `min-cover-quality-refine.mjs` owns the exact
2↔2 quality refinement helpers. `min-cover-adaptive.mjs` owns True/Fast routing
and bounded secondary policy. `highs-min-cover.mjs` is a compatibility facade
that re-exports those focused modules; production modules import the focused
modules directly. The JS/WASM boundary uses `pc-wasm-cover-matrix.mjs` to share
CSR packing/allocation code without caching prepared matrices across search
stages.

The primary objective is always exact minimum cardinality K.

Before the backend search, primary-only kernelization removes forced/redundant
structure. The remaining kernel is solved by:

- Rust/WASM exact cardinality search; or
- HiGHS exact MIP when requested/selected.

Auto currently routes to HiGHS when the residual kernel meets either:

```text
cases >= 200 && candidates >= 112 && edges >= 2200
```

or:

```text
cases >= 650 && candidates >= 105 && edges >= 6000
```

If kernelization alone proves K, no search backend is invoked.

## Secondary human quality

For a selected exact-K cover, each case is scored by the maximum
`playableOrderCount` among selected solutions that cover it. Scores are sorted
ascending and the vector is maximized lexicographically; stable solution IDs
resolve final ties.

Coverage membership and human quality are separate data. The 2↔2 refinement
uses an explicit coverage-membership array for removal/replacement feasibility;
it never infers coverage from `quality > 0`. In production, a covered edge with
a human-quality provider must have an integer `playableOrderCount` in
`1..2^32-1`; missing, zero, non-integer, or non-number metadata fails fast.
Calling the generic minimum-cover API with `qualityFor == null` is explicitly
cardinality-only and skips secondary refinement.

Production secondary search keeps exact K fixed throughout. `True` retains the
100,000-state integrated probe followed by the exact sequential-threshold prover.

`Fast` uses a layered bounded strategy:

1. On small enough matrices, run a speculative candidate-dominance preview.
   Dominance is exact, but because it changes bounded DFS traversal, only a fully
   completed proof is accepted; a timeout is discarded completely.
2. Run the historical integrated fixed-K search with the deterministic
   100,000-state default budget.
3. If that probe times out, allow a small bounded sequential-threshold grace
   search. A completed proof upgrades Fast to exact quality.
4. If exact proof still does not complete, use the best valid exact-K incumbent
   and apply deterministic 2↔2 refinement. The refinement precomputes per-case
   top-3 selected qualities so removing two candidates does not rescan all K
   selected candidates for every pair.

The integrated Rust quality search itself starts with the historical direct
quality-vector comparison and switches to a rank-compressed incremental
histogram only after enough distinct complete K-covers have been seen. This
avoids histogram push/pop overhead on small searches while accelerating
quality-vector-heavy searches.

K never becomes approximate.

## Per-save minimals

All save groups share PC enumeration. Single concrete queues use the exact
per-save best solver and do not solve a set-cover matrix. Pattern inputs create a
separate exact cover problem for each saved piece. Tiny matrices can use the
integrated exact JS/Rust-compatible path; broad matrices retain numeric solution
IDs through the Rust cover call.

## Batch engine

Batch cover cannot merge states solely by resulting board because different
placement histories can have different queue/order coverage. It therefore uses a
separate order-aware engine and `batch_wasm.wasm`.

For 2–4 lines, locked reachability, line-clear/mode tracking, and queue/Hold
coverage are performed in the dedicated Rust/WASM batch search. For 5–6 lines,
a generic structural JS DAG shares future placement work while exact lock tests
remain in WASM. Public orchestration is split into focused cover, cover-percent,
and congruent feature modules behind `batch-features.mjs`. `CoverPercent` delegates
its PC-existence work to the same shared existence execution profile used by
other PC features rather than maintaining a second routing policy.
