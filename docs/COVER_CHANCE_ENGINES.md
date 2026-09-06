# Cover and probability engines (2026-09-06)

These additions build on the September 5 minimum-cover and routing changes.
No persistent result cache is required.

## Cover

`calculateCover()` keeps its default complete `variants`, `orders`, and trace
output. The Rust engine now accepts 2–6 rows and up to 15 operations. The wide
clear-history export is used above ten operations; older WASM retains the JS
fallback for tall inputs. Both Jstris and Tetr.io geometry are supported by the
low-level backend; the public Cover feature retains its existing Jstris setting.
Congruent's 5–6-row JS fallback is unchanged.

```js
const result = await calculateCover({
  sourceFumen, pattern: '*!', clear: 6,
  outputMode: 'coverage', // default: 'variants'
});
```

Coverage-only returns the existing coverage, failed queues, target metadata and
covered queues, while omitting each target's `variants` and `orders`. It checks
Queue/Hold viability before generating a geometric edge. Prefix identity is part
of the memo key, and traversal memoization preserves the terminal mode checks.
Default Cover still generates all valid variants, including ones that do not
match the supplied queues. It discards only structurally unproductive edges.

Cover and PC projection share the Rust Queue/Hold trie, including duplicate-case
remapping and the last held piece. Cover reuses reference-counted coverage masks
within a call, with a 16 MiB estimated mask-cache retention limit. That estimate
does not bound the geometry DAG, output traces, trie, or total WASM memory.

A discovered pre-existing `buildVariants` bug was also fixed: visited-state keys
now retain operation IDs, so distinct histories with identical piece order and
clear timing are not dropped.

## Probability counts without full pattern expansion

```js
const result = calculateChance({
  sourceFumen, pattern: '*!,*!', clear: 4, solver,
  outputMode: 'count', // default: 'queues', with failedQueues
});
// Also exported from features.mjs:
const counts = calculateChanceCount({ sourceFumen, pattern, solver });
```

Count-only accepts the existing fixed pieces, partial/full bags, complements,
order constraints, and semicolon branches. It preserves branch multiplicity.
Bag suffixes are counted with BigInt DP; no full suffix permutations are stored.
At most `req + 1` pieces can matter with Hold (`req` without Hold). For patterns
over one million cases, the engine first tries `req` pieces: a successful order
remains playable with any continuation. Only failed prefixes require the extra
Hold lookahead. Prefixes are processed in bounded batches (default 65,536;
`maxBatchPrefixes` accepts 1..1,000,000). This is exact streaming, not sampling.
It can still be expensive when the number of relevant prefixes is very large.

The result has `total`, `success`, `failed`, `percent`, `outputMode: 'count'`,
`evaluatedPrefixes` and decimal-string `totalExact`, `successExact`, `failedExact`.
The first three counts are Numbers when safe integers, otherwise decimal strings.
`evaluatedPrefixes` counts actual evaluations, including repeated/chunked or
refined prefixes; it is not the total number of complete pattern cases.
`failedQueues` is deliberately absent. Existing queue-output APIs retain their
one-million-case expansion limit. Both new output modes pass through the existing
worker request input without a new worker message type.

## Compressed successful-order language

The probability pattern backend can intern identical successful suffix languages,
union same-piece transitions, and project the resulting acyclic language directly
against the shared Queue/Hold trie. Geometry paths and distinct orders are not
materialized on that path. Full enumeration/minimals continue to preserve their
placement, save-weight, and distinct-order-count contracts.

Automatic mode uses compression when there are at least 100,000 successful
geometry paths (counting saturates at one billion). Corpus tests did not support
always enabling it: BOX 8P and several small inputs incurred additional cost.
This is a conservative measured heuristic, not a universal speed guarantee.

```js
solver.setProbabilityEngine('compressed'); // 'auto' default, or 'legacy'
solver.setProbabilityEngine('compressed', { maxLanguageNodes: 0 }); // exact fallback
solver.probabilityStats(); // last pattern call: geometryPaths, languageNodes, budgetFallback
```

This selector only affects the pattern existence backend; it does not override
scalar/pattern routing. The additional representation budgets are 200,000
language nodes, one million union memo entries, and one million visited product
states. Budget exhaustion drops the partial result and uses the legacy exact
order projection. They are not hard limits on geometry construction or total
memory. No approximate answer or changed search budget is introduced.

## Validation and measurements

Node 24.13.0, Windows, i5-1240P; Rust 1.90.0, real WASM binaries. All benchmark
workloads ran sequentially. Absolute measurements are examples, not guarantees.

- 252/252 Node regression tests pass; WASM-target all-target Clippy with warnings
  denied, Rust formatting, and both release WASM builds pass.
- 45 dataset fixtures: full enumeration matrices match the prior integrated build,
  including masks, saves, original case IDs, and distinct order counts.
- 51 probability fixtures × three paired first-call comparisons: same success
  sets, including pcinfo019, BOX 7P/8P, and four active five-row cases.
- Actual active 4/5/6-row trace comparisons against the JS geometry traversal,
  including twelve I operations and the 64-bit clear history; both physics modes.
- Coverage-only: all 16 modes, Hold on/off, mirrors, duplicate branches, and a
  15-operation six-row tiling. Forced language-budget fallback matches legacy.
- Synthetic empty 6-row/O×15 probability pattern call: 168,168,000 successful
  geometry paths collapse to 17 language nodes. One fresh-solver comparison was
  2,421 ms legacy → 25 ms automatic (26.6 ms forced compressed).
- BOX `*!,*!`: 25,401,600 complete queues, evaluated through 5,040 prefixes,
  all successful; three fresh-solver count-only runs were 422/369/369 ms.
  A mixed-success board on the same pattern evaluated 18,564 prefixes in
  138/134/137 ms; counts match the independently observed eight-piece prefix
  oracle, including failures and duplicate branch weights.
- Coverage-only can avoid very large trace output: an impossible queue for an
  O×10 tiling took about 0.1 ms versus 133 ms prior full-output Cover. These output
  modes have intentionally different contracts. Ordinary full-output Cover is
  not uniformly faster; the same large-trace test was 179 ms on the new build.

These are Cover/probability measurements, not additional minimum-cover proof
speedups. Native host Rust tests and browser UI E2E were not executed; WASM-target
all-target Clippy and real WASM/Node worker dispatch are used for validation.
