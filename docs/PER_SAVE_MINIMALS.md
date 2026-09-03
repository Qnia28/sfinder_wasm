# Per-save minimals

`per-save-minimals` finds independent representative/minimal solution sets for
every piece that can be left unused by a P+1 queue.

## Input geometry

The feature analyzes the Fumen exactly as supplied. It does not infer a
historical setup phase or how many pieces were placed before the current state.

`targetLines` must be 2 through 6. `clear` is a compatible alias.

```text
remainingCells      = targetLines * 10 - occupiedCells
piecesNeeded        = remainingCells / 4
expectedQueueLength = piecesNeeded + 1
```

A request is valid only when:

- the board fits within `targetLines`;
- `remainingCells > 0`;
- `remainingCells` is divisible by four; and
- every expanded queue has exactly `expectedQueueLength` pieces.

Every valid PC solution therefore uses exactly `piecesNeeded` pieces and leaves
exactly one piece unused.

## One concrete queue

The single-queue path is exact and does **not** run a set-cover matrix.

1. Enumerate the complete structural PC result for the queue.
2. Group solutions by the exact saved piece.
3. For each save group, maximize the number of distinct playable piece-placement
   orders.
4. Resolve exact ties with the stable geometry key.

The historical `candidateLimit` argument remains accepted for API compatibility
but does not truncate the production result.

## Pattern / multiple-case input

All cases share enumeration work where possible. For each saved piece:

1. identify cases having at least one solution that saves that piece;
2. build the solution coverage matrix;
3. solve the exact minimum-cardinality cover;
4. among equal-cardinality covers, maximize the deterministic sorted per-case
   playable-order quality vector; then apply stable-key tie-breaking.

Small matrices can use the integrated exact solver path. Broad matrices keep
numeric solution IDs through the Rust/WASM minimum-cover call.

The same shared PC-enumeration policy applies as other PC features: 4-line small
workloads retain the legal-board/oracle scalar path, while broad matrices can
reuse the multiset geometry DAG and Queue/Hold trie. 5–6 line compatibility
analysis uses the generic structural path.

## Save rate and guarantee

The save rate is conditional on PC success:

```text
P      = cases with any PC solution
S[p]   = cases with a PC solution that saves p
rate   = |S[p]| / |P|
star   = |P| > 0 and |S[p]| == |P|
```

Therefore a setup whose overall PC rate is below 100% can still have a
guaranteed T save among every queue where the PC succeeds.

## PC 0% contract

PC 0% is a valid empty analysis, not an exception:

- `pcSuccess = 0`;
- `pcRate = 0` for a non-empty input case set;
- every piece has `success = 0`;
- every `saveRate = null`;
- every `guaranteed = false`;
- every `minimalCount = 0`;
- the output Fumen contains only the intro page.

## Output ordering

Within each Save group, selected solutions are emitted in descending coverage
order. Equal coverage uses solution key ascending. This is presentation order
only; it does not change exact cover selection.

See `API_REFERENCE.md` for the public result shape.
