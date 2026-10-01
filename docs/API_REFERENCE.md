# JavaScript API reference

This is the current public/runtime contract for Release 3.0.

## Recommended entry points

### PC Worker

```js
import {SolverWorkerClient, viteWorkerFactory} from '../src/worker-client.mjs';
const client = new SolverWorkerClient(viteWorkerFactory);
const result = await client.request(kind, input, {signal});
```

Supported `kind` values:

```text
path
chance
saves
minimals
legacy-minimals
fourth
fifth
per-save-minimals
solve-one
solve-all
per-save-all
```

### Batch Worker

```js
import {createBatchWorkerClient} from '../src/batch-worker-client.mjs';
const batch = createBatchWorkerClient();
const result = await batch.request(kind, input, {signal});
```

Supported kinds:

```text
cover
coverpercent
congruent
congruentcover
```

### Direct runtime dispatcher

```js
import {runWorkerRequest} from '../src/worker-runtime.mjs';
const result = await runWorkerRequest({kind, input});
```

The dispatcher loads/reuses the correct WASM solver for the requested target
height. `runBatchWorkerRequest()` provides the batch equivalent.

## Common PC inputs

```js
{
  sourceFumen: 'v115@...',
  pattern: '*p7',
  clear: 4,
  useHold: true,
}
```

- `sourceFumen`: input Fumen code.
- `pattern`: SFinder queue pattern, except exact single-queue commands. Direct pattern expansion has a default 1,000,000-concrete-case safety cap; low-level callers may pass an explicit `maxCases` to the pattern API.
- `clear`: integer target height from 2 through 6.
- `useHold`: whether Hold is available.

`targetLines` is accepted by the single-queue/per-save APIs and takes precedence
over compatible `clear` where documented.

## path

Input: common PC inputs.

`path` enumerates every distinct PC solution geometry that is reachable by at
least one concrete pattern case. Internally it chooses a scalar cached path or
the packed pattern WASM backend; this dispatch is not part of the public result
semantics.

The output Fumen contains one page per distinct solution. Pages are sorted by
coverage descending; equal-coverage solutions use the stable solution key as a
deterministic tie-break. Each page comment is:

```text
32.86% (1656/5040)
```

where the denominator is the total number of concrete pattern cases. Duplicate
semicolon branches remain distinct cases and therefore contribute separately to
both the numerator and denominator.

Result:

```js
{
  pathPattern,
  analysisPattern,
  total,
  solutionCount,
  coverageCounts,
  backend,       // "scalar" or "pattern"; diagnostic only
  fumen,         // null when no solution exists
}
```

## chance

Input: common PC inputs.

Result:

```js
{
  total,
  success,
  failed,
  failedQueues,
  percent,
}
```

## saves

Additional input:

```js
wantedSave: 'T&&I'
```

or an array / comma-separated list of expressions.

`singleSaveMask` defaults to `true`: when every queue has exactly one more piece
than the required placements, saves uses compact per-queue masks and exact
last-bag-aware outcome dictionaries. Other inputs retain the general path.
Set it to `false` to use the general Set implementation explicitly.
The experimental request-local `outcomeCache` defaults to `false`; it applies
only when the compact mask path is not selected. Output semantics are identical.

Single-expression result preserves the historical flat shape:

```js
{
  pathPattern,
  analysisPattern,
  total,
  saveExpression,
  saveAlias,
  saveLabel,
  success,
  failed,
  failedQueues,
  percent,
}
```

Multiple expressions return:

```js
{
  pathPattern,
  analysisPattern,
  total,
  wantedSaveResults: [ /* same per-expression statistics */ ],
}
```

Empty/omitted/`ALL` returns `saveResults` containing all exact save strings.
See `SAVE_EXPRESSIONS.md`.

## minimals

```js
{
  sourceFumen,
  pattern,
  wantedSave,             // optional; ALL = no filter
  clear: 4,
  useHold: true,
  exactHumanQuality: 'Fast',
  Primary: 'Auto',
  fastStateBudget,        // optional expert tuning: main integrated Fast probe budget
  secondary: 'auto',      // applies when exactHumanQuality is 'true'
}
```

Primary accepts Auto/Rust/HiGHS/ORTools (case-insensitive). Lowercase primary
wins over Primary; either wins over deprecated UseHiGHS aliases. Auto selects
ORTools iff residual cases ≥ 200, candidates ≥ 112, and entries ≥ 2200, otherwise
Rust. Solved kernels bypass the solver. ORTools requires JSPI and SharedArrayBuffer.
For Auto, a kernel meeting the ORTools threshold falls back to HiGHS if JSPI,
SharedArrayBuffer or browser cross-origin isolation is unavailable. Explicit
ORTools retains its support error. Fallback metadata keeps primaryRequested='auto'
and reports primaryResolved/cardinalityBackend='highs', useHiGHSResolved=true.
See ORTOOLS_INTEGRATION_AND_LICENSE.md for deployment requirements.

