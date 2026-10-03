#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export RUSTUP_TOOLCHAIN=1.90.0
unset RUSTFLAGS CARGO_ENCODED_RUSTFLAGS
mkdir -p .a0/four/build .a0/four/original .a0/four/runtime .a0/four/preflight
git archive c0cb2a048e7275bfea587d176b1954efff0a8a08 rust src | tar -x -C .a0/four/original
for mode in M1 M2 diagnostic test-control; do
  node experiments/a0-four-arm-20261003/materialize.mjs "$PWD/.a0/four/source/$mode" "$mode"
done
for arm in original control M1 M2; do
  manifest=rust/Cargo.toml
  features=()
  if [[ "$arm" == original ]]; then manifest=.a0/four/original/rust/Cargo.toml; fi
  if [[ "$arm" == M1 ]]; then manifest=.a0/four/source/M1/rust/Cargo.toml; features=(--features pc-core/a0-lower-cutoff); fi
  if [[ "$arm" == M2 ]]; then manifest=.a0/four/source/M2/rust/Cargo.toml; features=(--features pc-core/a0-last-sibling); fi
  cargo build --manifest-path "$manifest" -p pc-wasm --release --locked --offline --target wasm32-unknown-unknown --target-dir "$PWD/.a0/four/build/$arm" "${features[@]}"
done
# Byte control gate must run before any synthetic/actual-input call.
node experiments/a0-four-arm-20261003/build-manifest.mjs linux
for arm in control M1 M2; do
  features=()
  manifest=.a0/four/source/test-control/rust/Cargo.toml
  if [[ "$arm" == M1 ]]; then features=(--features a0-lower-cutoff); fi
  if [[ "$arm" == M2 ]]; then features=(--features a0-last-sibling); fi
  for profile in debug release; do
    extra=()
    if [[ "$profile" == release ]]; then extra=(--release); fi
    cargo test --manifest-path "$manifest" -p pc-core --lib min_cover --locked --offline --target-dir "$PWD/.a0/four/rust-tests" "${features[@]}" "${extra[@]}" -- --test-threads=1 > ".a0/four/preflight/rust-$arm-$profile.log" 2>&1
  done
done
# The two fixes must not silently become a combined fifth arm.
if cargo check --manifest-path .a0/four/source/test-control/rust/Cargo.toml -p pc-core --locked --offline --features a0-lower-cutoff,a0-last-sibling --target-dir "$PWD/.a0/four/rejected" > .a0/four/preflight/combined-rejected.log 2>&1; then
  echo "combined feature guard failed" >&2; exit 1
fi
grep -q "Four-arm experiment requires independent M1 and M2 builds" .a0/four/preflight/combined-rejected.log
node experiments/a0-four-arm-20261003/synthetic.mjs > .a0/four/preflight/synthetic.json
for arm in A0 M1 M2; do
  features=pc-wasm/a0-diagnostics
  if [[ "$arm" == M1 ]]; then features+=,pc-core/a0-lower-cutoff; fi
  if [[ "$arm" == M2 ]]; then features+=,pc-core/a0-last-sibling; fi
  cargo build --manifest-path .a0/four/source/diagnostic/rust/Cargo.toml -p pc-wasm --release --locked --offline --target wasm32-unknown-unknown --target-dir "$PWD/.a0/four/build/diag-$arm" --features "$features"
done
node experiments/a0-four-arm-20261003/diagnostic-build.mjs
node experiments/a0-four-arm-20261003/diagnostic-fixture.mjs linux > .a0/four/preflight/diagnostic-synthetic.json
node --test --test-concurrency=1 experiments/a0-four-arm-20261003/contracts.test.mjs experiments/a0-execution-diagnosis-20261003/watchdog.test.mjs > .a0/four/preflight/harness.log 2>&1
python3 -m unittest discover -s experiments/a0-four-arm-20261003 -p test_analysis.py -v > .a0/four/preflight/analysis.log 2>&1
