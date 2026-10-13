# Release 3.1

The runtime matches the validated linMax RC2 product at
`8b021b465ba91232c3505598add0b697a5b0da96`.

- Default P15 structural probe selection, exact Human quality and stable-ID tie proof.
- CP joins the Rust secondary search after 60 seconds and has no product deadline.
- CP failure preserves Rust progress; Rust failure starts or preserves CP.
- Quality ORs use `addMaxEquality` (linMax). Boolean/linMax triage remains future work.

## Validation scope

R18 compared frozen DEV `7ef62d18e1d155b6479e00d651c851ff3baa7112` with RC2 on
90 ALL and 40 per-save commands, six repetitions per arm (1,560 calls).
Each call had an external 600-second watchdog and a 3 GiB process-tree cap.
Those benchmark limits are not production CP deadlines.

ALL exact completions increased from 171 to 181 of 540; the 171 paired common
completions averaged 177.310 seconds in DEV and 167.110 in RC2. Per-save exact
completions decreased from 138 to 132 of 240: QB015 timed out in all six RC2
repetitions. ALL OOM outcomes increased from 36 to 43, including pcinfo036.
CPU consumption increased. The release favors ALL completion/latency gains while
accepting these documented regressions; it does not claim universal speedups,
lower memory/CPU use, or a direct performance comparison against Release 3.0.

The authored research report is
`tools/secondary-bench/planning/RC2_R18_ANALYSIS_20261013_KO.md` in the source repository.
The original run is <https://github.com/Qnia28/sfinder_wasm/actions/runs/38241601404>.

## Install and browser deployment

Extract the distribution and run `npm ci`. Shipped WASM/data require no rebuild.
See [build/deployment](BUILD_AND_RELEASE.md) and
[ORTools capabilities and isolation](../ORTOOLS_INTEGRATION_AND_LICENSE.md).
Node/browser capability fallback remains supported. A runtime without JSPI cannot
execute CP; use a supported isolated browser or a compatible Node build for CP.
The 2026-09-27 three-engine design document describes the historical 120-second
CP budget; the Release 3.1 default is unlimited.
