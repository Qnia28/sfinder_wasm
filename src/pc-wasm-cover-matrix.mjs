import { numericPrepared, numericPacked } from "./numeric-cover-data.mjs";
import { requirePositiveQuality } from "./quality-contract.mjs";

export function packNumericIdRows(rawCases, { filterEmpty = false } = {}) {
  if (!filterEmpty && numericPacked(rawCases)) return { ...numericPacked(rawCases), cases: rawCases };
  const cases = filterEmpty ? rawCases.filter((row) => row?.length) : rawCases;
  let entryCount = 0;
  for (const row of cases) entryCount += row.length;
  const offsets = new Uint32Array(cases.length + 1);
  const ids = new Uint32Array(entryCount);
  let position = 0;
  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    offsets[caseIndex] = position;
    for (const id of cases[caseIndex]) ids[position++] = id;
  }
  offsets[cases.length] = position;
  return { cases, caseCount: cases.length, entryCount, offsets, ids };
}

export function packNumericQualityRows(rawCases, solutionCount) {
  const cases = rawCases.filter((row) => row?.length);
  let entryCount = 0;
  for (const row of cases) entryCount += row.length;
  const offsets = new Uint32Array(cases.length + 1);
  const ids = new Uint32Array(entryCount);
  const qualities = new Uint32Array(entryCount);
  let position = 0;
  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    offsets[caseIndex] = position;
    for (const entry of cases[caseIndex]) {
      const id = Number(entry[0]);
      if (!Number.isInteger(id) || id < 0 || id >= solutionCount) {
        throw new Error(`invalid numeric minimum-cover candidate ${entry[0]}`);
      }
      ids[position] = id;
      qualities[position] = requirePositiveQuality(entry[1], { key: id, caseId: caseIndex });
      position += 1;
    }
  }
  offsets[cases.length] = position;
  return { cases, caseCount: cases.length, entryCount, offsets, ids, qualities };
}

export function coverageUniverse(coverage) {
  if (numericPrepared(coverage)) return numericPrepared(coverage);
  const rawCases = [];
  const keySet = new Set();
  for (const [caseId, solutions] of coverage) {
    if (!solutions?.size) continue;
    const row = [...solutions];
    for (const key of row) keySet.add(key);
    rawCases.push({ caseId, row });
  }
  const keys = [...keySet].sort();
  const keyIndex = new Map(keys.map((key, index) => [key, index]));
  return { rawCases, keys, keyIndex };
}

export function packCoverageRows(rawCases, keyIndex, qualityFor = null) {
  if (numericPacked(rawCases)) return { ...numericPacked(rawCases), qualities: qualityFor === null ? null : numericPacked(rawCases).qualities };
  let entryCount = 0;
  for (const row of rawCases) entryCount += row.row.length;
  const offsets = new Uint32Array(rawCases.length + 1);
  const ids = new Uint32Array(entryCount);
  const qualities = qualityFor === null ? null : new Uint32Array(entryCount);
  let position = 0;
  for (let caseIndex = 0; caseIndex < rawCases.length; caseIndex += 1) {
    offsets[caseIndex] = position;
    const row = rawCases[caseIndex];
    for (const key of row.row) {
      ids[position] = keyIndex.get(key);
      if (qualities) {
        qualities[position] = requirePositiveQuality(qualityFor(key, row.caseId), {
          key,
          caseId: row.caseId,
        });
      }
      position += 1;
    }
  }
  offsets[rawCases.length] = position;
  return { caseCount: rawCases.length, entryCount, offsets, ids, qualities };
}

export function withWasmU32Buffers(owner, arrays, callback) {
  const pointers = {};
  const entries = Object.entries(arrays);
  const allocated = [];
  try {
    for (const [name, values] of entries) {
      const pointer = owner.e.wasm_alloc_u32(values.length);
      pointers[name] = pointer;
      allocated.push([name, values]);
      if (values.length) new Uint32Array(owner.e.memory.buffer, pointer, values.length).set(values);
    }
    return callback(pointers);
  } finally {
    for (let index = allocated.length - 1; index >= 0; index -= 1) {
      const [name, values] = allocated[index];
      owner.e.wasm_dealloc_u32(pointers[name], values.length);
    }
  }
}
