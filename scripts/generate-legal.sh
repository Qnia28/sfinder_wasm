#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/rust"
OUT="generated/legal_late_h4"
cargo run -p legal-gen --release --offline -- 4 7 "$OUT"
cp "$OUT/legal_boards_4.lgb" "$ROOT/wasm/legal_boards_4.lgb"
printf 'generated %s\n' "$ROOT/wasm/legal_boards_4.lgb"
