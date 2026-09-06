# ORTools integration and runtime setup

Primary accepts Auto, Rust, HiGHS, ORTools (case-insensitive); lowercase primary
is also accepted. Auto is default. After exact Rust kernelization, choose ORTools
iff cases >= 200, candidate solutions >= 112, and incidence entries >= 2200.
Otherwise choose Rust. A solved residual kernel bypasses all solvers.
If a wide kernel selects ORTools but required runtime capabilities are unavailable,
Auto falls back to HiGHS. HiGHS also remains explicitly selectable. The selector does
not change quality hardness classification, Fast budgets, or the K objective.

## Solver and proof

Official OR-Tools 9.15 commit: 551ad10d94835c99e5e1e684500d3db398c0e345.
WASM bridge/API port commit: a16c07886b1db846248a477ed5c06ba93c484493
(Axelwickm/or-tools-wasm).

Profile: numWorkers=2, subsolvers=['max_lp'], randomSeed=1,
addZeroHalfCuts=false, useSatInprocessing=false. No benchmark-derived time cap
is imposed in production. Only OPTIMAL with matching objective and lower bound
is accepted. Selected IDs, forced IDs, uniqueness and all kernel rows are checked.
A failed proof throws instead of returning an approximate minimalCount.

Each solve owns a disposable Worker, lazily loads CP-SAT, terminates its
Emscripten pthreads, and closes the Worker on success/error. Repeated/concurrent
calls do not share a CP-SAT instance. The public SolverWorkerClient serializes
requests; cancellation terminates its worker tree. Use this client for cancellation.

## Browser and Node setup

Browsers need WebAssembly JSPI (promising/Suspending), SharedArrayBuffer and
cross-origin isolation. Serve HTTPS or localhost with:

    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp

Assets must be same-origin or satisfy the embedder policy. Chrome 152 was
verified against a Vite production build. Only JSPI assets are included; there
is no Asyncify runtime. Before an Auto ORTools solve, check JSPI, SharedArrayBuffer
and browser cross-origin isolation. If any is unavailable (including deployments
without COOP/COEP), use HiGHS for that kernel. No ORTools Worker or runtime is loaded
on this fallback path. In Node, cross-origin isolation is not required.

Explicit Primary=ORTools still reports an unsupported-environment error; explicit
Rust/HiGHS choices are unchanged. This is a capability fallback, not a catch-all
retry: missing assets, worker/load errors, failed solves and invalid proofs remain
errors. Keep both HiGHS and ORTools assets in a deployment that supports Auto.
Fallback results report primaryRequested='auto', primaryResolved='highs',
cardinalityBackend='highs', and useHiGHSResolved=true. The K proof and secondary
quality settings remain unchanged.

Frontend integration: use Primary=Auto when the application must run with or
without COOP/COEP. Those headers improve backend availability; they are not a
requirement for the HiGHS fallback. Do not disable Auto solely because isolation
is unavailable. Surface explicit ORTools support errors when users force that mode.

Node 24.13.0 was verified with:

    node --experimental-wasm-stack-switching your-script.mjs

Node Worker options use empty execArgv: V8 flags are inherited by worker isolates,
while explicitly supplying experimental V8 flags in Worker options is rejected.

## Assets and bundling

Keep src/ortools-min-cover.mjs, src/ortools-primary-worker.mjs and
src/vendor/ortools/ together. Browser and Node use separate glue files. Their
8,038,746-byte WASM files contain the same CP-SAT runtime.

The existing src/worker-client.mjs factory was verified in Vite 8.2.2 production.
Browser bundle/loader modifications remove unused Asyncify/other-solver asset
references and the unused upstream executor worker factory. The sfinder adapter
owns its Worker and chooses direct execution. Node-only imports are ignored by
the browser bundler.

## Quality

K and coverage remain exact. Fast's bounded secondary result can change when
the primary solver supplies a different exact-K witness. Rust remains selectable.
ExactHumanQuality=True keeps the complete fixed-K quality proof.

## License audit

Project-owned source is Apache-2.0. OR-Tools and the port are Apache-2.0.
Other bundled components retain their own licenses, including Eigen MPL-2.0
source and Rust runtime notices. The reviewed distribution and recorded build
inputs did not identify a GPL dependency requiring the project to remain GPL.
Historical tetra-tools use is recorded as reference-only with no source/crate
linked; this relies on the existing provenance record, not a new line-by-line
historical authorship audit.

Preserve LICENSE, NOTICE, THIRD_PARTY_NOTICES.md and third_party/.
See `THIRD_PARTY_NOTICES.md` and `third_party/ORTools/Eigen/SOURCE.md` for
component notices and the supplied Eigen source.
