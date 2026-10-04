#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export RUSTUP_TOOLCHAIN=1.90.0
unset RUSTFLAGS CARGO_ENCODED_RUSTFLAGS
# Deliberately separate from build-wasm.sh: R and batch source/build never change.
source_dir="$(node scripts/materialize-a0-m1.mjs "${1:-$PWD/.a0-m1-build/source}")"
cargo build --manifest-path "$source_dir/rust/Cargo.toml" -p pc-wasm --release --locked --offline \
  --target wasm32-unknown-unknown --target-dir "$source_dir/target" --features pc-core/a0-lower-cutoff
cp "$source_dir/target/wasm32-unknown-unknown/release/pc_wasm.wasm" wasm/pc_a0_m1.wasm
node scripts/check-a0-m1-assets.mjs
