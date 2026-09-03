export function orderMinimalKeysByCoverage(keys, coverage) {
  const rows = keys.map((key) => {
    let coverageCount = 0;
    for (const set of coverage.values()) if (set.has(key)) coverageCount += 1;
    return { key, coverageCount };
  });
  rows.sort((left, right) =>
    right.coverageCount - left.coverageCount || left.key.localeCompare(right.key));
  return {
    keys: rows.map((row) => row.key),
    coverageCounts: rows.map((row) => row.coverageCount),
  };
}
