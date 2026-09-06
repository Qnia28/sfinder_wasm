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
