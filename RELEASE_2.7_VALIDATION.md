# Release 2.7 validation — 2026-09-03

Release 2.7 was promoted from the rebuilt Structure Refactor Phase 4 checkpoint.
That checkpoint was freshly reimplemented from the preserved Phase 3 canonical
ZIP after the first Phase 4 runtime tree was lost, then fully revalidated before
promotion. Release promotion itself changes documentation/version state only.

## Full regression

JavaScript/WASM was executed across all 53 test files in three groups to avoid a
single-process wall-time limit:

```text
group 1: 64 / 64 PASS
group 2: 95 / 95 PASS
group 3: 74 / 74 PASS
total:  233 / 233 PASS
```

Rust:

```text
pc-core unit tests: 67 / 67 PASS
legal/oracle tests:  4 / 4 PASS
```

Release hygiene:

```text
cargo fmt --all --check                                  PASS
cargo clippy --workspace --all-targets --offline -- -D warnings  PASS
cargo test --workspace                                   PASS
cargo build -p pc-wasm --release --target wasm32-unknown-unknown PASS
npm run build:wasm                                       PASS
```

## Runtime artifact SHA-256

```text
4a5bc4acac274c10b4dc57ac5a047e04ea39a0ac347a71fd6506596ec2fb7bd2  wasm/pc_wasm.wasm
2a1a1f6c2a0a1710040f997860247df6d72c6cf4a9959c9a261329bd302650d4  wasm/batch_wasm.wasm
7e6432b2b26f4fab9f6d9bac55da43307c7a4b1b071cb204cb4d23e1901bc4d0  wasm/highs.wasm
```

The rebuilt Phase 4 WASM artifacts were byte-identical to Phase 3 and reproduced
the same hashes after `npm run build:wasm`. Release 2.7 changes no Rust/runtime
code relative to that validated checkpoint.

## Key performance evidence carried into the release

### Single queue

Empty 4L + `TIZLISOZJTO` `per-save-all` retained:

```text
solutions = 1678
T 165 / I 16 / L 23 / J 118 / S 121 / Z 274 / O 961
Fumen SHA-256 = 68f0937da11bcfc134f6263e47c16ff1868eff44b84a53f084ad81c0aa25f211
```

Representative optimization A/B reduced whole-request time by about 9% versus
the pre-optimization concrete enumeration path.

### Cross-command routing

Representative accepted A/B measurements included:

```text
4L full pattern, 64 cases:  ~8.96 ms -> ~1.65 ms  (~5.42x)
5L full pattern, 8 cases:  ~10.15 ms -> ~4.41 ms (~2.30x)
Fifth, 1008 cases:          ~62.22 ms -> ~28.85 ms (~2.16x)
7P Congruent:               ~64.21 ms -> ~25.22 ms (~2.55x)
```

Broad 4L existence benefits varied strongly by setup; the conservative
2,048-case routing threshold was retained because small LEGS-like batches can
still favor scalar existence.

### Structure refactor

Phase 1–4 performance checks found no meaningful regression on retained Chance,
Fifth, Congruent, CoverPercent, Fast Minimals, or 11-mino per-save-all hot paths.
A proposed separate fixed-K Rust module was specifically reverted when it showed
about a 5% GRACE Fast slowdown.

## Deliberately excluded experiments

The following investigated changes are not part of Release 2.7:

- prepared fixed-K CSR reuse across minimum-cover stages: correctness matched,
  but repeated warm A/B was neutral-to-slower;
- Saves membership-only Rust pattern backend: no 4L benefit and a 5L regression;
- 5–6L reconstruction-only queue-prefix pruning: did not reduce DAG construction
  and was neutral-to-slower;
- stage-7 first/pair/triple finishing oracles for heavy single-queue enumeration:
  state reduction was too small to justify complexity;
- forcing a single concrete queue through the pattern DAG, placement-cache caps,
  cache pre-reserve, request-local arenas, and operation-dedup removal: all were
  neutral or regressive in retained experiments.

A future 5–6L Batch optimization should prune during DAG construction by carrying
queue/Hold automaton state, rather than adding checks only during reconstruction.

## Packaging policy

The Release 2.7 ZIP excludes development-only state including:

```text
.git/
node_modules/
rust/target/
extracted Rust toolchains
benchmark/prototype scratch directories
```

It includes current source, tests, runtime assets, licenses/notices, Release 2.6
historical notes, Release 2.7 notes/validation, and the current API/architecture
and user documentation.
