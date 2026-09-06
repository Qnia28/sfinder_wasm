import { decoder } from "tetris-fumen";
import { BatchReachability, loadBatchWasm } from "./batch-backend.mjs";
import { aggregateMasks } from "./batch-geometry.mjs";
import { decodedCoverTargets } from "./batch-targets.mjs";
import { loadWasmAssets, WasmPcSolver } from "./wasm-backend.mjs";

const MASK_ORDER = "IJLOSTZ";

export function boolMirror(value) {
  return value === true || String(value).toLowerCase() === "yes";
}

export function solutionFromOps(operations, comment = "") {
  const masksByPiece = aggregateMasks(operations);
  const masks = [...MASK_ORDER].map((piece) => masksByPiece[piece] ?? 0n);
  return {
    masks,
    key: masks.map((mask) => mask.toString(16)).join(":"),
    comment,
  };
}

export function decodedTargets(sourceFumen, height) {
  return decodedCoverTargets(decoder.decode(sourceFumen), height);
}

export async function batchReachability(height, physics) {
  const exports = await loadBatchWasm();
  return new BatchReachability(exports, height, physics);
}

export async function pcSolver(height) {
  const assets = await loadWasmAssets();
  return new WasmPcSolver(assets.exports, height, assets.legal);
}
