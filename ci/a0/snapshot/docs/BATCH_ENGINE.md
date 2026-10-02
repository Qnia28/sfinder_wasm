# Batch engine

The batch engine handles operation-order-sensitive analysis separately from the
PC existence solver.

## Why it is separate

The PC engine can merge equivalent board states aggressively because it only
needs PC existence and solution enumeration. Cover analysis cannot merge states
only by board: two placement histories that reach the same board may have
different operation orders and therefore different queue/hold coverage.

For that reason batch analysis uses `batch_wasm.wasm` and keeps order-aware
state where required.

## Current cover search architecture

For ordinary 2-4 line static targets, cover traversal runs as one Rust/WASM
search instead of a JavaScript recursive DFS that calls WASM once per placement.
A target's operations and analysis queues are staged once; Rust performs exact
locked reachability, line-clear/mode tracking, and queue/Hold coverage internally.
JavaScript only reconstructs the public variants/orders and case results.

A multi-page Fumen can also encode one continuous placement history, as produced
by solution-finder `spin --split yes`: each page operation is locked, lines are
cleared, and the following page contains the resulting field. Cover detects such
continuous transitions and unfolds the sequence into one logical target before
search. If a 4-line target temporarily needs cells above row 4 before its line
clears, the internal exact-reachability roof is expanded only for that target, up
to 6 rows. The requested clear height and public cover result remain unchanged.
Static, unrelated Fumen pages continue to be analyzed as separate targets.

For requested 5-6 line compatibility targets, and for unfolded operation-history
targets whose temporary roof exceeds four rows, the fixed four-row batch engine
is not used. The generic fallback keeps exact lock/T-spin tests in WASM but builds a structural
DAG keyed by `(board, clearedRows, remainingOperationMask)`. Histories that reach
the same future state therefore share all later placement checks. Public traces
are reconstructed from DAG edges afterwards. Queue/Hold coverage is projected
with one prefix trie shared by all concrete pattern cases and cached placement
orders, rather than testing every `(queue, order)` pair independently.

The exact reverse-reachability graph uses compact integer state IDs, a fixed
visited bitset, a fixed stack, and precomputed SRS-origin cells/bounds rather
than a hash set of `(rotation, x, y)` states. T-spin classification is evaluated
during search only for spin-sensitive modes; other modes annotate only final
successful variants so the public trace remains compatible without paying the
spin cost on failed branches.

Within this solver, HOLD/ACTIVE/NEXT may be supplied as one linear visible queue.
For example, HOLD `T`, ACTIVE `L`, NEXT `IOZTJ` is analyzed as `TLIOZTJ`; the
queue/Hold automaton determines which placement orders are realizable. Duplicate
semicolon cases remain distinct by case ID even when their queue strings match.

## Reachability

Cover checks exact locked placements in the SRS rotation-origin coordinate
system. A target operation is accepted only when a matching state is legal,
grounded, and reachable with the selected movement rules.

- Cover uses Jstris 180 physics.
- Setup/congruent uses TETRIO 180 physics.

## Cover modes

Supported modes:

```text
normal
b2b
any / tsm
tss
tsd
tst
tetris
tetris-end
1l / 2l / 3l / 4l
1l-or-pc / 2l-or-pc / 3l-or-pc / 4l-or-pc
```

Cover also supports hold, `mirror=yes/no`, multi-page Fumen targets (both
independent pages and continuous operation histories), and semicolon-union queue
patterns.

Different semicolon branches remain distinct analysis cases even when they
expand to the same concrete queue. Internally this identity is preserved with a
case ID; external failed-queue output remains queue strings.

## T-spin classification

T-spin classification validates the three-corner rule, a reachable predecessor
rotation, kick selection, and Mini/Regular conditions before accepting a target
for the requested spin mode. `tsm` accepts a line-clearing Mini or Regular
T-spin. `tss`, `tsd`, and `tst` require a Regular T-spin clearing at least 1, 2,
and 3 lines respectively; these threshold semantics match solution-finder 1.42.

The current Jstris-180 path has been cross-checked against solution-finder 1.42:
320 one-page T-operation targets across all four spin modes matched 1,280/1,280
classifications, 30 generated Regular-TSS operation histories matched queue
coverage, four generated Regular-TSD histories (including an I-piece CCW tuck)
matched queue coverage, and a continuous six-row Regular-TST history matched the
Java oracle including its required upper-row blockers. Mirrored TSS/TSD/TST spot
checks and the legacy congruent-cover TSM fixture also match. These are
compatibility tests, not a claim that every possible custom kick table is
supported; Cover uses the bundled Jstris-180 rules.

## Fumen handling

For cover, an isolated page operation is overlaid onto that page's field before
target operations are decomposed. When consecutive pages form a valid locked
operation -> line-clear -> next-field chain, they are decoded as one operation
history instead, preserving the pre-clear coordinates needed for T-spin and
order-sensitive cover analysis.

For congruent, colored cells are treated as fill cells. Gray/X cells remain base
garbage unless `blueGarbage` is enabled.
