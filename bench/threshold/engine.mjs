import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withWasmU32Buffers } from '../../src/pc-wasm-cover-matrix.mjs';

export const BASELINE_SHA = 'c0cb2a048e7275bfea587d176b1954efff0a8a08';
export const ELEMENTS = ['stagedBounds', 'removePresort', 'rootForced', 'priorPropagation', 'currentPropagation'];
export const COUNTERS = ['stages', 'dfsEntries', 'rootForcedSteps', 'propagatedSteps', 'propagationScans',
  'propagationConflicts', 'u0Prunes', 'u1Prunes', 'pairCalls', 'priorSatisfied', 'qualityGroupUpdates', 'lexChecks',
  'normalizedRows', 'singletonRows', 'uniqueRootForced', 'rootCollectionRows', 'rootQualityGroupUpdates',
  'rootCoverageWordOrs', 'rootCoverageWordCopies', 'rootCoveredOriginalRows'];
export const sha256 = data => createHash('sha256').update(data).digest('hex');

export function validateMatrix(matrix, { allowZero = false } = {}) {
  const { keys, rows, K, seed } = matrix;
  assert(Array.isArray(keys) && new Set(keys).size === keys.length);
  assert(keys.every(k => typeof k === 'string'));
  // IDs are the original stable ordering, never resort/remap fixture keys.
  assert(keys.every((key, i) => i === 0 || keys[i - 1] < key));
  assert(Array.isArray(rows) && rows.every(row => Array.isArray(row) && row.length));
  assert(Number.isInteger(K) && K >= 0 && K <= keys.length);
  assert(Array.isArray(seed) && seed.length === K && new Set(seed).size === K);
  for (const id of seed) assert(Number.isInteger(id) && id >= 0 && id < keys.length);
  for (const row of rows) for (const [id, q] of row) {
    assert(Number.isInteger(id) && id >= 0 && id < keys.length);
    assert(Number.isInteger(q) && q >= (allowZero ? 0 : 1) && q <= 0xffffffff);
  }
  selectedQuality(matrix, seed);
}

export function selectedQuality(matrix, selected) {
  const chosen = new Set(selected);
  return matrix.rows.map(row => {
    assert(row.some(([id]) => chosen.has(id)), 'witness misses original row');
    return Math.max(...row.filter(([id]) => chosen.has(id)).map(([, q]) => q));
  }).sort((a, b) => a - b);
}

export function validateWitness(matrix, result) {
  assert.equal(result.count, matrix.K);
  assert.equal(result.selected.length, matrix.K);
  assert.equal(new Set(result.selected).size, matrix.K);
  assert(result.selected.every((id, i) => Number.isInteger(id) && id >= 0 && id < matrix.keys.length
    && (i === 0 || result.selected[i - 1] < id)));
  assert.deepEqual(result.quality, selectedQuality(matrix, result.selected));
  return sha256(JSON.stringify({ selected: result.selected, quality: result.quality }));
}

