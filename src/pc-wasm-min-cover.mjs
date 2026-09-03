import {
  coverageUniverse,
  packCoverageRows,
  packNumericIdRows,
  packNumericQualityRows,
  withWasmU32Buffers,
} from "./pc-wasm-cover-matrix.mjs";
import { assertQualityProvider } from "./quality-contract.mjs";
import { U32_MAX, wasmU32 } from "./pc-wasm-abi.mjs";

function searchedStates(solver) {
  return Number(solver.e.solver_min_cover_searched_states?.(solver.ptr) ?? 0n);
}

function readQualityVector(solver) {
  const count = wasmU32(solver.e.solver_min_cover_quality_len(solver.ptr));
  const qualityVector = [];
  for (let index = 0; index < count; index += 1) {
    qualityVector.push(wasmU32(solver.e.solver_min_cover_quality(solver.ptr, index)));
  }
  return qualityVector;
}

function readSelectedKeys(solver, count, keys, errorMessage) {
  const selected = [];
  for (let index = 0; index < count; index += 1) {
    const id = wasmU32(solver.e.solver_min_cover_selected(solver.ptr, index));
    if (id >= keys.length) throw new Error(errorMessage);
    selected.push(keys[id]);
  }
  return selected;
}

export const minCoverMethods = {
  primaryKernelize(rawCases, solutionCount) {
    if (!this.e.solver_primary_kernelize || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;
    const matrix = packNumericIdRows(rawCases);
    return withWasmU32Buffers(this, { offsets: matrix.offsets, ids: matrix.ids }, ({ offsets, ids }) => {
      const status = wasmU32(this.e.solver_primary_kernelize(
        this.ptr, offsets, matrix.caseCount, ids, matrix.entryCount, Number(solutionCount),
      ));
      if (status === U32_MAX) throw new Error("Rust primary kernelization failed");
      const caseCount = wasmU32(this.e.solver_primary_kernel_case_count(this.ptr));
      const kernelEntryCount = wasmU32(this.e.solver_primary_kernel_entry_count(this.ptr));
      const kernelSolutionCount = wasmU32(this.e.solver_primary_kernel_solution_count(this.ptr));
      const forcedCount = wasmU32(this.e.solver_primary_kernel_forced_count(this.ptr));
      const memory = this.e.memory.buffer;
      const offsetsPtr = Number(this.e.solver_primary_kernel_offsets_ptr(this.ptr));
      const idsPtr = Number(this.e.solver_primary_kernel_ids_ptr(this.ptr));
      const solutionIdsPtr = Number(this.e.solver_primary_kernel_solution_ids_ptr(this.ptr));
      const forcedPtr = Number(this.e.solver_primary_kernel_forced_ptr(this.ptr));
      const kernelOffsets = caseCount
        ? new Uint32Array(memory, offsetsPtr, caseCount + 1).slice()
        : new Uint32Array([0]);
      const kernelIds = kernelEntryCount
        ? new Uint32Array(memory, idsPtr, kernelEntryCount).slice()
        : new Uint32Array(0);
      const solutionIds = kernelSolutionCount
        ? [...new Uint32Array(memory, solutionIdsPtr, kernelSolutionCount)]
        : [];
      const forced = forcedCount
        ? [...new Uint32Array(memory, forcedPtr, forcedCount)]
        : [];
      const cases = new Array(caseCount);
      for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
        cases[caseIndex] = [...kernelIds.subarray(kernelOffsets[caseIndex], kernelOffsets[caseIndex + 1])];
      }
      return { cases, solutionIds, forced, entryCount: kernelEntryCount, backend: "rust-kernel" };
    });
  },

  minimumCoverCardinalityIds(rawCases, solutionCount) {
    if (!this.e.solver_min_cover_cardinality || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;
    if (!rawCases.length) return { count: 0, selectedIds: [], searchedStates: 0 };
    const matrix = packNumericIdRows(rawCases);
    return withWasmU32Buffers(this, { offsets: matrix.offsets, ids: matrix.ids }, ({ offsets, ids }) => {
      const count = wasmU32(this.e.solver_min_cover_cardinality(
        this.ptr, offsets, matrix.caseCount, ids, matrix.entryCount, Number(solutionCount),
      ));
      if (count === U32_MAX) return { count: Infinity, selectedIds: [], searchedStates: searchedStates(this) };
      const selectedIds = [];
      for (let index = 0; index < count; index += 1) {
        const id = wasmU32(this.e.solver_min_cover_selected(this.ptr, index));
        if (id >= solutionCount) throw new Error("invalid WASM numeric cardinality-only result");
        selectedIds.push(id);
      }
      return { count, selectedIds, searchedStates: searchedStates(this) };
    });
  },

  minimumCoverCardinality(coverage) {
    if (!this.e.solver_min_cover_cardinality || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;
    const { rawCases, keys, keyIndex } = coverageUniverse(coverage);
    if (!rawCases.length) return { count: 0, keys: [], qualityVector: [], searchedStates: 0 };
    const matrix = packCoverageRows(rawCases, keyIndex);
    return withWasmU32Buffers(this, { offsets: matrix.offsets, ids: matrix.ids }, ({ offsets, ids }) => {
      const count = wasmU32(this.e.solver_min_cover_cardinality(
        this.ptr, offsets, matrix.caseCount, ids, matrix.entryCount, keys.length,
      ));
      if (count === U32_MAX) return { count: Infinity, keys: [], qualityVector: [], searchedStates: searchedStates(this) };
      return {
        count,
        keys: readSelectedKeys(this, count, keys, "invalid WASM cardinality-only minimum-cover result"),
        qualityVector: [],
        searchedStates: searchedStates(this),
      };
    });
  },

  minimumCoverIds(rawCases, solutionCount) {
    if (!this.e.solver_min_cover || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;
    const matrix = packNumericQualityRows(rawCases, solutionCount);
    if (!matrix.caseCount) return { count: 0, selectedIds: [], qualityVector: [], searchedStates: 0 };
    return withWasmU32Buffers(
      this,
      { offsets: matrix.offsets, ids: matrix.ids, qualities: matrix.qualities },
      ({ offsets, ids, qualities }) => {
        const count = wasmU32(this.e.solver_min_cover(
          this.ptr, offsets, matrix.caseCount, ids, qualities, matrix.entryCount, solutionCount,
        ));
        if (count === U32_MAX) {
          return { count: Infinity, selectedIds: [], qualityVector: [], searchedStates: searchedStates(this) };
        }
        const selectedIds = [];
        for (let index = 0; index < count; index += 1) {
          const id = wasmU32(this.e.solver_min_cover_selected(this.ptr, index));
          if (id >= solutionCount) throw new Error("invalid WASM numeric minimum-cover result");
          selectedIds.push(id);
        }
        return {
          count,
          selectedIds,
          qualityVector: readQualityVector(this),
          searchedStates: searchedStates(this),
        };
      },
    );
  },

  minimumCover(coverage, { qualityFor = null } = {}) {
    assertQualityProvider(qualityFor);
    if (qualityFor === null) return this.minimumCoverCardinality(coverage);
    if (!this.e.solver_min_cover || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;
    const { rawCases, keys, keyIndex } = coverageUniverse(coverage);
    if (!rawCases.length) return { count: 0, keys: [], qualityVector: [], searchedStates: 0 };
    const matrix = packCoverageRows(rawCases, keyIndex, qualityFor);
    return withWasmU32Buffers(
      this,
      { offsets: matrix.offsets, ids: matrix.ids, qualities: matrix.qualities },
      ({ offsets, ids, qualities }) => {
        const count = wasmU32(this.e.solver_min_cover(
          this.ptr, offsets, matrix.caseCount, ids, qualities, matrix.entryCount, keys.length,
        ));
        if (count === U32_MAX) {
          return { count: Infinity, keys: [], qualityVector: [], searchedStates: searchedStates(this) };
        }
        return {
          count,
          keys: readSelectedKeys(this, count, keys, "invalid WASM minimum-cover result"),
          qualityVector: readQualityVector(this),
          searchedStates: searchedStates(this),
        };
      },
    );
  },

  minimumCoverAtCount(coverage, exactCount, {
    qualityFor = null,
    seedKeys = [],
    lockedPrefix = [],
    stateBudget = null,
    integrated = false,
    dominance = false,
  } = {}) {
    assertQualityProvider(qualityFor);
    if (qualityFor === null) throw new Error("minimumCoverAtCount requires a positive human-quality provider");
    const bounded = stateBudget != null;
    if (integrated && lockedPrefix.length) throw new Error("integrated fixed-K search does not accept lockedPrefix");
    if (bounded && lockedPrefix.length) throw new Error("bounded fixed-K probe does not accept lockedPrefix");
    if (dominance && !integrated) throw new Error("candidate dominance preview requires integrated fixed-K search");
    const exactExport = this.e.solver_min_cover_at_count_locked;
    const boundedExport = integrated
      ? (dominance
        ? this.e.solver_min_cover_at_count_integrated_dominance_bounded
        : this.e.solver_min_cover_at_count_integrated_bounded)
      : this.e.solver_min_cover_at_count_bounded;
    if ((integrated || bounded ? !boundedExport : !exactExport) || !this.e.wasm_alloc_u32 || !this.e.wasm_dealloc_u32) return null;

    const { rawCases, keys, keyIndex } = coverageUniverse(coverage);
    if (!rawCases.length) {
      const completed = Number(exactCount) === 0;
      return completed
        ? { count: 0, keys: [], qualityVector: [], searchedStates: 0, completed: true }
        : { count: Infinity, keys: [], qualityVector: [], searchedStates: 0, completed: false, error: true };
    }
    const seedIds = Uint32Array.from(seedKeys.map((key) => {
      const id = keyIndex.get(key);
      if (id === undefined) throw new Error(`fixed-count seed key is not a candidate: ${key}`);
      return id;
    }));
    const locked = Uint32Array.from(
      lockedPrefix.map((value) => Math.max(0, Math.floor(Number(value) || 0))),
    );
    const matrix = packCoverageRows(rawCases, keyIndex, qualityFor);

    return withWasmU32Buffers(
      this,
      {
        offsets: matrix.offsets,
        ids: matrix.ids,
        qualities: matrix.qualities,
        seedIds,
        locked,
      },
      ({ offsets, ids, qualities, seedIds: seedPointer, locked: lockedPointer }) => {
        let status;
        if (integrated || bounded) {
          const budget = bounded
            ? Math.max(1, Math.min(0xfffffffd, Math.floor(Number(stateBudget) || 0)))
            : 0;
          status = wasmU32(boundedExport(
            this.ptr,
            offsets,
            matrix.caseCount,
            ids,
            qualities,
            matrix.entryCount,
            keys.length,
            Number(exactCount),
            seedPointer,
            seedIds.length,
            budget,
          ));
        } else {
          status = wasmU32(exactExport(
            this.ptr,
            offsets,
            matrix.caseCount,
            ids,
            qualities,
            matrix.entryCount,
            keys.length,
            Number(exactCount),
            seedPointer,
            seedIds.length,
            lockedPointer,
            locked.length,
          ));
        }
        const statusU32 = status >>> 0;
        if (statusU32 === U32_MAX) {
          return {
            count: Infinity,
            keys: [],
            qualityVector: [],
            searchedStates: searchedStates(this),
            completed: false,
            error: true,
          };
        }
        const completed = statusU32 !== 0xfffffffe;
        const selectedCount = completed ? statusU32 : Number(exactCount);
        return {
          count: completed ? statusU32 : Number(exactCount),
          keys: readSelectedKeys(this, selectedCount, keys, "invalid WASM fixed-count minimum-cover result"),
          qualityVector: readQualityVector(this),
          searchedStates: searchedStates(this),
          completed,
        };
      },
    );
  },
};
