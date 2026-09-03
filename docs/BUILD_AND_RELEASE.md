# Build, test, and release guide

## Requirements

Runtime use requires Node/npm only for development/install; browser deployments
consume the shipped JS and WASM assets.

Rebuilding requires:

- Rust toolchain with `wasm32-unknown-unknown` target;
- standard shell tooling used by `scripts/build-wasm.sh`;
- Node/npm.

HiGHS is already distributed as `wasm/highs.wasm`. Rebuilding HiGHS is separate
from the normal `npm run build:wasm` flow.

## Install

```bash
npm install
```

## Build Rust/WASM

```bash
npm run build:wasm
```

The expected outputs are:

```text
wasm/pc_wasm.wasm
wasm/batch_wasm.wasm
```

`wasm/highs.wasm` is the separately maintained highs-js/HiGHS 1.15.1 asset.

## Tests

```bash
npm run test:rust
npm test
npm run test:batch
```

`npm run test:rust` is verification-only with respect to tracked runtime
artifacts: it compiles the wasm target but does not copy build output into
`wasm/`. `npm run build:wasm` is the sole normal producer of the tracked
`pc_wasm.wasm` and `batch_wasm.wasm` files.

For a release candidate also run the underlying Rust hygiene checks used by the
project:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## Legal-board asset

Regenerate the 4-line legal-board/oracle asset with:

```bash
npm run generate:legal
```

The generator lives in `rust/legal-gen`, so the binary data file is reproducible
from source included in the project.

## HiGHS asset provenance

Current integration is pinned to highs-js 1.15.1 / HiGHS 1.15.1. Keep together:

```text
wasm/highs.wasm
src/vendor/highs.mjs
third_party/highs-js.LICENSE
third_party/HiGHS.LICENSE
third_party/HiGHS-THIRD_PARTY_NOTICES.md
third_party/HiGHS-third-party/
third_party/source/HiGHS-1.15.1.zip
```

See `../HIGHS_INTEGRATION_AND_LICENSE.md`.

## Release packaging rules

Do not include development state such as:

```text
.git/
node_modules/
rust/target/
benchmark scratch output
temporary extracted toolchains
```

A release ZIP should contain current documentation, source, tests, scripts,
licenses/notices, and runtime assets.

Before publishing:

1. run JS and Rust regression suites;
2. rebuild normal WASM;
3. compare expected runtime asset hashes if the release is documentation-only;
4. test ZIP integrity;
5. extract the ZIP into a clean directory and verify key files exist;
6. ensure `README.md`, user guides, `CHANGELOG.md`, and the current release note
   all name the same release;
7. preserve all files under `third_party/`.
