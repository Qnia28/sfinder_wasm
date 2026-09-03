# JavaScript API reference

This is the current public/runtime contract for Release 2.7.

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
  UseHiGHS: 'auto',
  fastStateBudget,        // optional expert tuning: main integrated Fast probe budget
}
```

`UseHiGHS` and `useHiGHS` are both accepted; `useHiGHS` wins when both are set.

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
  useHiGHSRequested,
  useHiGHSResolved,
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
  UseHiGHS: 'auto',
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
