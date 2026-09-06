import { preferredSolution } from "./human-ranking.mjs";
import { requirePositiveQuality } from "./quality-contract.mjs";
import { DEFAULT_SOLUTION_WORD_STRIDE, U32_MAX, queueBits, solutionKey, wasmU32 } from "./pc-wasm-abi.mjs";

export const enumerationMethods = {
_withPackedQueues(queues, callback) {
    if (queues.length === 0) return callback(0, 0);
    const queuePointer = this.e.wasm_alloc_u64(queues.length);
    const lengthPointer = this.e.wasm_alloc(queues.length);
    try {
      const queueBuffer = new BigUint64Array(this.e.memory.buffer, queuePointer, queues.length);
      const lengthBuffer = new Uint8Array(this.e.memory.buffer, lengthPointer, queues.length);
      for (let index = 0; index < queues.length; index += 1) {
        queueBuffer[index] = queueBits(queues[index]);
        lengthBuffer[index] = queues[index].length;
      }
      return callback(queuePointer, lengthPointer);
    } finally {
      this.e.wasm_dealloc_u64(queuePointer, queues.length);
      this.e.wasm_dealloc(lengthPointer, queues.length);
    }
  },

_readSolutions(count) {
    if (count <= 0) return [];
    if (this.e.solver_copy_solution_words && this.e.wasm_alloc_u64 && this.e.wasm_dealloc_u64) {
      const stride = wasmU32(this.e.solver_solution_word_stride?.() ?? DEFAULT_SOLUTION_WORD_STRIDE);
      if (stride < 9) throw new Error(`invalid solution word stride ${stride}`);
      const words = count * stride;
      const pointer = this.e.wasm_alloc_u64(words);
      try {
        const copied = wasmU32(this.e.solver_copy_solution_words(this.ptr, pointer, words));
        if (copied !== words) throw new Error(`WASM solution bulk copy failed: ${copied}/${words}`);
        const buffer = new BigUint64Array(this.e.memory.buffer, pointer, words);
        const output = [];
        for (let index = 0; index < count; index += 1) {
          const base = index * stride;
          const masks = [
            buffer[base],
            buffer[base + 1],
            buffer[base + 2],
            buffer[base + 3],
            buffer[base + 4],
            buffer[base + 5],
            buffer[base + 6],
          ];
          const key = solutionKey(masks);
          output.push({
            masks,
            key,
            orderCount: requirePositiveQuality(Number(buffer[base + 7]), {
              key,
              label: "playableOrderCount",
            }),
            saved: Number(buffer[base + 8]),
          });
        }
        return output;
      } finally {
        this.e.wasm_dealloc_u64(pointer, words);
      }
    }

    const output = [];
    for (let index = 0; index < count; index += 1) {
      const masks = [];
      for (let piece = 0; piece < 7; piece += 1) {
        masks.push(this.e.solver_solution_mask(this.ptr, index, piece));
      }
      if (typeof this.e.solver_solution_order_count !== "function") {
        throw new Error("WASM solution export is missing solver_solution_order_count");
      }
      const key = solutionKey(masks);
      output.push({
        masks,
        key,
        orderCount: requirePositiveQuality(wasmU32(this.e.solver_solution_order_count(this.ptr, index)), {
          key,
          label: "playableOrderCount",
        }),
        saved: wasmU32(this.e.solver_solution_saved_piece?.(this.ptr, index) ?? 7),
      });
    }
    return output;
  },

_readSolutionGeometry(count) {
    if (count <= 0) return [];
    if (this.e.solver_copy_solution_words && this.e.wasm_alloc_u64 && this.e.wasm_dealloc_u64) {
      const stride = wasmU32(this.e.solver_solution_word_stride?.() ?? DEFAULT_SOLUTION_WORD_STRIDE);
      if (stride < 9) throw new Error(`invalid solution word stride ${stride}`);
      const words = count * stride;
      const pointer = this.e.wasm_alloc_u64(words);
      try {
        const copied = wasmU32(this.e.solver_copy_solution_words(this.ptr, pointer, words));
        if (copied !== words) throw new Error(`WASM solution bulk copy failed: ${copied}/${words}`);
        const buffer = new BigUint64Array(this.e.memory.buffer, pointer, words);
        const output = new Array(count);
        for (let index = 0; index < count; index += 1) {
          const base = index * stride;
          const masks = [
            buffer[base],
            buffer[base + 1],
            buffer[base + 2],
            buffer[base + 3],
            buffer[base + 4],
            buffer[base + 5],
            buffer[base + 6],
          ];
          output[index] = { masks, key: solutionKey(masks) };
        }
        return output;
      } finally {
        this.e.wasm_dealloc_u64(pointer, words);
      }
    }

    const output = new Array(count);
    for (let index = 0; index < count; index += 1) {
      const masks = [];
      for (let piece = 0; piece < 7; piece += 1) {
        masks.push(this.e.solver_solution_mask(this.ptr, index, piece));
      }
      output[index] = { masks, key: solutionKey(masks) };
    }
    return output;
  },

canPc(board, queue, useHold = true) {
    return Boolean(this.e.solver_can_pc(
      this.ptr,
      board,
      queueBits(queue),
      queue.length,
      useHold ? 1 : 0,
    ));
  },

probeCanPc(board, queue, useHold = true, nodeBudget = 1024) {
    if (!this.e.solver_probe_can_pc) return { completed: false, nodes: 0 };
    const before = Number(this.e.solver_nodes(this.ptr));
    const status = this.e.solver_probe_can_pc(this.ptr, board, queueBits(queue), queue.length,
      useHold ? 1 : 0, Math.max(0, Math.min(0xffffffff, Math.floor(nodeBudget))));
    return { completed: status < 2, value: status === 1, nodes: Number(this.e.solver_nodes(this.ptr)) - before };
  },

_canPcManyScalar(board, queues, useHold = true) {
    if (!this.e.solver_can_pc_many || !this.e.wasm_alloc_u64 || !this.e.wasm_dealloc_u64) {
      return queues.map((queue) => this.canPc(board, queue, useHold));
    }
    if (queues.length === 0) return [];
    return this._withPackedQueues(queues, (queuePointer, lengthPointer) => {
      const outputPointer = this.e.wasm_alloc(queues.length);
      try {
        if (!this.e.solver_can_pc_many(
          this.ptr,
          board,
          queuePointer,
          lengthPointer,
          queues.length,
          useHold ? 1 : 0,
          outputPointer,
        )) throw new Error("WASM canPcMany failed");
        return Array.from(
          new Uint8Array(this.e.memory.buffer, outputPointer, queues.length),
          (value) => value !== 0,
        );
      } finally {
        this.e.wasm_dealloc(outputPointer, queues.length);
      }
    });
  },

canPcManyScalar(board, queues, useHold = true) {
    return this._canPcManyScalar(board, queues, useHold);
  },

canPcPatternMany(board, queues, useHold = true) {
    if (!this.e.solver_can_pc_pattern_many) {
      return this._canPcManyScalar(board, queues, useHold);
    }
    if (queues.length === 0) return [];
    return this._withPackedQueues(queues, (queuePointer, lengthPointer) => {
      const outputPointer = this.e.wasm_alloc(queues.length);
      try {
        if (!this.e.solver_can_pc_pattern_many(
          this.ptr,
          board,
          queuePointer,
          lengthPointer,
          queues.length,
          useHold ? 1 : 0,
          outputPointer,
        )) throw new Error("WASM canPcPatternMany failed");
        return Array.from(
          new Uint8Array(this.e.memory.buffer, outputPointer, queues.length),
          (value) => value !== 0,
        );
      } finally {
        this.e.wasm_dealloc(outputPointer, queues.length);
      }
    });
  },

enumeratePc(board, queue, useHold = true) {
    const count = wasmU32(this.e.solver_enumerate_pc(
      this.ptr,
      board,
      queueBits(queue),
      queue.length,
      useHold ? 1 : 0,
    ));
    return this._readSolutions(count);
  },

bestPc(board, queue, useHold = true) {
    if (!this.e.solver_best_pc) return preferredSolution(this.enumeratePc(board, queue, useHold));
    const count = wasmU32(this.e.solver_best_pc(
      this.ptr,
      board,
      queueBits(queue),
      queue.length,
      useHold ? 1 : 0,
    ));
    return this._readSolutions(count)[0] ?? null;
  },

enumeratePcPatternCompact(board, queues, useHold = true) {
    if (!this.e.solver_pattern_offsets_ptr || !this.e.solver_copy_solution_words) return null;
    if (!queues.length) return null;
    return this._withPackedQueues(queues, (queuePointer, lengthPointer) => {
      const count = wasmU32(this.e.solver_enumerate_pc_pattern(this.ptr, board, queuePointer, lengthPointer, queues.length, useHold ? 1 : 0));
      if (count === U32_MAX) throw new Error('WASM compact pattern enumeration failed');
      const offsets = new Uint32Array(this.e.memory.buffer, this.e.solver_pattern_offsets_ptr(this.ptr), count + 1).slice();
      const entries = offsets[count];
      const caseIds = new Uint32Array(this.e.memory.buffer, this.e.solver_pattern_cases_ptr(this.ptr), entries).slice();
      const qualities = new Uint32Array(this.e.memory.buffer, this.e.solver_pattern_qualities_ptr(this.ptr), entries).slice();
      const stride = wasmU32(this.e.solver_solution_word_stride());
      const words = count * stride, pointer = this.e.wasm_alloc_u64(words);
      try {
        if (wasmU32(this.e.solver_copy_solution_words(this.ptr, pointer, words)) !== words) throw new Error('compact solution copy failed');
        // Native WASM memory is little-endian. Keep geometry as two u32 words
        // per mask until a selected solution actually needs Fumen materialization.
        const geometry = new Uint32Array(this.e.memory.buffer, pointer, words * 2).slice();
        return { count, stride: stride * 2, geometry, offsets, caseIds, qualities };
      } finally { this.e.wasm_dealloc_u64(pointer, words); }
    });
  },

enumeratePcPattern(board, queues, useHold = true) {
    if (!this.e.solver_enumerate_pc_pattern || !this.e.solver_pattern_coverage_offset) {
      return null;
    }
    if (queues.length === 0) return [];
    return this._withPackedQueues(queues, (queuePointer, lengthPointer) => {
      const count = wasmU32(this.e.solver_enumerate_pc_pattern(
        this.ptr,
        board,
        queuePointer,
        lengthPointer,
        queues.length,
        useHold ? 1 : 0,
      ));
      if (count === U32_MAX) throw new Error("WASM pattern enumeration failed");
      const solutions = this._readSolutions(count);
      return solutions.map((solution, index) => {
        const start = wasmU32(this.e.solver_pattern_coverage_offset(this.ptr, index));
        const end = wasmU32(this.e.solver_pattern_coverage_offset(this.ptr, index + 1));
        if (start === U32_MAX || end === U32_MAX || end < start) {
          throw new Error("invalid WASM pattern coverage offsets");
        }
        const coverage = [];
        for (let coverageIndex = start; coverageIndex < end; coverageIndex += 1) {
          const caseIndex = wasmU32(this.e.solver_pattern_coverage_case(this.ptr, coverageIndex));
          coverage.push({
            caseIndex,
            orderCount: requirePositiveQuality(
              wasmU32(this.e.solver_pattern_coverage_order_count(this.ptr, coverageIndex)),
              { key: solution.key, caseId: caseIndex, label: "playableOrderCount" },
            ),
          });
        }
        return { ...solution, coverage };
      });
    });
  },

enumeratePcPath(board, queues, useHold = true) {
    if (!this.e.solver_enumerate_pc_pattern || !this.e.solver_pattern_coverage_offset) {
      return null;
    }
    if (queues.length === 0) {
      return { solutions: [], coverageCounts: new Uint32Array(0) };
    }
    return this._withPackedQueues(queues, (queuePointer, lengthPointer) => {
      const count = wasmU32(this.e.solver_enumerate_pc_pattern(
        this.ptr,
        board,
        queuePointer,
        lengthPointer,
        queues.length,
        useHold ? 1 : 0,
      ));
      if (count === U32_MAX) throw new Error("WASM pattern enumeration failed");
      const solutions = this._readSolutionGeometry(count);
      const coverageCounts = new Uint32Array(count);
      for (let index = 0; index < count; index += 1) {
        const start = wasmU32(this.e.solver_pattern_coverage_offset(this.ptr, index));
        const end = wasmU32(this.e.solver_pattern_coverage_offset(this.ptr, index + 1));
        if (start === U32_MAX || end === U32_MAX || end < start) {
          throw new Error("invalid WASM pattern coverage offsets");
        }
        coverageCounts[index] = end - start;
      }
      return { solutions, coverageCounts };
    });
  },

perSaveBest(board, queue, useHold = true, { candidateLimit = 16 } = {}) {
    if (!this.e.solver_per_save_best) return null;
    const limit = Math.max(1, Math.min(65535, Number(candidateLimit) || 16));
    const count = wasmU32(this.e.solver_per_save_best(
      this.ptr,
      board,
      queueBits(queue),
      queue.length,
      useHold ? 1 : 0,
      limit,
    ));
    return this._readSolutions(count).map((solution) => ({
      ...solution,
      saved: Number(solution.saved ?? 7),
    }));
  }
};
