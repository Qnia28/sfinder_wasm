# sfinder-wasm

**sfinder-wasm 3.2.1**

`sfinder-wasm` is a browser-native Rust/WebAssembly implementation of selected
Tetris Perfect Clear analysis workflows. It reproduces the intended output
semantics of the historical Java + Python SFinder toolchain where compatibility
is explicitly maintained, while using a separate Rust/WASM search engine and
modern JavaScript Worker APIs.

The runtime does **not** require `sfinder.jar`, Python, or the historical wrapper
repository.

- Project license: **Apache-2.0**
- Runtime npm dependency: `tetris-fumen@1.1.3`
- Wide-kernel primary backend: optimized OR-Tools 9.15 CP-SAT, bundled and lazy-loaded
- Legacy primary backend: HiGHS 1.15.1, explicitly selectable and lazy-loaded

See `docs/API_REFERENCE.md` for APIs and compatibility notes.

## What's new in 3.2.1

- Fixed save-expression whitespace handling and syntax validation.
- Fixed colored Cover targets across line clears and static input height validation.
- Made per-save minimals tie-breaking independent of locale.
- Fixed empty-pattern chance percentages and Vite worker import compatibility.

## Previous release: 3.2

- Faster default Fast minimals and per-save minimals with automatic search-budget
  adjustment and reduced processing overhead. `fastStateBudget` remains supported.
- Minimum K and coverage remain exact; bounded quality and selected solutions may
  differ from 3.1. Use `secondary: 'quality'` for complete quality proof.

## Previous release: 3.1

- Exact human-quality minimals offer `secondary` engine selection, with automatic
  Rust/CP-SAT cooperation and complete quality and stable-ID proof.
- Per-save minimals support `secondaryWorkers` to control concurrent exact
  quality work. Worker-client cancellation stops request-owned workers.
- Batch APIs provide compact coverage/count output options and explicit
  solution limits; see the API reference for each operation's result shape.

The minimum solution count remains exact. Exact quality has no built-in time
limit; use client cancellation when an application needs to stop a request.

## Documentation map

Start here, then use the focused references as needed:

- `SFinder_User_Guide_KO.md` — detailed Korean user guide
- `SFinder_User_Guide_EN.md` — English user guide
- `docs/API_REFERENCE.md` — Worker/direct JavaScript API and result contracts
- `docs/SAVE_EXPRESSIONS.md` — save-expression grammar and the important `saves` vs `minimals` semantic difference
- `docs/PER_SAVE_MINIMALS.md` — per-save minimals contract
- `docs/SINGLE_QUEUE_SOLVER.md` — exact concrete-queue solver
- `docs/BATCH_ENGINE.md` — cover/congruent engine and modes
- `docs/DEPLOYMENT.md` — installation and browser/Node deployment
- `HIGHS_INTEGRATION_AND_LICENSE.md` — HiGHS runtime/provenance details
- `THIRD_PARTY_NOTICES.md` — third-party licenses and acknowledgements

## Supported operations

### PC Worker

| Worker kind | Purpose |
|---|---|
| `path` | all distinct PC solutions for a pattern, coverage-ranked as Fumen pages |
| `chance` | PC success count/rate and failed queues |
| `saves` | queue-level save-condition analysis, including exact duplicate saves |
| `minimals` | production adaptive exact minimum-cardinality cover |
| `legacy-minimals` | synchronous compatibility/reference minimals path |
| `fourth` | 4-line fourth-PC save distribution helper |
| `fifth` | 4-line fifth-PC per-piece minimal analysis |
| `per-save-minimals` | independent minimals for every savable piece |
| `solve-one` | one preferred exact solution for one concrete queue |
| `solve-all` | every exact solution for one concrete queue |
| `per-save-all` | every exact solution grouped by one saved piece |

### Batch Worker

| Worker kind | Purpose |
|---|---|
| `cover` | operation-order-aware queue coverage for supplied target Fumens |
| `coverpercent` | cover ranking plus PC solve percentage |
| `congruent` | alternate colored-piece decompositions of the same fill region |
| `congruentcover` | congruent enumeration plus queue coverage |

First-order PC features support target heights from **2 through 6 lines**.
`fourth` and `fifth` are intentionally **4-line only**.

## Installation

```bash
npm install
```

The release already contains the required WASM/data assets:

```text
wasm/pc_wasm.wasm
wasm/batch_wasm.wasm
wasm/highs.wasm
wasm/legal_boards_4.lgb
```

The bundled runtime is ready to use; no Rust toolchain is required.
Keep `src/vendor/ortools/` with the runtime for CP-SAT support.

