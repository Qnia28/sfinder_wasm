const RUNTIME_ARTIFACTS = {
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
  return typeof globalThis.WebAssembly?.promising == "function";
}
function preferredRuntimeFlavor() {
  return isJspiSupported() ? "jspi" : "asyncify";
}
function createRuntimeLoader(adapter) {
  const modulePromises = {};
  let selectedFlavor = null;
  function selectRuntimeFlavor() {
    return selectedFlavor || (selectedFlavor = preferredRuntimeFlavor(), adapter.logFlavorSelection && console.log(
      selectedFlavor === "jspi" ? "JSPI is supported. Using JSPI runtime." : "Using Asyncify runtime."
    ), selectedFlavor);
  }
  async function createRuntime(runtimeName, flavor = selectRuntimeFlavor()) {
    const key = `${runtimeName}:${flavor}`;
    return modulePromises[key] ?? (modulePromises[key] = (async () => {
      const asset = await adapter.resolveAsset(runtimeName, flavor), createModule = await adapter.loadFactory(asset.jsUrl), moduleOverrides = {
        locateFile: asset.locateFile,
        noExitRuntime: !0
      };
      asset.wasmBinary && (moduleOverrides.wasmBinary = asset.wasmBinary), asset.mainScriptUrlOrBlob && (moduleOverrides.mainScriptUrlOrBlob = asset.mainScriptUrlOrBlob);
      try {
        return await createModule(moduleOverrides);
      } finally {
        asset.cleanupGlobalState?.();
      }
    })()), modulePromises[key];
  }
  async function terminateLoadedRuntimeThreads() {
    const modules = await Promise.allSettled(Object.values(modulePromises));
    for (const moduleResult of modules) {
      if (moduleResult.status !== "fulfilled") continue;
      const module = moduleResult.value;
      try {
        Object.prototype.hasOwnProperty.call(module, "PThread") && module.PThread?.terminateAllThreads?.();
      } catch (error) {
        if (!String(error).includes("PThread")) throw error;
      }
    }
  }
  return {
    terminateLoadedRuntimeThreads,
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
export {
  RUNTIME_ARTIFACTS,
  createRuntimeLoader,
  isJspiSupported,
  preferredRuntimeFlavor
};
