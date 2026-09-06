# Third-Party Notices

This file documents third-party software, adapted code, and compatibility
references relevant to the current sfinder-wasm release.

## Project license

sfinder-wasm is distributed under **Apache-2.0**. See `LICENSE`.
Third-party components retain their own licenses. Nothing in the project Apache license
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

## ORTools and runtime dependencies added in 3.0

Project-owned code is Apache-2.0. Bundled components retain the licenses below.

| Component | License | Notice location under third_party/ |
|---|---|---|
| OR-Tools 9.15, or-tools-wasm 0.9.1 | Apache-2.0 | ORTools/OR-Tools.LICENSE, or-tools-wasm.LICENSE |
| Abseil | Apache-2.0 and preserved embedded notices | ORTools/Abseil.LICENSE |
| protobuf C++, RE2 | BSD-3-Clause | ORTools/protobuf.LICENSE, RE2.LICENSE |
| utf8_range | MIT | ORTools/utf8_range.LICENSE |
| zlib, bzip2 | Zlib, bzip2 license | ORTools/zlib.LICENSE, bzip2.LICENSE |
| Eigen 3.4.0 | MPL-2.0 with permissive portions | ORTools/Eigen/ |
| protobufjs 8.8.0 | BSD-3-Clause | ORTools/protobufjs.LICENSE |
| long 5.3.2 | Apache-2.0 | ORTools/long.LICENSE |
| @bufbuild/protobuf 2.14.0 | Apache-2.0 AND BSD-3-Clause | ORTools/protobuf-es-*.LICENSE |
| Emscripten 6.0.8 | MIT OR NCSA | ORTools/Emscripten.LICENSE |
| musl and compiler/C/C++ runtimes | MIT/BSD and Apache-2.0 WITH LLVM-exception | ORTools/musl.COPYRIGHT, *lib*, compiler-rt.LICENSE |
| Rust std/core/alloc and embedded components | Original Rust and third-party licenses | Rust/ |

The CP-SAT bridge target defines EIGEN_MPL2_ONLY. The 166 Eigen headers recorded
in build dependencies contain no GPL/LGPL notices. These exact source files are
supplied under source/Eigen-3.4.0/ under their original licenses. This source set
conservatively includes build dependencies beyond final LTO-linked CP-SAT code.
The compiler-definition statement does not apply to every static-library
translation unit. See ORTools/Eigen/SOURCE.md.

Distinct original license/copyright headers from recorded build dependencies
are preserved in ORTools/UPSTREAM_HEADER_NOTICES.txt.
Toolchain notices are retained conservatively even where LTO may remove code.
Vite/Playwright are development-only tools and are not runtime dependencies.

Sources:
- https://github.com/google/or-tools
- https://github.com/Axelwickm/or-tools-wasm
- https://www.mozilla.org/en-US/MPL/2.0/FAQ/

When redistributing the complete 3.0 package, preserve NOTICE, the ORTools/Rust
notices, and the supplied Eigen source in addition to the existing notices below.

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