For exact quality, `secondary` accepts `auto`, `rust`, `integrated`, `threshold`,
or `cpsat` (case-insensitive). Auto retains integrated100k → threshold and starts
a 1-worker CP-SAT helper after 60 seconds of secondary work, keeping threshold
running. The first complete quality **and stable-ID** proof wins. Unsupported CP
environments retain the Rust path. `rust` explicitly selects the previous policy;
`integrated` and `threshold` select their unbounded fixed-K prover. Explicit
`cpsat` uses a 120-second soft budget including loading/model preparation, with a
one-second watchdog grace, and throws if exact proof is incomplete. Common trivial
proofs run before the selected engine.
Fast and cardinality-only behavior is unchanged. See
[the three-engine contract](SECONDARY_THREE_ENGINE_20260927.md).

`fastStateBudget` controls the historical integrated fixed-K Fast probe. Fast may
also run a small exact-only candidate-dominance preview and, after an integrated
timeout, a bounded sequential-threshold grace probe. Those extra probes have
separate conservative caps derived from the main Fast budget and are reported
independently in the result metadata.

Result includes:

```js
{
  total,
  saveSuccess,
  minimalCount,
  coverageCounts,
  fumen,
  minimumCoverBackend,
  cardinalityBackend,
  qualityBackend,
  primaryRequested, // auto/rust/highs/ortools
  primaryResolved,  // rust/highs/ortools/kernel
  useHiGHSRequested, // deprecated
  useHiGHSResolved,  // deprecated
  minimumCoverKernelCases,
  minimumCoverKernelSolutions,
  minimumCoverKernelEntries,
  fastDominancePreviewBudget,
  fastDominancePreviewStates,
  fastProbeBudget,
  fastProbeStates,
  fastThresholdBudget,
  fastThresholdStates,
  fastFallback,
  fastDecision,
  humanQualityExact,
}
```

`minimalCount` is always exact. `humanQualityExact` refers only to the secondary
quality proof.

## legacy-minimals

Same core input except adaptive secondary/backend options are not used. The
legacy function is synchronous at the feature layer and exists for
compatibility/reference. Production callers should prefer `minimals`.

## per-save-minimals

```js
{
  sourceFumen,
  pattern,
  targetLines: 4,
  useHold: true,
  exactHumanQuality: 'true',
  Primary: 'Auto',
  secondary: 'auto', // same exact-secondary policy/options as minimals
  candidateLimit: 16, // compatibility only; does not truncate exact single-queue results
}
```

Result:

```js
{
  targetLines,
  occupiedCells,
  remainingCells,
  piecesNeeded,
  expectedQueueLength,
  total,
  pcSuccess,
  pcRate,
  results: {
    T: {
      success,
      pcSuccess,
      total,
      saveRate,
      guaranteed,
      minimalCount,
      coverageCounts,
      playableOrderCount,
      label,
      humanQualityExact,
      minimumCoverBackend,
      cardinalityBackend,
      qualityBackend,
    },
    // ...
  },
  pageCounts,
  fumen,
}
```

Every expanded queue must have exactly `piecesNeeded + 1` pieces.

## solve-one

Requires one exact queue of exactly `piecesNeeded` pieces.

Result includes geometry counts and either one preferred Fumen or `fumen: null`
when unsolved. The preferred solution maximizes `playableOrderCount`, then uses
the stable solution key. A returned solution always has a positive integer
`playableOrderCount`; missing, zero, or malformed quality metadata is treated as
an internal/backend error rather than silently converted to zero.

## solve-all

Requires one exact queue of exactly `piecesNeeded` pieces. Returns
`solutionCount` and a combined Fumen containing every distinct solution.

## per-save-all

Requires one exact queue of exactly `piecesNeeded + 1` pieces. Returns every
solution grouped by saved piece with `pageCounts`.

## fourth

4-line only compound helper:

```js
{
  sourceFumen,
  hold: 'T',
  nextPair: 'IL',
  useHold: true,
}
```

Returns generated path/save patterns, solved count, and cumulative ranked save
categories.

## fifth

4-line only. Production `fifth` is Promise/adaptive and returns:

```js
{
  total,
  bestsave,
  usages,
  pageCounts,
  fumen,
}
```

