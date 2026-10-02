#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../rust"
cargo build -p pc-wasm -p batch-wasm --release --target wasm32-unknown-unknown --offline
cp target/wasm32-unknown-unknown/release/pc_wasm.wasm ../wasm/pc_wasm.wasm
cp target/wasm32-unknown-unknown/release/batch_wasm.wasm ../wasm/batch_wasm.wasm
