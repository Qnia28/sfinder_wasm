# Minimum-cover proof and quality optimization

The default `primaryProof: "standard"` keeps the existing cardinality formulation.
Quality evaluation uses reversible prefix maxima in Rust and weighted identical
rows plus sparse candidate updates in JavaScript. Search budgets, traversal order,
the maximin quality objective, stable-ID tie breaking, and local pass limits are
unchanged. These optimizations apply within a single request; there is no new
cross-request cache.

For hard HiGHS requests, explicitly select `primaryProof: "rounded-cuts"`:

```js
const result = await runWorkerRequest({
  kind: "minimals",
  input: {
    sourceFumen: "v115@9gC8GeC8GeC8GeC8QeAgH",
    pattern: "I,*!",
    wantedSave: "",
    clear: 4,
    useHold: true,
    exactHumanQuality: "Fast",
    Primary: "HiGHS",
    primaryProof: "rounded-cuts",
  },
});
```

The same option is accepted by `calculateMinimalsFeature`, `calculateSaveMinimals`,
`minimumCoverAsync`, `minimumCoverAdaptiveAsync`, and the low-level
`solveCardinality` options. It changes only HiGHS cardinality solves. Rust and
kernel-only decisions still use their existing path. The adaptive tiny legacy
path is also unchanged. Only `"standard"` and `"rounded-cuts"` are accepted.

The cut module solves a root LP, deterministically samples three-row aggregations,
retains at most 64 violated valid inequalities, and verifies their coefficients
from the source rows. The original covering rows remain in the integer model.
An optimal witness is checked against the original matrix. A root LP without a
finite optimal point falls back to the standard formulation.

This option is not an automatic speed guarantee. In the reference corpus the
3×4 BOX 8-piece queue improved, while the 7-piece queue became slower and its
bounded Fast quality became worse with cuts. Exact minimum cardinality remains
preserved, but a different MIP incumbent can lead Fast to a different local quality
optimum. Keep the option off for ordinary requests until the workload is validated.
Any supplied low-level `time_limit` applies to each HiGHS call independently,
not to total wall-clock time including root LP, cut generation and quality work.

Build the changed `pc_wasm.wasm` together with the Rust source. Deploy the complete
`src/` directory, including the new `min-cover-rounded-cuts.mjs`, with the existing
WASM/legal assets. `batch_wasm.wasm`, movement rules and legal tables are unchanged.
