// lib/runtime_loader_node.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// lib/runtime_loader_core.ts
var RUNTIME_ARTIFACTS = {
  cp_sat_runtime: {
    jspi: {
      webJs: "cp_sat_runtime.js",
      nodeJs: "cp_sat_runtime_node.js",
      wasm: "cp_sat_runtime.wasm"
    },
    asyncify: {
      webJs: "cp_sat_runtime_asyncify.js",
      nodeJs: "cp_sat_runtime_node_asyncify.js",
      wasm: "cp_sat_runtime_asyncify.wasm"
    }
  },
  routing_runtime: {
    jspi: {
      webJs: "routing_runtime.js",
      nodeJs: "routing_runtime_node.js",
      wasm: "routing_runtime.wasm"
    },
    asyncify: {
      webJs: "routing_runtime_asyncify.js",
      nodeJs: "routing_runtime_node_asyncify.js",
      wasm: "routing_runtime_asyncify.wasm"
    }
  },
  mp_solver_runtime: {
    jspi: {
      webJs: "mp_solver_runtime.js",
      nodeJs: "mp_solver_runtime_node.js",
      wasm: "mp_solver_runtime.wasm"
    },
    asyncify: {
      webJs: "mp_solver_runtime_asyncify.js",
      nodeJs: "mp_solver_runtime_node_asyncify.js",
      wasm: "mp_solver_runtime_asyncify.wasm"
    }
  },
  mathopt_runtime: {
    jspi: {
      webJs: "mathopt_runtime.js",
      nodeJs: "mathopt_runtime_node.js",
      wasm: "mathopt_runtime.wasm"
    },
    asyncify: {
      webJs: "mathopt_runtime_asyncify.js",
      nodeJs: "mathopt_runtime_node_asyncify.js",
      wasm: "mathopt_runtime_asyncify.wasm"
    }
  },
  pdlp_runtime: {
    jspi: {
      webJs: "pdlp_runtime.js",
      nodeJs: "pdlp_runtime_node.js",
      wasm: "pdlp_runtime.wasm"
    },
    asyncify: {
      webJs: "pdlp_runtime_asyncify.js",
      nodeJs: "pdlp_runtime_node_asyncify.js",
      wasm: "pdlp_runtime_asyncify.wasm"
    }
  },
  graph_runtime: {
    jspi: {
      webJs: "graph_runtime.js",
      nodeJs: "graph_runtime_node.js",
      wasm: "graph_runtime.wasm"
    },
    asyncify: {
      webJs: "graph_runtime_asyncify.js",
      nodeJs: "graph_runtime_node_asyncify.js",
      wasm: "graph_runtime_asyncify.wasm"
    }
  },
  set_cover_runtime: {
    jspi: {
      webJs: "set_cover_runtime.js",
      nodeJs: "set_cover_runtime_node.js",
      wasm: "set_cover_runtime.wasm"
    },
    asyncify: {
      webJs: "set_cover_runtime_asyncify.js",
      nodeJs: "set_cover_runtime_node_asyncify.js",
      wasm: "set_cover_runtime_asyncify.wasm"
    }
  }
};
function isJspiSupported() {
  const wasm = globalThis.WebAssembly;
  return typeof wasm?.promising === "function";
}
function preferredRuntimeFlavor() {
  return isJspiSupported() ? "jspi" : "asyncify";
}
function createRuntimeLoader(adapter) {
  const modulePromises = {};
  let selectedFlavor = null;
  function selectRuntimeFlavor() {
    if (selectedFlavor) {
      return selectedFlavor;
    }
    selectedFlavor = preferredRuntimeFlavor();
    if (adapter.logFlavorSelection) {
      console.log(
        selectedFlavor === "jspi" ? "JSPI is supported. Using JSPI runtime." : "Using Asyncify runtime."
      );
    }
    return selectedFlavor;
  }
  async function createRuntime(runtimeName, flavor = selectRuntimeFlavor()) {
    const key = `${runtimeName}:${flavor}`;
    modulePromises[key] ??= (async () => {
      const asset = await adapter.resolveAsset(runtimeName, flavor);
      const createModule = await adapter.loadFactory(asset.jsUrl);
      const moduleOverrides = {
        locateFile: asset.locateFile,
        noExitRuntime: true
      };
      if (asset.wasmBinary) {
        moduleOverrides.wasmBinary = asset.wasmBinary;
      }
      if (asset.mainScriptUrlOrBlob) {
        moduleOverrides.mainScriptUrlOrBlob = asset.mainScriptUrlOrBlob;
      }
      try {
        return await createModule(moduleOverrides);
      } finally {
        asset.cleanupGlobalState?.();
      }
    })();
    return modulePromises[key];
  }
  async function terminateLoadedRuntimeThreads2() {
    const modules = await Promise.allSettled(Object.values(modulePromises));
    for (const moduleResult of modules) {
      if (moduleResult.status !== "fulfilled") continue;
      const module = moduleResult.value;
      try {
        if (Object.prototype.hasOwnProperty.call(module, "PThread")) {
          module.PThread?.terminateAllThreads?.();
        }
      } catch (error) {
        if (!String(error).includes("PThread")) throw error;
      }
    }
  }
  return {
    terminateLoadedRuntimeThreads: terminateLoadedRuntimeThreads2,
    loadRuntime: () => createRuntime("cp_sat_runtime"),
    loadRuntimeAsyncify: () => createRuntime("cp_sat_runtime", "asyncify"),
    loadRoutingRuntime: () => createRuntime("routing_runtime"),
    loadRoutingRuntimeAsyncify: () => createRuntime("routing_runtime", "asyncify"),
    loadMPSolverRuntime: () => createRuntime("mp_solver_runtime"),
    loadMPSolverRuntimeAsyncify: () => createRuntime("mp_solver_runtime", "asyncify"),
    loadMathOptRuntime: () => createRuntime("mathopt_runtime"),
    loadMathOptRuntimeAsyncify: () => createRuntime("mathopt_runtime", "asyncify"),
    loadPdlpRuntime: () => createRuntime("pdlp_runtime"),
    loadPdlpRuntimeAsyncify: () => createRuntime("pdlp_runtime", "asyncify"),
    loadGraphRuntime: () => createRuntime("graph_runtime"),
    loadGraphRuntimeAsyncify: () => createRuntime("graph_runtime", "asyncify"),
    loadSetCoverRuntime: () => createRuntime("set_cover_runtime"),
    loadSetCoverRuntimeAsyncify: () => createRuntime("set_cover_runtime", "asyncify")
  };
}

