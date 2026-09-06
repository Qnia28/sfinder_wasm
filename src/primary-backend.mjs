// Initial automatic primary policy. Counts are measured AFTER the existing
// exact cardinality kernelization. This selector does not change Fast/exact
// quality classification, budgets, solver tolerances, or the cover objective.
export const CP_SAT_PRIMARY_THRESHOLD = Object.freeze({
  minCases: 200,
  minSolutions: 112,
  minEntries: 2200,
});

export function selectPrimaryBackendFromStats(stats, requested = 'auto', {ortoolsAvailable = true} = {}) {
  if (!['auto', 'rust', 'ortools', 'highs'].includes(requested)) {
    throw new RangeError('Invalid primary backend: ' + requested);
  }
  for (const key of ['cases', 'solutions', 'entries']) {
    if (!Number.isSafeInteger(stats[key]) || stats[key] < 0) {
      throw new RangeError('Invalid primary kernel statistic: ' + key);
    }
  }
  if (stats.cases === 0) return 'kernel';
  // Explicit requests are never changed by environment availability.
  if (requested !== 'auto') return requested;
  const t = CP_SAT_PRIMARY_THRESHOLD;
  return stats.cases >= t.minCases
    && stats.solutions >= t.minSolutions
    && stats.entries >= t.minEntries ? (ortoolsAvailable ? 'ortools' : 'highs') : 'rust';
}

export function selectPrimaryBackend(kernel, requested = 'auto', availability = {}) {
  return selectPrimaryBackendFromStats({
    cases: kernel.cases.length,
    solutions: kernel.solutionIds.length,
    entries: kernel.entryCount ?? kernel.cases.reduce((n, row) => n + row.length, 0),
  }, requested, availability);
}

export function normalizePrimary(value = 'Auto') {
  if (typeof value === 'string') {
    const mode = value.trim().toLowerCase();
    if (['auto', 'rust', 'highs', 'ortools'].includes(mode)) return mode;
  }
  throw new RangeError('Invalid Primary value: ' + String(value));
}

// Primary takes precedence over deprecated UseHiGHS aliases.
export function primaryRequest({primary, Primary, useHiGHS, UseHiGHS} = {}) {
  if (primary != null || Primary != null) return normalizePrimary(primary ?? Primary);
  const old = useHiGHS ?? UseHiGHS ?? 'auto';
  if (old === true || String(old).toLowerCase().trim() === 'true') return 'highs';
  if (old === false || String(old).toLowerCase().trim() === 'false') return 'rust';
  if (String(old).toLowerCase().trim() === 'auto') return 'auto';
  throw new RangeError('Invalid UseHiGHS value: ' + String(old));
}
