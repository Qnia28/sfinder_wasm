# Isolated A0 cycle1 Actions campaign

Only `test/a0-cycle1-actions` pushes trigger this workflow. Other branches and
workflow runs are not modified or cancelled (`cancel-in-progress: false`).
Initial execution uses the branch-scoped push trigger because workflow_dispatch
registration may require a workflow on the default branch; main is untouched.

## Scope and provenance

Frozen Dev working-copy snapshot: source tree SHA-256
`57c7d52917c105a1fd021dbe5fb5fc0ad92023d13f4efcdf8cb9f5f6f9fe9470`.
Original preparation manifest and all 440 per-file hashes are kept under
`attempt-04/prep`. Local paths in that manifest are historical, not CI inputs.
The Actions runner rebuilds once from those sources with Rust 1.90.0.
The actual CI binary hash, toolchain and correctness evidence are recorded in
the build artifact; both treatments download this same binary. Do not assume
Linux rebuild binary hash equals the previous Windows rebuild.

Node 24.13.0, standard public-repository Ubuntu 24.04 hosted runners only.
No paid larger runners, deployments, product default changes or main merges.
Workflow token is contents-read only; no secrets are used.

Attempt 02 inputs: 81 eligible saved snapshots, strict dedup to 73 matrices.
Primary K/seed and ordered original rows/edges/qualities are reused, not rerun.
The frozen global schedule hash is
`6803239e70d52e6099d270e344059218ca6aacf78eedf3cb73f927ea319de9ad`.
Four repetitions per treatment, 584 total fresh-Worker runs, 100K state budget,
60 second per-run deadline. Same matrix and all eight jobs stay on one runner.
Shards 0/1/2/3 own 19/18/18/18 matrices by global catalog index modulo four.
Shard schedules retain global sequence and renumber local sequence only.

## Execution and interpretation

1. Pure harness tests and all saved-input/source hashes.
2. Native debug/release partition tests; 168 independent synthetic fixtures
   against the actual WASM ABI with bounded/exact witnesses and repeated calls.
3. Four independent shards, pairs serial inside each shard. `fail-fast: false`
   prevents one shard from cancelling other shards.
4. Aggregate full witnesses and vectors, original-row validation, deterministic
   repeated outputs, correctness/quality/states and preregistered latency gates.

Actions CPU variation still exists. Report CPU/image/version by shard, per-matrix
paired ratios and per-shard aggregate ratios. The pooled absolute wall sum is
descriptive, not proof of identical hosts; there is no automatic promotion.
Hard timeouts accept loss of in-flight incumbent and retain null, never fabricate
a returned witness from the input seed. Missing/timeout comparisons fail full gate.

## Artifacts and isolation

Build+correctness <=5 MiB; each of four full-ledger shards <=15 MiB; combined
analysis <=15 MiB. Total uploaded payload <=80 MiB (under 100 MB), retention 7 days.
Rust target/toolchain, duplicated inputs and core dumps are not uploaded.
Evidence upload runs on failure too. A rerun uses a new Actions attempt, not an
overwrite/resume of selected successful measurements. All four shards must be
present for the global report to claim completion.

Local preflight only: `node ci/a0/ci-run.mjs preflight`. Actual search is performed
by Actions, not by the local preparation checks.