## Quick start: Worker API

The Worker path is the recommended browser integration because it owns WASM
loading and isolates heavy solver state from the UI thread.

```js
import {
  SolverWorkerClient,
  viteWorkerFactory,
} from './src/worker-client.mjs';

const client = new SolverWorkerClient(viteWorkerFactory);

const result = await client.request('chance', {
  sourceFumen: 'v115@...',
  pattern: '*p7',
  clear: 4,
  useHold: true,
});

console.log(result.percent, result.failedQueues);
```

Batch Worker:

```js
import {createBatchWorkerClient} from './src/batch-worker-client.mjs';

const batch = createBatchWorkerClient();
const result = await batch.request('cover', {
  sourceFumen: 'v115@...',
  pattern: '*p7',
  clear: 4,
  mode: 'normal',
  mirror: 'no',
  useHold: true,
});
```

A request can be cancelled with `AbortSignal`. `client.cancel()` cancels work
owned by that client; `client.dispose()` terminates it permanently.

## Direct runtime API

For non-Worker JavaScript, prefer the runtime dispatcher rather than manually
constructing a solver:

```js
import {runWorkerRequest} from './src/worker-runtime.mjs';

const result = await runWorkerRequest({
  kind: 'minimals',
  input: {
    sourceFumen: 'v115@...',
    pattern: '*p7',
    clear: 4,
    wantedSave: 'ALL',
    secondary: 'auto',
    Primary: 'Auto',
  },
});
```

`runBatchWorkerRequest()` in `src/batch-worker-runtime.mjs` provides the same
style for batch commands.

The lower-level exported feature functions accept an explicit solver and are
useful for applications that deliberately own solver
lifetime. See `docs/API_REFERENCE.md`.

## Queue pattern syntax

Supported SFinder-style examples include:

```text
TOILJSZ
*p7
[JSZO]!
[LJISZ]p4
[^TIL]!
I[JS]![TO]!,*p2
TI,[JOS]!,*p2;TO,[IJS]!,*p2
```

Semicolon-separated branches remain distinct analysis cases even if two
branches expand to the same concrete queue string. Malformed patterns are
rejected rather than silently reinterpreted.

Single-queue operations (`solve-one`, `solve-all`, `per-save-all`) require a
**concrete queue**, not SFinder pattern syntax.

## Save expressions

Save analysis has two deliberately different evaluation models.

### `saves`: queue-level outcome-set semantics

For each queue, all exact possible save outcomes are collected first. The
expression is then evaluated against that set. Therefore:

```text
TI      one exact save outcome contains both T and I
T&&I    T is saveable and I is saveable; they may be different outcomes
^T      at least one save outcome does not contain T
!T      no save outcome contains T
TT      one save outcome contains two T pieces
/TT/    regex against exact save strings, including multiplicity
```

Empty/omitted `wantedSave` and `ALL` return all exact save outcomes in
`saveResults`. Multiple expressions may be passed as a comma-separated string
or JavaScript array; enumeration is shared once and independent results are
returned in `wantedSaveResults`.

`expression#alias` is supported by `saves` as display metadata.

### `minimals`: one-solution save predicate

`minimals` and `legacy-minimals` filter each concrete solution by that solution's
exact saved-piece multiset. Multiplicity is preserved (`T`, `TT`, `TTT` are
different), and regex sees the exact multiplicity. Empty/omitted `wantedSave`
and `ALL` all mean **no save filter**.

Because minimals evaluates one solution at a time, its historical semantics
naturally make `^X` equivalent to `!X` for that single outcome, and `XY`
equivalent to `X&&Y` for that single outcome. Do not assume the queue-level
`saves` semantics apply to minimals.

See `docs/SAVE_EXPRESSIONS.md` for the exact contract.

## Minimals: exact K and human quality

Production `minimals` separates two objectives:

1. **Primary:** find the exact minimum number of solutions K that cover every
   successful case.
2. **Secondary:** among exact-K covers, optimize the deterministic human-quality
   ordering based on per-case `playableOrderCount`.

**Primary / primary** controls only the primary backend (case-insensitive):

| Value | Primary cardinality backend |
|---|---|
| Auto | Kernelize, then choose Rust or ORTools (default) |
| Rust | Rust/WASM exact solver |
| HiGHS | HiGHS exact MIP, explicit legacy backend |
| ORTools | Optimized OR-Tools 9.15 CP-SAT exact solver |

