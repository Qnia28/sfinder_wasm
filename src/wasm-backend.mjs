import { tailLegalPack } from "./pc-tail-legal.mjs";
import { retryableLoader } from "./promise-utils.mjs";
import { wasmU32 } from "./pc-wasm-abi.mjs";
import { enumerationMethods } from "./pc-wasm-enumeration.mjs";
import { minCoverMethods } from "./pc-wasm-min-cover.mjs";
import { compatibilityMethods } from "./pc-wasm-compat.mjs";

async function bytesFor(url) {
  if (typeof process !== "undefined" && process.versions?.node) {
    const moduleName = "node:fs/promises";
    const { readFile } = await import(/* @vite-ignore */ moduleName);
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const loadWasmAssets = retryableLoader(async () => {
  const wasm = await bytesFor(new URL("../wasm/pc_wasm.wasm", import.meta.url));
  const legal = await bytesFor(new URL("../wasm/legal_boards_4.lgb", import.meta.url));
  const { instance } = await WebAssembly.instantiate(wasm, {});
  return { exports: instance.exports, legal };
});

export class WasmPcSolver {
  constructor(exports, height, legalBytes = null) {
    this.e = exports;
    this.ptr = exports.solver_new(height);
    this.height = height;
    if (!this.ptr) throw new Error(`unsupported height ${height}`);
    if (height >= 4 && legalBytes) {
      try {
        this.loadLegal(height > 4 ? tailLegalPack(legalBytes) : legalBytes);
      } catch (error) {
        this.close();
        throw error;
      }
    }
  }

  loadLegal(bytes) {
    const pointer = this.e.wasm_alloc(bytes.length);
    new Uint8Array(this.e.memory.buffer, pointer, bytes.length).set(bytes);
    try {
      if (!this.e.solver_load_legal_pack(this.ptr, pointer, bytes.length)) {
        throw new Error("invalid legal-board pack");
      }
    } finally {
      this.e.wasm_dealloc(pointer, bytes.length);
    }
  }

  legalCount(stage) { return wasmU32(this.e.solver_legal_count(this.ptr, stage)); }
  legalPackVersion() { return wasmU32(this.e.solver_legal_pack_version?.(this.ptr) ?? 0); }
  legalMemoryBytes() { return wasmU32(this.e.solver_legal_memory_bytes?.(this.ptr) ?? 0); }
  stage8OracleEntries() { return wasmU32(this.e.solver_stage8_oracle_entries?.(this.ptr) ?? 0); }
  stage9OracleEntries() { return wasmU32(this.e.solver_stage9_oracle_entries?.(this.ptr) ?? 0); }

  stats() {
    return {
      nodes: Number(this.e.solver_nodes(this.ptr)),
      reconstructionVisits: Number(this.e.solver_reconstruction_stat?.(this.ptr, 0) ?? 0),
      reconstructionSkipped: Number(this.e.solver_reconstruction_stat?.(this.ptr, 1) ?? 0),
      cacheHits: Number(this.e.solver_cache_hits(this.ptr)),
      cacheMisses: Number(this.e.solver_cache_misses(this.ptr)),
      legalRejects: Number(this.e.solver_legal_rejects(this.ptr)),
      cacheEntries: wasmU32(this.e.solver_cache_entries?.(this.ptr) ?? 0),
      cacheEstimatedBytes: wasmU32(this.e.solver_cache_estimated_bytes?.(this.ptr) ?? 0),
      cacheEvictions: Number(this.e.solver_cache_evictions?.(this.ptr) ?? 0n),
    };
  }

  close() {
    if (this.ptr) {
      this.e.solver_free(this.ptr);
      this.ptr = 0;
    }
  }

  setProbabilityEngine(engine = 'auto', { maxLanguageNodes = 200000 } = {}) {
    const code = { auto: 0, compressed: 1, legacy: 2 }[engine];
    if (typeof code !== 'number' || !Number.isInteger(maxLanguageNodes) || maxLanguageNodes < 0 || maxLanguageNodes > 200000) throw new RangeError('invalid probability engine or language node budget');
    if (!this.e.solver_set_probability_engine?.(this.ptr, code, maxLanguageNodes)) throw new Error('WASM does not support probability engine selection');
  }
  probabilityStats() {
    const read = kind => Number(this.e.solver_probability_stat?.(this.ptr, kind) ?? 0);
    return { geometryPaths: read(0), languageNodes: read(1), budgetFallback: read(2) !== 0 };
  }
  setPlacementCacheBudget(bytes) {
    if (!Number.isInteger(bytes) || bytes < 1024 || bytes > 256 * 1024 * 1024) {
      throw new Error("placement cache budget must be an integer from 1024 to 268435456 bytes");
    }
    if (!this.e.solver_set_cache_budget) throw new Error("WASM does not support placement cache budgets");
    this.e.solver_set_cache_budget(this.ptr, bytes);
  }
}

Object.assign(WasmPcSolver.prototype, enumerationMethods, minCoverMethods, compatibilityMethods);

export async function createWasmSolver(height = 4, { legal = true } = {}) {
  const assets = await loadWasmAssets();
  return new WasmPcSolver(assets.exports, height, legal ? assets.legal : null);
}
