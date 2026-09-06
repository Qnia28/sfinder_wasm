// Modified for sfinder-wasm 3.0: CP-SAT JSPI assets only. Apache-2.0.
import {
  createRuntimeLoader,
  isJspiSupported
} from "./runtime_loader_core.js";
const runtimeAssets = {
  cp_sat_runtime: {jspi: {
    jsUrl: new URL("../wasm/cp_sat_runtime.js", import.meta.url).href,
    wasmUrl: new URL("../wasm/cp_sat_runtime.wasm", import.meta.url).href
  }}
};
async function loadFactory(runtimeUrl) {
  const { default: createModule } = await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    runtimeUrl
  );
  return createModule;
}
function runtimeAssetName(url) {
  return (new URL(url).pathname.split("/").pop() ?? "").replace(/-[A-Za-z0-9_-]+(?=\.(?:js|wasm)$)/, "");
}
function locateRuntimeFile(fileName) {
  for (const flavors of Object.values(runtimeAssets))
    for (const asset of Object.values(flavors)) {
      if (fileName === runtimeAssetName(asset.jsUrl)) return asset.jsUrl;
      if (fileName === runtimeAssetName(asset.wasmUrl)) return asset.wasmUrl;
    }
  return fileName;
}
const loader = createRuntimeLoader({
  logFlavorSelection: !0,
  loadFactory,
  async resolveAsset(runtimeName, flavor) {
    const asset = runtimeAssets[runtimeName][flavor], wasmBinary = new Uint8Array(await (await fetch(asset.wasmUrl)).arrayBuffer());
    return {
      jsUrl: asset.jsUrl,
      locateFile: locateRuntimeFile,
      wasmBinary,
      mainScriptUrlOrBlob: asset.jsUrl
    };
  }
}), terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads, loadRuntime = loader.loadRuntime, loadRuntimeAsyncify = loader.loadRuntimeAsyncify, loadRoutingRuntime = loader.loadRoutingRuntime, loadRoutingRuntimeAsyncify = loader.loadRoutingRuntimeAsyncify, loadMPSolverRuntime = loader.loadMPSolverRuntime, loadMPSolverRuntimeAsyncify = loader.loadMPSolverRuntimeAsyncify, loadMathOptRuntime = loader.loadMathOptRuntime, loadMathOptRuntimeAsyncify = loader.loadMathOptRuntimeAsyncify, loadPdlpRuntime = loader.loadPdlpRuntime, loadPdlpRuntimeAsyncify = loader.loadPdlpRuntimeAsyncify, loadGraphRuntime = loader.loadGraphRuntime, loadGraphRuntimeAsyncify = loader.loadGraphRuntimeAsyncify, loadSetCoverRuntime = loader.loadSetCoverRuntime, loadSetCoverRuntimeAsyncify = loader.loadSetCoverRuntimeAsyncify;
export {
  isJspiSupported,
  loadGraphRuntime,
  loadGraphRuntimeAsyncify,
  loadMPSolverRuntime,
  loadMPSolverRuntimeAsyncify,
  loadMathOptRuntime,
  loadMathOptRuntimeAsyncify,
  loadPdlpRuntime,
  loadPdlpRuntimeAsyncify,
  loadRoutingRuntime,
  loadRoutingRuntimeAsyncify,
  loadRuntime,
  loadRuntimeAsyncify,
  loadSetCoverRuntime,
  loadSetCoverRuntimeAsyncify,
  terminateLoadedRuntimeThreads
};
