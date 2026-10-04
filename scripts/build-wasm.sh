#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../rust"
# B is the product default. A disables only rootForced; reference disables both.
threshold_mode="${SFINDER_THRESHOLD_MODE:-B}"
case "$threshold_mode" in
  B) features="pc-wasm/threshold-current-propagation,pc-wasm/threshold-root-forced" ;;
  A) features="pc-wasm/threshold-current-propagation" ;;
  reference) features="" ;;
  *) echo "Invalid SFINDER_THRESHOLD_MODE: $threshold_mode (expected B, A, reference)" >&2; exit 2 ;;
esac
feature_args=(--no-default-features)
if [[ -n "$features" ]]; then feature_args+=(--features "$features"); fi
cargo build -p pc-wasm -p batch-wasm --release --target wasm32-unknown-unknown --offline "${feature_args[@]}"
cp target/wasm32-unknown-unknown/release/pc_wasm.wasm ../wasm/pc_wasm.wasm
cp target/wasm32-unknown-unknown/release/batch_wasm.wasm ../wasm/batch_wasm.wasm