export async function openEngine(path) {
  const bytes = await readFile(path);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const e = instance.exports, ptr = e.solver_new(4);
  assert(ptr, 'cannot create cover solver');
  const owner = { e, ptr };
  const experimental = typeof e.solver_threshold_experiment === 'function';
  const experimentVersion = experimental ? e.solver_threshold_experiment_version() : null;
  if (experimental) assert([1, 2].includes(experimentVersion));
  return {
    wasmHash: sha256(bytes), experimental, experimentVersion,
    traceEnabled: experimental && e.solver_threshold_trace_enabled() === 1,
    memoryBytes: () => e.memory.buffer.byteLength,
    close() { e.solver_free(ptr); },
    solve(matrix, { mask = 0, stateBudget = null, lockedPrefix = [], allowZero = false, timing = false } = {}) {
      validateMatrix(matrix, { allowZero });
      assert(Number.isInteger(mask) && mask >= 0 && mask <= 127
        && (!(mask & 96) || (mask & 4)), 'invalid experiment mask');
      if (mask > 31) assert.equal(experimentVersion, 2, 'root refinements require experiment ABI v2');
      assert(stateBudget === null || (Number.isSafeInteger(stateBudget) && stateBudget >= 0 && stateBudget < 0xffffffff));
      assert(lockedPrefix.every(x => Number.isInteger(x) && x >= 0 && x <= matrix.rows.length));
      if (!experimental) assert.equal(mask, 0, 'original engine does not support experiment masks');
      // The legacy ABI cannot represent a zero budget. Emulate only its documented
      // no-search outcome; this sample is never used in performance comparisons.
      if (!experimental && stateBudget === 0 && matrix.rows.length) {
        return { completed: false, count: matrix.K, selected: [...matrix.seed].sort((a,b) => a-b),
          quality: selectedQuality(matrix, matrix.seed), searchedStates: 0, provenPrefix: [] };
      }
      const offsets = new Uint32Array(matrix.rows.length + 1);
      const entries = matrix.rows.reduce((sum, row) => sum + row.length, 0);
      const ids = new Uint32Array(entries), qualities = new Uint32Array(entries);
      let at = 0;
      for (let r = 0; r < matrix.rows.length; r++) {
        offsets[r] = at;
        for (const [id, q] of matrix.rows[r]) { ids[at] = id; qualities[at++] = q; }
      }
      offsets[matrix.rows.length] = at;
      return withWasmU32Buffers(owner, { offsets, ids, qualities, seed: Uint32Array.from(matrix.seed),
        locked: Uint32Array.from(lockedPrefix) }, p => {
        const args = [ptr, p.offsets, matrix.rows.length, p.ids, p.qualities, entries,
          matrix.keys.length, matrix.K, p.seed, matrix.seed.length];
        let status;
        const nativeStarted = timing ? performance.now() : 0;
        if (experimental) status = e.solver_threshold_experiment(...args, p.locked, lockedPrefix.length,
          stateBudget ?? 0xffffffff, mask) >>> 0;
        else if (stateBudget === null) status = e.solver_min_cover_at_count_locked(...args, p.locked, lockedPrefix.length) >>> 0;
        else {
          assert.equal(lockedPrefix.length, 0, 'legacy bounded ABI does not accept locks');
          status = e.solver_min_cover_at_count_progress_bounded(...args, stateBudget) >>> 0;
        }
        const nativeMs = timing ? performance.now() - nativeStarted : undefined;
        assert.notEqual(status, 0xffffffff, 'Rust fixed-K search failed');
        const completed = status !== 0xfffffffe, count = completed ? status : matrix.K;
        const selected = Array.from({ length: count }, (_, i) => e.solver_min_cover_selected(ptr, i) >>> 0);
        const quality = Array.from({ length: e.solver_min_cover_quality_len(ptr) >>> 0 },
          (_, i) => e.solver_min_cover_quality(ptr, i) >>> 0);
        const prefixAvailable = experimental || (stateBudget !== null && e.solver_min_cover_proven_prefix_len);
        const provenPrefix = prefixAvailable ? Array.from({ length: e.solver_min_cover_proven_prefix_len(ptr) >>> 0 },
          (_, i) => e.solver_min_cover_proven_prefix(ptr, i) >>> 0) : undefined;
        const diagnostics = experimental && e.solver_threshold_trace_enabled() === 1
          ? Object.fromEntries(COUNTERS.slice(0, experimentVersion === 1 ? 12 : 20)
            .map((name, i) => [name, Number(e.solver_threshold_diagnostic(ptr, i))])) : undefined;
        return { completed, count, selected, quality, searchedStates: Number(e.solver_min_cover_searched_states(ptr)),
          ...(provenPrefix ? { provenPrefix } : {}), ...(diagnostics ? { diagnostics } : {}),
          ...(timing ? { nativeMs } : {}) };
      });
    },
  };
}

// Independent exhaustive oracle: proves K first, then original-row quality and
// stable-ID order. Intentionally does not call any product/experiment solver.
export function oracle(matrix) {
  const n = matrix.keys.length;
  assert(n <= 20);
  let best = null, lastSeed = null;
  const compare = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1; return 0; };
  for (let mask = 0; mask < 2 ** n; mask++) {
    const selected = Array.from({ length: n }, (_, id) => id).filter(id => mask & (1 << id));
    if (best && selected.length > best.selected.length) continue;
    if (!matrix.rows.every(row => row.some(([id]) => mask & (1 << id)))) continue;
    const quality = selectedQuality(matrix, selected);
    if (!best || selected.length < best.selected.length) { best = { selected, quality }; lastSeed = selected; }
    else {
      lastSeed = selected;
      if (compare(quality, best.quality) > 0 || (compare(quality, best.quality) === 0 && compare(selected, best.selected) < 0)) best = { selected, quality };
    }
  }
  assert(best);
  return { ...best, K: best.selected.length, seed: lastSeed };
}
