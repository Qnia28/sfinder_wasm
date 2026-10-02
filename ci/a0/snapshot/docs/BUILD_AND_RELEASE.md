# Installation, build, and deployment guide

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

## Deployment

Deploy the complete `src/` and `wasm/` directories with the pinned
`tetris-fumen` dependency. Keep the ORTools browser and Node glue and their
WASM assets together under `src/vendor/ortools/`.

For browser headers, capability fallback and bundling requirements, see
`../ORTOOLS_INTEGRATION_AND_LICENSE.md`. The bundled WASM files are ready to use;
Rust is needed only when rebuilding them or regenerating the legal-board asset.

Preserve `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, the component notices
under `third_party/`, and the supplied Eigen source when redistributing the
complete package.
