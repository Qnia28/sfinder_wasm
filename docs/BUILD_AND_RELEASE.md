# Building sfinder-wasm 3.2

This guide applies to the source repository. The user distribution ZIP includes
ready-to-use JavaScript, WASM and data assets; it excludes Rust source, build
scripts and this guide. For installation and runtime requirements, see
[Deployment](DEPLOYMENT.md).

## Requirements

- Node/npm for the pinned `tetris-fumen` dependency (`npm ci`).
- Rust 1.90.0 (the release build toolchain) and Cargo, with `rustup target add wasm32-unknown-unknown`.
- Bash and standard shell utilities; on Windows use a suitable Bash environment.

The Rust workspace contains `pc-core`, `pc-wasm`, `batch-wasm`, and `legal-gen`.
It has no external crate dependencies. Run the following commands from the
repository root.

## Compile the PC and batch engines

```sh
bash scripts/build-wasm.sh
```

This compiles the release profile for `wasm32-unknown-unknown` and updates:

```text
wasm/pc_wasm.wasm
wasm/batch_wasm.wasm
```

The default threshold configuration is `B`, enabling current propagation and
root-forced handling. Leave `SFINDER_THRESHOLD_MODE` unset for the product
configuration. The script also accepts `A` and `reference` as alternative source
configurations; these are not the default 3.2 binaries.

## Generate the legal-board data

```sh
bash scripts/generate-legal.sh
```

This runs `rust/legal-gen`, writes intermediate data under `rust/generated/`,
and updates `wasm/legal_boards_4.lgb`.

## Third-party solver assets

These scripts rebuild the project's Rust engines, not HiGHS or ORTools.
Keep the bundled `wasm/highs.wasm`, `src/vendor/highs.mjs`, and
`src/vendor/ortools/` assets together. Their versions, runtime requirements and
notices are described in [HiGHS integration](../HIGHS_INTEGRATION_AND_LICENSE.md),
[ORTools integration](../ORTOOLS_INTEGRATION_AND_LICENSE.md), and
[third-party notices](../THIRD_PARTY_NOTICES.md).

## Distribution ZIP

The committed `.gitattributes` excludes `rust/`, `scripts/`, this guide, and
`.gitattributes` itself from `git archive`. The source branch retains them.
After review, create a ZIP from the approved commit:

```sh
git archive --format=zip --prefix=sfinder-wasm-3.2/ --output=sfinder-wasm-3.2.zip APPROVED_COMMIT
```

Replace `APPROVED_COMMIT` with the reviewed commit ID. Keep the archive outside
the tracked source tree. Archive generation does not rebuild binaries: use the
approved bundled runtime, preserving all license notices and supplied Eigen
source. Check the archive's file inventory and runtime hashes before publishing.
