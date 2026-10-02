# Fumen processing

Fumen input and output use the public API of `tetris-fumen` 1.1.3. The decoder
still reads the complete source, including trailing pages. Feature validation,
error types, output fields, comments, flags, operation history and page order
retain their existing contracts.

## Request-local input reuse

`Page.field` copies the field. Board and batch scans read that getter once per
scan. PC validation reads one field snapshot and obtains the highest occupied
row and target bitboard in one traversal; each row is accumulated as a 10-bit
number before conversion to BigInt.

Minimals, per-save-minimals and fifth wrappers pass their validated board/page
to the calculation helpers as an optional second argument. Single-queue output
reuses the page returned by `pcGeometry`. These feature entry points decode the
source once per request. Existing standalone helper calls remain supported.
There is no global decoded-page cache or change to `Page.field` itself.

`combineWithIntro` optionally receives the already decoded source page. It builds
an intro with the requested title and copied flags instead of mutating the
caller's page. Decoded fields remain independent; the public encoder handles
operations, quiz comments, lock, mirror, rise and colorization as before.

## Output field construction

`solutionPage` extracts 10-bit numeric rows from the board and seven masks,
then fills a public, independently mutable `Field`. It avoids the intermediate
tiling string and its reparsing, and replaces per-cell BigInt tests with numeric
bit tests. Overlapping masks retain the first matching `IJLOSTZ` color priority;
piece colors still override the initial-board gray cells.

The standard encoder still performs its own field conversion and Fumen encoding.
This change does not add a custom codec or access private library fields.

## Validation and measurement

The September 9 validation passed 347 Node tests and 28 Chrome Worker comparisons.
It includes 300 randomized 2–6-line output fields, 32 intro flag combinations,
per-request decoder instrumentation, and complete output comparisons against a
snapshot containing the preceding local geometry/CSR and Cover/Congruent work.

Measurements use initialized WASM and include result encoding, but exclude
Worker startup and message transport. Performance depends on input size and
solver cost; the recorded warm-call improvements are not fresh-Worker speedups.
Full evidence is kept in the tools workspace under
`validation/fumen-optimization-20260909/RESULT_KO.md`.
