# HiGHS integration and redistribution notes

This document describes the **current** HiGHS integration in sfinder-wasm. It is
not a release-history document.

## Purpose

Global `minimals` always keeps minimum cardinality exact. After exact primary
kernelization, the production solver can prove the remaining cardinality with:

- the Rust/WASM exact cardinality solver; or
- HiGHS 1.15.1 MIP for hard residual kernels.

`useHiGHS` / `UseHiGHS` accepts `true`, `false`, or `"auto"`. Auto routing is
based on the exact residual kernel, not raw input size. HiGHS is lazy-loaded and
is not required for ordinary calls that resolve in Rust/kernelization.

`exactHumanQuality` is independent of the primary backend. It controls the
secondary fixed-K quality proof/refinement and does not make K approximate.

## Bundled files

```text
src/highs-min-cover.mjs       sfinder-wasm HiGHS adapter
src/vendor/highs.mjs          adapted highs-js 1.15.1 Emscripten wrapper
wasm/highs.wasm               HiGHS 1.15.1 WebAssembly binary
third_party/highs-js.LICENSE  highs-js MIT license
third_party/HiGHS.LICENSE     HiGHS MIT license
third_party/HiGHS-THIRD_PARTY_NOTICES.md
third_party/HiGHS-third-party/*
third_party/source/HiGHS-1.15.1.zip
```

The source archive is preserved for binary provenance and reproducibility. It is
not required by the MIT license as a source-offer mechanism; it is an explicit
project packaging choice.

## highs-js build provenance

The upstream highs-js 1.15.1 build script configures HiGHS as a static library
with:

```text
-DZLIB=OFF
-DFAST_BUILD=OFF
-DBUILD_SHARED_LIBS=OFF
```

HiGHS' HIPO option defaults to OFF. The upstream build then links the produced
static library with Emscripten and exports the C API used by highs-js.

`src/vendor/highs.mjs` is derived from the upstream highs-js runtime so it can be
loaded as an ES module in the browser/Vite-style asset environment. Its upstream
MIT notice is retained in `third_party/highs-js.LICENSE`.

## HiGHS third-party components

HiGHS 1.15.1 ships its own `THIRD_PARTY_NOTICES.md`. sfinder-wasm preserves that
file verbatim at:

```text
third_party/HiGHS-THIRD_PARTY_NOTICES.md
```

The individual upstream license texts are also exposed under:

```text
third_party/HiGHS-third-party/
```

For the library configuration used by highs-js 1.15.1, `pdqsort` and
`filereaderlp` are the most directly relevant embedded notices. HIPO components
(AMD/METIS/RCM) are disabled by default; zstr is disabled by `-DZLIB=OFF`; CLI11
belongs to the command-line executable path rather than the library interface.
The full notice set is nevertheless retained because the HiGHS source archive is
also redistributed.

## Runtime loading

`src/highs-min-cover.mjs` resolves `src/vendor/highs.mjs` and `wasm/highs.wasm`
only when the selected minimals path actually needs HiGHS. Browser deployments
must therefore ensure that `highs.wasm` is emitted as an addressable asset and
served as binary content. The wrapper has an ArrayBuffer fallback if streaming
WebAssembly instantiation is unavailable.

HiGHS memory is allowed to grow. Hard 4-line global-minimals cases can use
hundreds of MiB, so callers should treat HiGHS as a heavyweight, exceptional
backend rather than a routine dependency.

## Redistribution

When redistributing `highs.wasm` or `src/vendor/highs.mjs`, retain:

1. `third_party/highs-js.LICENSE`;
2. `third_party/HiGHS.LICENSE`;
3. `third_party/HiGHS-THIRD_PARTY_NOTICES.md`;
4. relevant files under `third_party/HiGHS-third-party/`;
5. the project `THIRD_PARTY_NOTICES.md`.

See `THIRD_PARTY_NOTICES.md` for the complete project-wide notice inventory.
