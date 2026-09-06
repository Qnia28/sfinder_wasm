# sfinder-wasm User Guide

This guide describes the current Release 3.0 behavior. It documents the
browser/JavaScript engine rather than the historical Java/Python CLI wrappers.

## Choosing a feature

| Goal | Feature |
|---|---|
| Every distinct PC solution for a pattern, ranked by coverage | Path |
| PC rate and failed queues for a pattern | Chance |
| Rate of a requested save condition | Saves |
| Smallest solution set covering successful cases | Minimals |
| Independent minimals for Save T/I/L/... | Per-save minimals |
| One preferred solution for one exact queue | Solve one |
| Every solution for one exact queue | Solve all |
| Every P+1 solution grouped by saved piece | Per-save all |
| Queue coverage of supplied target operations | Cover |
| Alternative piece decompositions of a fill region | Congruent |
| Congruent alternatives plus coverage | Congruent cover |

## Common inputs

PC analysis supports target heights from **2 through 6 lines**. Blocks above the
selected height are rejected.

SFinder-style patterns include:

```text
TOILJSZ
*p7
[JSZO]!
[LJISZ]p4
[^TIL]!
I[JS]![TO]!,*p2
TI,[JOS]!,*p2;TO,[IJS]!,*p2
```

Semicolon branches stay distinct analysis cases even when they expand to the same
queue string. Exact single-queue commands do not accept pattern syntax.

## Path

Path enumerates every distinct PC solution geometry reachable by at least one
case in the supplied pattern and returns the result as Fumen pages. It uses a
dedicated high-throughput enumeration path rather than requiring callers to run
single-queue enumeration repeatedly.

Pages are ordered by **coverage descending**. Equal-coverage pages use the stable
solution key as a deterministic tie-break. Each page comment shows that
solution's coverage over all concrete cases:

```text
32.86% (1656/5040)
```

The denominator includes every concrete case. If separate semicolon branches
expand to the same queue string, those branches still count as separate cases.
`fumen` is null when no PC solution exists for any case.

## Chance

Chance answers only whether at least one PC solution exists for each case. It
returns total/success/failed counts, failed queues, and percentage.

## Saves

Saves first collects **all exact save outcomes for one queue**, preserving
multiplicity, then evaluates the expression against that outcome set.

```text
T       at least one outcome contains T
TI      one exact outcome contains both T and I
T||I    T or I is saveable
T&&I    T is saveable and I is saveable, possibly through different outcomes
^T      at least one outcome avoids T
!T      no outcome contains T
TT      one outcome contains two T pieces
/TT/    regular expression against exact save strings
```

Thus `TI != T&&I` and `^T != !T` in Saves.

Omitted/empty `wantedSave` or `ALL` returns every exact outcome in `saveResults`.
A comma-separated string or JavaScript array evaluates multiple expressions with
one shared enumeration and returns `wantedSaveResults`.

Saves also accepts `expression#alias` as display metadata.

## Minimals

Minimals finds the exact smallest number K of solutions that covers every case
that satisfies the PC/save filter.

Omitted/empty `wantedSave` and `ALL` all mean no save filter.

Unlike Saves, Minimals evaluates one concrete solution's exact saved multiset at
a time. Therefore for that one outcome, `^X` and `!X` are equivalent, as are
`XY` and `X&&Y`. Exact multiplicity is still preserved (`T`, `TT`, `TTT` are
different and `/TT/` can match a double-T outcome).

Primary selects Auto, Rust, HiGHS, or ORTools. Auto chooses ORTools iff
residual cases ≥ 200, candidates ≥ 112, and entries ≥ 2200; otherwise Rust.
ORTools requires JSPI, SharedArrayBuffer, and browser COOP/COEP headers.
When these capabilities are unavailable, Auto uses HiGHS for kernels that meet
the ORTools threshold. Explicit ORTools still reports an unsupported-environment
error. Small kernels continue to use Rust, and solved kernels bypass all solvers.
Legacy UseHiGHS remains a compatibility alias.
`exactHumanQuality` controls the secondary objective:

- `Fast`: exact secondary result if the fixed-K proof completes within budget;
  otherwise deterministic exact-K incumbent plus 2↔2 refinement.
- `True`: continue the exact secondary proof to completion.

`minimalCount` is always exact. `humanQualityExact` reports secondary exactness.

## Per-save minimals

If the current field needs P pieces to finish the PC, every queue must contain
exactly P+1 pieces:

```text
remainingCells      = targetLines * 10 - occupiedCells
piecesNeeded        = remainingCells / 4
expectedQueueLength = piecesNeeded + 1
```

One concrete queue uses the exact per-save best solver. Pattern matrices share
enumeration and solve one exact minimum-cover problem per saved piece.
`candidateLimit` is compatibility-only and no longer truncates production
results.

## Exact single-queue solver

- `solve-one`: exact queue length P; select maximum playable-order count, then
  stable solution key.
- `solve-all`: exact queue length P; return every distinct solution.
- `per-save-all`: exact queue length P+1; group every solution by saved piece.

## Fourth / Fifth

Both are intentionally 4-line compound analyses. They use internal fixed save
categories rather than the general `wantedSave` API.

## Cover and congruent

Cover checks actual operation-order-sensitive locked reachability. Ordinary
2–4 line static targets use the dedicated batch WASM engine; 5–6 line
compatibility targets use a shared structural DAG with exact WASM lock checks.
Cover uses Jstris 180 physics.

T-spin modes are `any`/`tsm`, `tss`, `tsd`, and `tst`. `tsm` accepts a
line-clearing Mini or Regular T-spin. The other three require a Regular T-spin
clearing at least 1, 2, and 3 lines respectively, matching solution-finder 1.42
threshold semantics. Consecutive Fumen pages that form a locked-operation / line
clear / next-field chain (for example `spin --split yes` output) are decoded as
one placement history rather than unrelated static pages. A 4-line history may
temporarily expand its internal reachability roof to 5 or 6 rows. Unrelated
pages remain separate targets.

The bundled Jstris-180 T-spin path has been cross-checked against
solution-finder 1.42 on 1,280 one-page classifications, generated TSS/TSD
histories, a continuous six-row TST history whose upper blockers are required
for the rotation path, mirrored spot checks, and a legacy congruent-cover TSM
fixture. Operation-history height selection preserves occupied cells from every
page, not only the operation coordinates.

Congruent treats colored Fumen cells as a fill region and finds alternative
reachable piece decompositions. Gray/X is base garbage unless `blueGarbage` is
enabled. Congruent uses TETRIO 180 physics.

Congruent cover generates alternatives first and then evaluates their queue
coverage.

## Further reference

- `README.md`
- `docs/API_REFERENCE.md`
- `docs/SAVE_EXPRESSIONS.md`
- `docs/PER_SAVE_MINIMALS.md`
- `docs/SINGLE_QUEUE_SOLVER.md`
- `docs/BATCH_ENGINE.md`
- `docs/ARCHITECTURE.md`