Auto chooses ORTools iff the residual kernel has cases ≥ 200, solutions ≥ 112,
and entries ≥ 2200. Otherwise it chooses Rust. A solved kernel bypasses all
solvers and reports primaryResolved: "kernel". Tiny adaptive exact shortcuts
remain available in Auto; explicit modes select the requested residual solver.
primaryRequested and primaryResolved use lowercase names.
Quality budgets and hardness classification are independent of this selector.

Deprecated UseHiGHS / useHiGHS True/False/Auto map to HiGHS/Rust/Auto.
Primary options take precedence, and lowercase primary wins over Primary.
If the ORTools threshold is met but JSPI, SharedArrayBuffer or browser
cross-origin isolation is unavailable, Auto falls back to HiGHS before loading
ORTools. Smaller kernels still use Rust, and solved kernels bypass all solvers.

ORTools requires WebAssembly JSPI and SharedArrayBuffer. Browser deployments
need COOP/COEP. Node 24.13 requires --experimental-wasm-stack-switching.
Explicit Primary=ORTools returns a clear error in an unsupported environment;
Primary=Auto handles that environment with the HiGHS fallback. Solver/proof errors
are still reported. See [ORTools integration](ORTOOLS_INTEGRATION_AND_LICENSE.md).

`secondary` controls quality optimization independently of `primary`:

```text
auto        bounded exact attempts, then 2↔2 refinement (default)
quality     complete quality proof with automatic Rust/CP-SAT cooperation
2x2         direct 2↔2 refinement without exact-quality probes
nocpsat     complete quality proof with Rust only
integrated  unbounded Rust integrated quality proof
threshold   unbounded Rust sequential-threshold quality proof
cpsat       unbounded CP-SAT quality and stable-ID proof
```

`minimalCount` remains exact in every mode. `humanQualityExact` reports whether
the secondary quality objective was proven exactly.

Both minimals and per-save minimals default to `secondary: 'auto'`.
The former `exactHumanQuality` input is no longer accepted for these operations.
Use `secondary: 'quality'` when migrating a request that required exact quality.

## Per-save minimals

If the current field needs `P` tetrominoes to finish the PC,
`per-save-minimals` requires queues of exactly `P + 1` pieces:

```text
remainingCells      = targetLines * 10 - occupiedCells
piecesNeeded        = remainingCells / 4
expectedQueueLength = piecesNeeded + 1
```

For a single concrete queue, the Rust solver evaluates the complete structural
result and selects the exact best geometry for each saved piece by
`playableOrderCount`, then stable key. `candidateLimit` is retained only as a
compatibility argument and does not truncate production output.

For broad patterns, solution enumeration is shared and an independent exact
minimum-cover problem is solved for each saved piece.

## Single-queue solver

`solve-one` and `solve-all` require exactly `piecesNeeded` queue pieces.
`per-save-all` requires exactly `piecesNeeded + 1`.

`solve-one` selects the solution with maximum playable-order count, then the
lexicographically smallest stable solution key. `solve-all` returns all distinct
solutions. `per-save-all` groups all solutions by the one unused piece.

See `docs/SINGLE_QUEUE_SOLVER.md`.

## Batch engine

Batch analysis is separate from the PC existence solver because cover semantics
must preserve placement/order history.

- Cover uses exact locked reachability and Jstris 180 physics.
- T-spin cover supports `tsm`, `tss`, `tsd`, and `tst` with Mini/Regular
  classification and solution-finder-compatible clear-line thresholds.
- Continuous multi-page operation histories (including `spin --split yes`
  output) preserve line-clear/order history and all occupied upper blockers
  needed by later reachability instead of being flattened into unrelated pages.
- Congruent/setup search uses TETRIO 180 physics.
- Ordinary 2–4 line static cover uses the dedicated Rust/WASM batch engine.
- 5–6 line compatibility cover, and history targets whose temporary simulation
  roof exceeds four rows, use a structural JS DAG while exact lock tests remain
  in WASM.

See `docs/BATCH_ENGINE.md` for all cover modes, validation scope, and Fumen
semantics.

## License and redistribution

sfinder-wasm is **Apache-2.0**. See `LICENSE`.

Copyright (C) 2026 Qnia (@Qnia28).

Third-party components retain their own licenses. Keep
`THIRD_PARTY_NOTICES.md` and the files under `third_party/` when redistributing
the complete project. In particular, `highs.wasm` is accompanied by the HiGHS
main MIT notice and HiGHS' own third-party notice/license set.

See `THIRD_PARTY_NOTICES.md` and `HIGHS_INTEGRATION_AND_LICENSE.md`.

For ORTools assets, runtime requirements, NOTICE and Eigen source redistribution,
see [ORTools integration](ORTOOLS_INTEGRATION_AND_LICENSE.md).