## Batch inputs

Batch operations require integer `clear` values from 2 through 6; fractional, string, NaN, and out-of-range heights are rejected before dispatch.

### cover

```js
{
  sourceFumen,
  pattern,
  clear: 4,
  mode: 'normal',
  mirror: 'no',
  useHold: true,
}
```

Returns `covered`, `total`, `failedQueues`, percentage and analyzed targets.

`mode` accepts `normal`, `b2b`, `any`/`tsm`, `tss`, `tsd`, `tst`, `tetris`,
`tetris-end`, `1l`..`4l`, and `1l-or-pc`..`4l-or-pc`. T-spin modes use exact
Jstris-180 locked reachability. `tsm` accepts a line-clearing Mini or Regular
T-spin; `tss`/`tsd`/`tst` require a Regular T-spin clearing at least 1/2/3 lines.

Multi-page Fumens have two behaviors. Unrelated pages are separate cover targets.
A continuous locked-operation history (including solution-finder `spin --split
yes` output) is detected and unfolded into one target so line-clear history is
preserved. A 4-line history may temporarily use an internal 5- or 6-row
reachability domain; this does not change the requested `clear` value. The
internal height is chosen from all occupied page-field cells and operations so
upper blockers that affect a later spin/tuck are not truncated.

### coverpercent

Accepts `coverPattern` and `percentPattern`; `pattern` can act as the common
fallback. It ranks cover targets by PC solve percentage and returns a Fumen.

### congruent

```js
{
  sourceFumen,
  pattern,
  clear: 4,
  blueGarbage: false,
  useHold: true,
}
```

Returns alternate solutions and a Fumen. Throws if no congruent solution exists.

### congruentcover

Combines congruent generation with cover analysis. Supports `mode`, `mirror`,
`blueGarbage`, and `useHold`.

See `BATCH_ENGINE.md` for target Fumen/color/physics semantics.

## Input errors

The runtime intentionally rejects malformed or unsupported input rather than
silently coercing it. Examples include:

- target height outside 2–6;
- occupied cells above the selected target height;
- malformed queue patterns;
- exact queue length mismatch;
- save analysis branches without final-bag metadata;
- per-save geometry whose remaining cells are not a positive multiple of four.


## 2026-09-12 추가 계약

`congruent-cover`는 `outputMode: 'variants'`(기본), `'coverage'`, `'count'`를 지원한다.
coverage는 상세 Fumen/solutions/orders/variants를 생략하며 실패 큐는 유지한다.
count는 큐 목록도 생략하고 가중 prefix 및 BigInt로 정확 합계를 반환한다.
`cover-percent`의 `outputMode: 'count'`는 exact 합계를 추가하며 Fumen은 유지한다.
`maxSolutions`는 Rust/JS 모두 큐 검증 후의 고유 Congruent 해를 제한한다. 한도를 넘는 다음 해에서 오류가 나며 부분 결과는 반환하지 않는다.
[필드, 수명, 한도 및 fallback의 전체 계약](TODO_OPTIMIZATION_20260912.md)을 참조한다.


## Exact secondary workers (2026-09-12)

The asynchronous per-save-minimals API accepts `secondaryWorkers`:

- `"auto"` (default): retain the existing bounded integrated exact search locally; distribute expensive threshold exact searches across two request-owned workers. Hard-primary threshold searches are dispatched directly.
- `0`: serial reference execution.
- `1` through `4`: dispatch the complete exact secondary after each save's primary finishes, using that many workers.

Primary routing and settings are unchanged: Rust/HiGHS stay on the existing single execution lane, and ORTools retains two workers. Primary jobs remain sequential; a completed primary can enqueue its secondary while the next save proceeds. Tiny integrated Auto cases and single-queue shortcuts retain their existing execution paths. Fast quality mode does not dispatch secondary jobs. Custom solver objects retain local execution.

Each child owns an independent WASM instance and receives a copy of the original quality CSR, including duplicate row weights. It does not load the legal pack. The cardinality-reduced matrix is never substituted for the quality matrix. Threshold levels remain sequential within each job; the exact objective, selected-key ordering, and result metadata are preserved. Pending jobs are rejected and workers terminated on pool failure or request completion. Public client cancellation terminates the parent Worker; a new request uses a fresh parent.

Parallelism has initialization and matrix-copy costs. It cannot accelerate pattern expansion or candidate enumeration before the primary/secondary boundary. The default avoids spawning workers for exact searches completed by the existing bounded integrated search. A fixed worker count is primarily useful for measured heavy workloads; four workers are not universally faster.
