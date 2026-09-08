# Remaining Cover / Congruent optimization work

The implemented work is grouped into three commits: (1) skip unused Cover traces,
Congruent trie rejection, and queue multiset pruning; (2) request-scoped caches,
flat DAG / numeric Cover transport, and cheaper MRV candidate selection;
(3) coverage frontier compression, 5–6-row Rust Congruent, and exact Cover count.
Do not treat the items below as implemented or as guaranteed speedups.

## P1 — Measure and reduce remaining request overhead

- [ ] Tune small-input routing for Congruent. First two paired Actions runs show
  strong gains for repeated-piece queues but mixed results on small distinct-piece
  cases. Compare scalar, cached Boolean trie, and incremental frontier probes.
  Preserve the complete valid-order set; a probe timeout is unknown, not false.
- [ ] Stage queues once per multi-target WASM request. The trie is now reused,
  but JS still packs/transmits each target's queues. Add an explicit queue-handle
  ABI with generation validation, including shared-WASM interleaving and errors.
- [ ] Add phase and cache statistics: tiling nodes, multiset rejects, prefix rejects,
  exact-lock/spin hits, DAG nodes/edges, frontier nodes/fallbacks, and JS reconstruction.
  Keep diagnostics outside timed measurements and normal product output.
- [ ] Expand the benchmark corpus beyond the checked-in deterministic fixtures:
  real multi-page histories, active T-spins, 7–15 operations, restrictive and broad
  patterns, duplicate branches, and large target collections. Record per-workload
  regressions as well as improvements, on both desktop and browser/mobile hardware.

## P2 — Tiling search and representation

- [ ] Implement truly incremental MRV with placement IDs, reverse cell indexes,
  active-candidate bitsets, candidate counters, and an undo log. Current MRV only
  avoids allocating candidate vectors for every inspected cell; it still rescans.
  Preserve deterministic candidate order or explicitly document order changes.
- [ ] Add connected-component area rejection and bounded negative tiling memo.
  Cache only proven geometric impossibility with remaining fill and remaining
  multiset constraints. Do not memoize successful states by fill alone: different
  piece colorings are distinct answers.
- [ ] Index multiset roots for incremental filtering rather than scanning every
  root at each tiling node. Benchmark broad patterns before adding more retained data.
- [ ] Define a common tiling-limit contract across Rust and the legacy JS fallback.
  Rust limits accepted solutions; legacy JS limits geometric tilings before queue
  filtering. Keep exhaustion explicit, never return a truncated answer as complete.
- [ ] Add compact/bulk transport for Congruent operations and valid orders.
  Cover variants and coverage already have bulk exports; Congruent still uses
  per-operation/order getters. Test owned buffers across memory growth and calls.

## P3 — Additional compressed and count-only paths

- [ ] Generalize PC OrderLanguage suffix interning for batch order enumeration.
  Coverage-only now interns Queue/Hold frontiers; it does not build a canonical
  successful-suffix language. Keep mode state and terminal checks in any adapter.
- [ ] Avoid unused intermediate work in congruent-cover through an explicit
  output contract. TETRIO Congruent orders cannot stand in for Jstris Cover results.
  Preserve existing coverTargets variants/orders unless the caller opts out.
- [ ] Add weighted-prefix count paths to cover-percent and congruent-cover when
  their public contract permits omission of concrete queue lists. Reuse the new
  Cover count implementation and Chance count, retaining branch multiplicity.
- [ ] Consider unique-queue bitmaps plus case remapping, and sparse/dense coverage
  storage chosen by density. Duplicate semicolon cases must retain their weights
  and original failed-queue order in list-output APIs.
- [ ] Evaluate PC legal/tail oracles only after proving compatibility with batch
  exact-lock semantics and each physics mode. Do not substitute PC reachability.

## Deliberately not a direct port

Minimals cardinality cuts, MIP/CP-SAT proof search, quality maxima, and dominated
candidate deletion optimize a selected subset. Ordinary Cover and Congruent
return all requested target/solution information. Such techniques require a new
selection objective, not an optimization flag on the existing full-output API.
