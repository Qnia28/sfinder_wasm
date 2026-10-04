import { coverageUniverse, packCoverageRows } from './pc-wasm-cover-matrix.mjs';
import { createNumericCoverage } from './numeric-cover-data.mjs';
import { minimumCoverAdaptiveAsync } from './min-cover-adaptive.mjs';
import { primaryRequest } from './primary-backend.mjs';

// Called only when a slot is ready. Never transfer the request owner's CSR.
export function packFilterTask(coverage, qualityFor, options = {}) {
  const { keys, keyIndex, rawCases } = coverageUniverse(coverage);
  const packed = packCoverageRows(rawCases, keyIndex, qualityFor);
  return {
    keys: keys.slice(), caseIds: rawCases.map(row => row.caseId),
    offsets: packed.offsets.slice(), ids: packed.ids.slice(), qualities: packed.qualities?.slice() ?? null,
    options: {
      primary: primaryRequest(options), exactQuality: options.exactQuality ?? 'true',
      fastStateBudget: options.fastStateBudget,
      tinyExactMaxCandidates: options.tinyExactMaxCandidates ?? 48,
      primaryProof: options.primaryProof ?? 'standard',
      secondary: options.secondary ?? 'auto',
      exactProbe: options.exactProbe ?? 'reference',
      exactProbeTiming: options.exactProbeTiming ?? false,
    },
  };
}

export function restoreFilterTask(payload) {
  const { keys, caseIds, offsets, ids, qualities } = payload;
  if (!Array.isArray(keys) || keys.some((key, i) => typeof key !== 'string' || (i && keys[i - 1] >= key))
      || !(offsets instanceof Uint32Array) || !(ids instanceof Uint32Array)
      || !offsets.length || offsets[0] !== 0 || offsets.at(-1) !== ids.length
      || !Array.isArray(caseIds) || caseIds.length !== offsets.length - 1
      || new Set(caseIds).size !== caseIds.length
      || (qualities !== null && (!(qualities instanceof Uint32Array) || qualities.length !== ids.length))) {
    throw new Error('invalid filter matrix payload');
  }
  const rows = new Map();
  for (let row = 0; row < caseIds.length; row++) {
    if (offsets[row] >= offsets[row + 1] || offsets[row + 1] > ids.length) throw new Error('invalid filter row offsets');
    const entries = [], seen = new Set();
    for (let edge = offsets[row]; edge < offsets[row + 1]; edge++) {
      const id = ids[edge], quality = qualities === null ? 1 : qualities[edge];
      if (id >= keys.length || seen.has(id) || !quality) throw new Error('invalid filter matrix edge');
      seen.add(id); entries.push([id, quality]);
    }
    rows.set(row, entries);
  }
  // Includes real primaryCases AND quality cases, unlike the secondary-only worker.
  const view = createNumericCoverage(keys, rows, caseIds.map(caseId => ({ caseId })));
  return { ...view, qualityFor: qualities === null ? null : (key, caseId) => view.qualityIndex.get(caseId)?.get(key) };
}

export async function solveFilterTask(payload, solver, signal) {
  signal?.throwIfAborted();
  const { coverage, qualityFor } = restoreFilterTask(payload);
  const result = await minimumCoverAdaptiveAsync(coverage, { ...payload.options, solver, qualityFor, signal });
  signal?.throwIfAborted();
  return result;
}
