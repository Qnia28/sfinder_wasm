# Existence routing and placement retention

Existence requests deduplicate identical queue strings before dispatch and remap
the Boolean results to every original case. Duplicate cases keep their original
order and multiplicity. Full enumeration, path and minimum-cover routing retain
their separate profiles.

For heights 5–6, requests with 64–255 unique queues can use a bounded scalar
probe before selecting a backend. Up to 16 stratified queues, with a fixed seed,
are tested with at most 256 DFS nodes each. Exhaustion returns unknown, never
false, and stops further probing. Completed results are reused in the final
output. Unknown queues are solved exactly by the selected backend. Placement
entries created during probing remain valid; partial dead-state memo tables are
discarded. The node budget bounds DFS work, not wall-clock time or every lock
generation operation.

The selector uses measured scalar node cost and queue multiset density (a proxy
for geometry sharing). Already-large tall requests keep the existing pattern
path without probe overhead. The 4-line dispatcher uses unique queue count but
keeps its established crossover: testing per-queue-cost promotion on 45 setups
showed regressions on small shared geometry DAGs. No board-specific whitelist or
automatic 4-line promotion based on that unsuccessful model is included.

The placement cache no longer clears all entries above 32,768 entries. Each
entry records its last request epoch. At request boundaries, an estimated byte
budget triggers retention of recently used entries up to 75% of the budget.
The default is 8 MiB. Payload estimates include placement arrays plus conservative
per-entry bookkeeping; they are not measurements of total WASM memory, hash-table
capacity or allocator overhead. Large individual searches can temporarily exceed
the retention budget. This policy also runs between queues in a scalar batch, so
it can reduce repeated work inside a single public request.

Advanced callers can use `solver.setPlacementCacheBudget(bytes)` (1 KiB–256 MiB).
`solver.stats()` adds `cacheEstimatedBytes` and `cacheEvictions`. Legal-pack or
pruning-rule changes continue to invalidate both cached placements and byte
accounting. Cache keys still distinguish height-specific board/piece information;
no queue-dependent dead memo or cross-request minimum-cover result cache is added.

Use the matching rebuilt PC WASM and JavaScript files. With an older WASM, the
bounded probe reports unknown and the existing backend choice remains available;
the new budget setter requires the new WASM export. Browser memory tuning should
be measured on the target device because the budget concerns retained placement
payload, not the overall browser/Worker memory ceiling.
