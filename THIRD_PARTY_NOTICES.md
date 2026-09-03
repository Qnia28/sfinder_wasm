# Third-Party Notices

This file documents third-party software, adapted code, and compatibility
references relevant to the current sfinder-wasm release.

## Project license

sfinder-wasm is distributed under **GPL-3.0-only**. See `LICENSE`.
Third-party components retain their own licenses. Nothing in the project GPL
replaces or removes those notices.

## Distributed or adapted components

### knewjade/solution-finder

- Role: behavioral and format compatibility reference for SFinder-style PC analysis.
- License: MIT.
- Notice: `third_party/solution-finder.LICENSE`.
- Upstream: https://github.com/knewjade/solution-finder

No Java `solution-finder` runtime is required by sfinder-wasm.

### knewjade/tetris-fumen 1.1.3

- Role: JavaScript Fumen encode/decode dependency.
- License: MIT.
- Notice: `third_party/tetris-fumen.LICENSE`.
- Upstream: https://github.com/knewjade/tetris-fumen

The npm dependency is pinned to `1.1.3` in `package.json`/`package-lock.json`.

### highs-js 1.15.1

- Role: Emscripten JavaScript runtime wrapper around HiGHS.
- License: MIT.
- Notice: `third_party/highs-js.LICENSE`.
- Adapted file: `src/vendor/highs.mjs`.
- Upstream: https://github.com/lovasoa/highs-js

`src/vendor/highs.mjs` is an ESM/browser adaptation of the upstream highs-js
runtime. It is not original sfinder-wasm code and remains covered by its MIT
license.

### HiGHS 1.15.1

- Role: exact MIP backend used lazily by hard global `minimals` primary-cardinality proofs.
- License: MIT for the main HiGHS codebase.
- Main notice: `third_party/HiGHS.LICENSE`.
- Upstream third-party notice: `third_party/HiGHS-THIRD_PARTY_NOTICES.md`.
- Preserved source archive: `third_party/source/HiGHS-1.15.1.zip`.
- Bundled binary: `wasm/highs.wasm`.
- Upstream: https://github.com/ERGO-Code/HiGHS

HiGHS itself contains or ships third-party source under additional licenses.
For redistribution convenience, the corresponding upstream notices are exposed
outside the source ZIP under `third_party/HiGHS-third-party/`:

| Component | License / notice file | Current highs-js library build relevance |
|---|---|---|
| pdqsort | `pdqsort-zlib.txt` | Used by HiGHS library code; retain notice |
| filereaderlp | `filereaderlp-MIT.txt` | Used by HiGHS model-reading library code; retain notice |
| AMD | `amd-BSD-3.txt` | HIPO component; default `HIPO=OFF` |
| METIS | `metis-Apache-2.0.txt` | HIPO component; default `HIPO=OFF` |
| RCM | `rcm-MIT.txt` | HIPO component; default `HIPO=OFF` |
| zstr | `zstr-MIT.txt` | highs-js 1.15.1 build uses `-DZLIB=OFF` |
| CLI11 | `cli11-license-header.txt` | HiGHS command-line executable only; not required by the library interface |

The complete upstream HiGHS notice is authoritative for the HiGHS source tree.
The extracted files are provided to make binary/source redistribution easier,
not to narrow the upstream notice.

## Compatibility references and acknowledgements

### eight04/sfinder-strict-minimal 0.2.0

- Historical role: exact-minimal behavior/reference during early development.
- License: MIT.
- Notice retained at `third_party/sfinder-strict-minimal.LICENSE`.
- Upstream: https://github.com/eight04/sfinder-strict-minimal

The current production minimum-cover implementation is independently structured
in `rust/pc-core/src/min_cover.rs`; `src/min-cover.mjs` is the current JavaScript
fallback/reference implementation. The MIT notice is retained for provenance
and for any historical/adapted portions that may remain relevant.

### Marfung37/PC-Saves-Get

- Historical role: behavioral compatibility reference for save-expression results.
- No upstream software license was identified in the supplied historical source.
- No PC-Saves-Get source code is distributed in sfinder-wasm.

The current save-expression implementation uses its own tokenizer, syntax tree,
and evaluator. Historical Python code was used only as a black-box compatibility
oracle during validation.

### cringemoment/sfinder-man and supplied legacy wrappers

- Historical role: behavior/interface reference during migration from Java+Python tooling.
- No legacy wrapper source is distributed as part of sfinder-wasm runtime code.
- No license grant is inferred from availability of the historical archive.

### wirelyre/tetra-tools

- Role: algorithmic/architecture reference during development of selected search optimizations.
- No tetra-tools crate or source code is included or linked.
- Upstream tetra-tools is GPL-3.0-or-later; this acknowledgement does not claim that
  its source is part of sfinder-wasm.

## Redistribution checklist

When redistributing the complete sfinder-wasm package, keep at minimum:

- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- all license files under `third_party/`
- `third_party/HiGHS-THIRD_PARTY_NOTICES.md`
- the files under `third_party/HiGHS-third-party/`
- the notices accompanying any copied/adapted `src/vendor/highs.mjs`

If only selected binaries or source files are redistributed, preserve the notices
that apply to those components. In particular, distributing `highs.wasm` should
be accompanied by the HiGHS/highs-js notices and the relevant HiGHS third-party
notices.
