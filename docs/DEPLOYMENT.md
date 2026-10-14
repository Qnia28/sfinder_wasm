# Installation and deployment

## Install

Run `npm ci` in the sfinder-wasm directory to install the pinned JavaScript
dependency, `tetris-fumen`. The solver binaries and legal-board data are bundled.
Java, Python and a Rust toolchain are not required.

## Browser applications

Use the Worker clients shown in [the README](../README.md#quick-start-worker-api)
to keep solver work off the UI thread. Serve the application through HTTP(S),
rather than opening files with `file://`.

Preserve the relative layout of `src/` and `wasm/`, including Worker modules,
`src/vendor/`, and all WASM/data files. Configure your application's bundler to
include assets referenced by module-relative URLs. Serve `.wasm` files as
`application/wasm`.

For ORTools, use a browser supporting WebAssembly JSPI and SharedArrayBuffer.
Serve HTTPS or localhost with these response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Assets must be same-origin or satisfy that embedder policy. When these
capabilities are unavailable, `Primary=Auto` can use HiGHS for wide kernels;
explicit `Primary=ORTools` reports an unsupported-environment error.
See [ORTools setup](../ORTOOLS_INTEGRATION_AND_LICENSE.md).

## Node applications

Use ES modules and the direct runtime APIs in [the API reference](API_REFERENCE.md).
For Node 24.13 with ORTools, start your application with:

```sh
node --experimental-wasm-stack-switching your-script.mjs
```

Node does not require browser cross-origin isolation headers. Keep the Node
ORTools glue and binaries under `src/vendor/ortools/`.

## Cancellation and assets

Exact quality requests can run until a complete proof is found. Use the Worker
client's `AbortSignal` or `cancel()` to stop a request, and `dispose()` when the
client is no longer needed.

Deploy the runtime and its assets together. Preserve `LICENSE`, `NOTICE`,
`THIRD_PARTY_NOTICES.md`, and `third_party/` when redistributing; the supplied
third-party source accompanies the bundled components' licensing requirements.
