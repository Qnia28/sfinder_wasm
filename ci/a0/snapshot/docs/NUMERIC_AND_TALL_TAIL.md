# Numeric enumeration and tall termination (2.8)

## Numeric transport and minimals

`WasmPcSolver.enumeratePcPatternCompact(board, queues, useHold)` returns owned
copies of typed arrays: `geometry` (little-endian u32 mask pairs), `stride` (u32
words per solution), `offsets`, `caseIds`, `qualities`, and `count`. They remain
valid after any subsequent solver call. Older WASM returns null and retains the
object API. Native borrowed CSR pointers are copied before further allocation.

The minimals path uses these arrays when the existing full-enumeration routing
chooses the pattern backend. Save predicates use numeric piece counts. The
prepared matrix preserves historical first-hit case order, lexically sorted
solution IDs, positive per-edge order counts, and duplicate branch multiplicity.
Primary and fixed-K WASM calls reuse CSR buffers instead of rebuilding per-edge
Map/Set/string entries. Prepared quality rows still exist for the quality solver.
One string per candidate is retained for deterministic historical tie breaking;
only selected geometry is expanded into BigInt masks for Fumen output. Direct
`calculateSaveMinimals()` coverage access lazily restores its public Map of Sets.

Heavy reconstruction is memoized by the complete tuple
`(DAG node, depth, cleared original rows, compact coloring, piece-order prefix)`.
No different colors or different piece orders are merged. It activates at 100,000
successful geometry paths and retains at most 200,000 states in the request.
After the retention limit, new states are simply traversed normally; exact output
is preserved. `stats().reconstructionVisits` and `reconstructionSkipped` are
cumulative counters. Full path, save weights and distinct order count semantics
remain unchanged.

## Tall termination

The final four empty cells are checked against the requested tetromino shape
before computing a movement frontier. Bounds are checked before constructing a
bit mask, including right-edge and top-row placements.

For height h>4, the 4-row legal oracle is used only when the bottom h-4 rows are
complete. The solver removes exactly those full rows, queries stage 8 pair masks
or the exact stage 9 finish, then restores placement y, raw board and cell masks.
This preserves the same walls, floor and spawn-relative distance. An active
5/6-row region that cannot be translated still uses the generic search.

Tall solvers constructed with a legal asset derive a small LGB2 pack containing
stages 8/9/10 and their oracles; the large stage-7 table is omitted. Factory and
Worker calls supply this automatically. `createWasmSolver(h,{legal:false})`
retains the generic exact path for differential checks. Missing/older oracles
fall back to generic search. This change does not replace Cover physics with
PC physics and does not remove arbitrary empty top rows.

## Validation

The regression suite compares compact/object matrices, owned-buffer lifetime,
save multiplicity, final Fumen and bounded quality states. Tall tests compare
legal-assisted and generic termination against the independent batch exact-lock
primitive across 5/6-row placements and scattered empty masks. Existing 4–6-row,
Hold, per-save, path and worker regressions also apply. The 45 cycle1 full
solution/coverage matrices match the previous integrated build.

Benchmarks are kept outside the distributable source. Original 2.7 is restored
from its ZIP and verified against all 190 original file hashes. Timings must be
compared under matching result contracts: count-only and coverage-only deliberately
omit outputs that the default APIs materialize. Numeric transport is not a new
minimum-cardinality proof algorithm; hard proof time can still dominate.

## Shared compact coverage

`compact-geometry.mjs` decodes keys and piece usage from packed geometry, then
materializes masks only for selected solutions. `numeric-cover-data.mjs` owns
prepared numeric coverage and CSR adapters shared by minimals and per-save
minimals. These buffers belong to the current request. The adapters preserve
the caller's case and edge order and the existing candidate-key ordering.
