// Adapter for the frozen Dev prepared-numeric API. Never calls a search method.
export function prepareNumericInput(matrix, { registerNumericCoverage, packNumericQualityRows }) {
  const prepared = { keys: matrix.keys, keyIndex: new Map(matrix.keys.map((key, id) => [key, id])),
    rawCases: matrix.rows.map((_, caseId) => ({ caseId })),
    primaryCases: matrix.rows.map(row => row.map(([id]) => id)) };
  const packed = packNumericQualityRows(matrix.rows, matrix.keys.length);
  if (packed.caseCount !== matrix.rows.length) throw new Error('original row count changed');
  const coverage = {};
  registerNumericCoverage(coverage, prepared, packed);
  return { coverage, prepared, packed, qualityFor: () => { throw new Error('numeric quality input must be reused'); } };
}