// lib/runtime_loader_node.ts
async function loadFactory(runtimeUrl) {
  const { default: createModule } = await import(runtimeUrl);
  return createModule;
}
function locateNodeRuntimeFile(fileName) {
  return fileURLToPath(new URL(`../node-wasm/${fileName}`, import.meta.url));
}
function locateWebRuntimeFile(fileName) {
  return new URL(`../wasm/${fileName}`, import.meta.url).href;
}
var bunWebAssetRuntimes = /* @__PURE__ */ new Set([
  "cp_sat_runtime",
  "routing_runtime",
  "mp_solver_runtime",
  "mathopt_runtime"
]);
function shouldUseWebRuntimeAssets(runtimeName) {
  const hostState = globalThis;
  if (typeof hostState.Deno !== "undefined") return true;
  if (typeof hostState.Bun !== "undefined") return bunWebAssetRuntimes.has(runtimeName);
  return false;
}
function bunWebRuntimeGlobalCleanup() {
  const hostState = globalThis;
  if (typeof hostState.Bun === "undefined") return void 0;
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previousWindow = hostState.window;
  return () => {
    if (hadWindow) {
      hostState.window = previousWindow;
    } else if (hostState.window === globalThis) {
      delete hostState.window;
    }
  };
}
var loader = createRuntimeLoader({
  loadFactory,
  async resolveAsset(runtimeName, flavor) {
    const artifact = RUNTIME_ARTIFACTS[runtimeName][flavor];
    if (shouldUseWebRuntimeAssets(runtimeName)) {
      const wasmUrl = new URL(`../wasm/${artifact.wasm}`, import.meta.url);
      return {
        jsUrl: new URL(`../wasm/${artifact.webJs}`, import.meta.url).href,
        locateFile: locateWebRuntimeFile,
        wasmBinary: new Uint8Array(await readFile(wasmUrl)),
        cleanupGlobalState: bunWebRuntimeGlobalCleanup()
      };
    }
    return {
      jsUrl: new URL(`../node-wasm/${artifact.nodeJs}`, import.meta.url).href,
      locateFile: locateNodeRuntimeFile
    };
  }
});
var terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads;
var loadRuntime = loader.loadRuntime;
var loadRuntimeAsyncify = loader.loadRuntimeAsyncify;
var loadRoutingRuntime = loader.loadRoutingRuntime;
var loadRoutingRuntimeAsyncify = loader.loadRoutingRuntimeAsyncify;
var loadMPSolverRuntime = loader.loadMPSolverRuntime;
var loadMPSolverRuntimeAsyncify = loader.loadMPSolverRuntimeAsyncify;
var loadMathOptRuntime = loader.loadMathOptRuntime;
var loadMathOptRuntimeAsyncify = loader.loadMathOptRuntimeAsyncify;
var loadPdlpRuntime = loader.loadPdlpRuntime;
var loadPdlpRuntimeAsyncify = loader.loadPdlpRuntimeAsyncify;
var loadGraphRuntime = loader.loadGraphRuntime;
var loadGraphRuntimeAsyncify = loader.loadGraphRuntimeAsyncify;
var loadSetCoverRuntime = loader.loadSetCoverRuntime;
var loadSetCoverRuntimeAsyncify = loader.loadSetCoverRuntimeAsyncify;
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
