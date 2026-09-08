# Cover and Congruent optimization batches

Baseline: release 3.0 commit `03b637730c5b541f4f2934be613498fbe65327fd`.
The branch implements three reviewable groups and keeps speculative work in
[`Todo.md`](../Todo.md).

1. `cover-percent` requests coverage-only internally. Congruent shares a Boolean
   Queue/Hold trie projection across tilings and rejects impossible prefixes
   before exact-lock checks. PC pattern multiset roots reject impossible piece
   combinations while preserving the later order check.
2. Synchronous batch sessions retain physics-specific positive/negative exact-lock
   and spin results, plus the same-queue projector across Cover targets. The DAG
   stores edges in one arena; selected MRV candidates retain their prior order.
   Cover returns packed variant words and coverage bytes, copied before subsequent
   WASM allocations. Older exports retain the scalar getter path.
3. Coverage-only interns equivalent Queue/Hold frontiers rather than whole piece
   prefixes. Rust Congruent supports 2–6 rows and up to 15 operations. Cover adds
   weighted-prefix count output without expanding irrelevant suffix permutations.

## Public APIs

```js
import { calculateCover, calculateCoverCount } from './src/batch-features.mjs';
const counts = await calculateCover({
  sourceFumen, pattern: '*!,*!', clear: 4, useHold: true,
  outputMode: 'count', maxBatchPrefixes: 65536,
});
// Equivalent: calculateCoverCount({ sourceFumen, pattern: '*!,*!', clear: 4 });
```

Default `outputMode: 'variants'` and the existing `coverage` mode retain their
output contracts. Count mode returns total/covered/failed, decimal-string exact
counts, percent, evaluatedPrefixes, and per-target coverage/coverageExact.
It intentionally omits concrete covered/failed queues, orders, and traces.
Numbers exceeding the safe integer range are returned as decimal strings.
The largest target operation count determines the required prefix length; Hold
requires at most one extra queue piece. Cases from repeated branches keep their
weights. Original and mirrored targets are ORed before weighting union coverage.
`maxBatchPrefixes` bounds each evaluated batch, not total runtime or geometry RAM.
Worker requests using the existing Cover input can pass the new outputMode.

Old WASM without `batch_congruent_max_height` retains JS Congruent above four rows.
Rust results preserve the solution and valid-order sets; order-array traversal can
be different from the legacy JS fallback, as was already true between backends
on shorter fields. Congruent uses TETRIO and Cover uses Jstris physics.
The existing Rust accepted-solution limit and JS geometric-tiling limit remain
different; unifying that contract is explicitly tracked in Todo.md.

## Exactness and memory

Mode state, remaining operation IDs, board and cleared rows remain part of
structural search. Frontier identity includes trie position, held piece and ended
states, never just a covered-case bitmap. Terminal checks retain the last piece
and clear count. Full variants still preserve operation IDs and all histories.

Frontier interning has a 200,000-node and estimated 16 MiB payload budget, with
at most 200,000 cached transitions. Exhaustion discards the incomplete graph and
reruns the exact prefix engine. It never emits a partial answer. The low-level
`batch_engine_set_frontier_budget(0)` forces this fallback for regression tests;
`batch_engine_frontier_fallback()` reports whether the last engine call fell back.
These budgets do not cap the structural DAG or total WASM memory. Existing
coverage-mask and Boolean-order caches have separate retention budgets.

Sessions retain at most 65,536 exact-lock and 16,384 spin entries and release them
at the outermost session end. Keys include board, target cells, height, physics,
and piece where relevant. Old WASM remains supported; feature tests require a
matching rebuilt binary when testing new exports.

## Reproduce validation and performance

```sh
npm ci
bash scripts/build-wasm.sh
cd rust
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --target wasm32-unknown-unknown --offline -- -D warnings
cargo test --workspace --offline
cd ..
BASELINE_ROOT=../baseline node --test tests/*.test.mjs
node scripts/benchmark-batch.mjs --baseline ../baseline --candidate . --pairs 7 --iterations 10
```

The Actions workflow checks out the pinned baseline and candidate, builds both
with Rust 1.90.0, and uses Node 24.13.0 on the same runner. Samples alternate
baseline/candidate sequentially, check output hashes, and save raw samples,
medians and WASM assets as artifacts. Count's new output contract is validated
against expanded small cases and independent huge-pattern counts; it is not
presented as a same-contract speedup over the baseline's list output.
