import {
  calculateChance,
  calculateFifthFeature,
  calculateFourthDistribution,
  calculateLegacyMinimalsFeature,
  calculateMinimalsFeature,
  calculatePathFeature,
  calculatePerSaveMinimalsFeature,
  calculateSaves,
  resolvePerSaveTargetLines,
  solveSingleQueueFeature,
  validateFourthInput,
} from "./features.mjs";
import { keyedRetryableLoader } from "./promise-utils.mjs";
import { loadWasmAssets, WasmPcSolver } from "./wasm-backend.mjs";

const solverByHeight = keyedRetryableLoader(async (height) => {
  const assets = await loadWasmAssets();
  return new WasmPcSolver(assets.exports, height, assets.legal);
});

export function getSolver(height) {
  if (!Number.isInteger(height) || height < 2 || height > 6) {
    return Promise.reject(new Error(`unsupported height ${height}`));
  }
  return solverByHeight(height);
}

function requestHeight(request) {
  if (request.kind === "per-save-minimals") return resolvePerSaveTargetLines(request.input);
  if (["solve-one", "solve-all", "per-save-all"].includes(request.kind)) {
    return request.input?.targetLines ?? request.input?.clear ?? 4;
  }
  return request.input?.clear ?? 4;
}

export async function runWorkerRequest(request) {
  if (request.kind === "fourth") validateFourthInput(request.input ?? {});
  const clear = requestHeight(request);
  const solver = await getSolver(clear);
  const input = { ...request.input, solver };
  switch (request.kind) {
    case "path": return calculatePathFeature(input);
    case "chance": return calculateChance(input);
    case "saves": return calculateSaves(input);
    case "minimals": return calculateMinimalsFeature(input);
    case "legacy-minimals": return calculateLegacyMinimalsFeature(input);
    case "fourth": return calculateFourthDistribution(input);
    case "fifth": return calculateFifthFeature(input);
    case "per-save-minimals": return calculatePerSaveMinimalsFeature(input);
    case "solve-one":
    case "solve-all":
    case "per-save-all": return solveSingleQueueFeature(request.kind, input);
    default: throw new Error(`unknown request ${request.kind}`);
  }
}
