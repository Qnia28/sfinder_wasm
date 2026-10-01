// Request-owned numeric matrix metadata. Weak keys cannot retain a completed request.
const matrices = new WeakMap();
const packedRows = new WeakMap();
export function registerNumericCoverage(coverage, prepared, packed) {
  matrices.set(coverage, prepared);
  packedRows.set(prepared.rawCases, packed);
  packedRows.set(prepared.primaryCases, packed);
}
export const numericPrepared = coverage => matrices.get(coverage);
export const numericPacked = rows => packedRows.get(rows);

// rows retain caller-defined case and edge order; only candidate IDs are sorted.
// This avoids rebuilding string Sets and repacking the same matrix at each solver boundary.
export function createNumericCoverage(allKeys, rows, cases) {
  const active = new Set();
  for (const row of rows.values()) for (const [id] of row) active.add(id);
  const solutionIds = [...active].sort((a, b) => allKeys[a] < allKeys[b] ? -1 : allKeys[a] > allKeys[b] ? 1 : 0);
  const keys = solutionIds.map(id => allKeys[id]), keyIndex = new Map(keys.map((key, id) => [key, id]));
  const idMap = new Map(solutionIds.map((id, i) => [id, i])), orderedCases = [...rows.keys()];
  const numericRows = [...rows.values()].map(row => row.map(([id, q]) => [idMap.get(id), q]));
  const primaryCases = numericRows.map(row => row.map(([id]) => id));
  const caseIndex = new Map(orderedCases.map((ci, i) => [cases[ci].caseId, i]));
  const rawCases = orderedCases.map(ci => ({ caseId: cases[ci].caseId }));
  const entryCount = numericRows.reduce((sum, row) => sum + row.length, 0);
  const offsets = new Uint32Array(numericRows.length + 1), ids = new Uint32Array(entryCount), qualities = new Uint32Array(entryCount);
  const coverageCounts = new Uint32Array(keys.length);
  let position = 0, maxQuality = 0;
  for (let ci = 0; ci < numericRows.length; ci++) {
    offsets[ci] = position;
    for (const [id, q] of numericRows[ci]) {
      ids[position] = id; qualities[position++] = q;
      maxQuality = Math.max(maxQuality, q); coverageCounts[id]++;
    }
  }
  offsets[numericRows.length] = position;
  const prepared = { keys, keyIndex, rawCases, cases: numericRows, primaryCases, entryCount, maxQuality };
  const packed = { caseCount: numericRows.length, entryCount, offsets, ids, qualities };
  function keySet(index) {
    const row = primaryCases[index];
    return { size: row.length, has: key => row.includes(keyIndex.get(key)), *[Symbol.iterator]() { for (const id of row) yield keys[id]; } };
  }
  const coverage = {
    size: numericRows.length,
    *entries() { for (let i = 0; i < orderedCases.length; i++) yield [cases[orderedCases[i]].caseId, keySet(i)]; },
    *values() { for (let i = 0; i < orderedCases.length; i++) yield keySet(i); },
    [Symbol.iterator]() { return this.entries(); },
    toMap() { return new Map([...this].map(([id, set]) => [id, new Set(set)])); },
  };
  registerNumericCoverage(coverage, prepared, packed);
  const qualityIndex = { get(caseId) {
    const row = numericRows[caseIndex.get(caseId)];
    return row ? { get(key) { return row.find(([id]) => id === keyIndex.get(key))?.[1]; } } : undefined;
  } };
  return { coverage, qualityIndex, prepared, coverageCount: key => coverageCounts[keyIndex.get(key)] ?? 0 };
}
