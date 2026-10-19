// Selected after the 2026-10-18 secondary screen and frozen-input confirmation.
// Explicit integrated budgets retain the legacy scaling/precedence contract.
export const DEFAULT_FAST_POLICY = 'U192_OR_D16';
export const FAST_POLICIES = Object.freeze([DEFAULT_FAST_POLICY]);

export function resolveFastBudgets({ fastStateBudget, fastPolicy = DEFAULT_FAST_POLICY,
  fastPreviewBudget, fastGraceBudget } = {}) {
  if (!FAST_POLICIES.includes(fastPolicy)) throw new RangeError(`invalid fastPolicy: ${fastPolicy}`);
  const explicit = fastStateBudget !== undefined;
  // Preserve historical 0/NaN/default and negative-value handling.
  const integrated = Math.max(1, Math.floor(Number(fastStateBudget) || 100000));
  const auxiliary = (value, fallback, name) => {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a nonnegative safe integer`);
    return value; // Explicit zero disables this auxiliary stage.
  };
  return { policy: fastPolicy, explicit, integrated,
    preview: auxiliary(fastPreviewBudget, explicit ? Math.max(1, Math.min(2500, Math.floor(integrated / 20))) : 2500, 'fastPreviewBudget'),
    grace: auxiliary(fastGraceBudget, explicit ? Math.max(1, Math.min(5000, Math.floor(integrated / 10))) : 5000, 'fastGraceBudget') };
}

// F counts DISTINCT original singleton candidates, never kernel-forced IDs.
// With proven K, F <= K. Partial observations are bounds, not exact features.
export function selectFastBudget(prepared, K, budgets) {
  const S = prepared.keys.length;
  const result = (budget, reason, visitedRows = 0, lower = 0, exact = false) => ({
    budget, reason, S, K, visitedRows, forcedLowerBound: lower, forcedUpperBound: exact ? lower : K,
    featuresComplete: exact, F: exact ? lower : null, u: exact ? S - lower : null, d: exact ? K - lower : null,
  });
  if (budgets.explicit) return result(budgets.integrated, 'explicit-budget');
  const u = 192;
  const d = 16;
  const cutoff = Math.max(S - u, K - d);
  if (cutoff < 0) return result(100000, 'S/K-upper-bound');
  if (cutoff >= K) return result(10000, 'F<=K-bound');
  const forced = new Set();
  let visited = 0;
  for (const row of prepared.cases) {
    visited++;
    if (row.length === 1) forced.add(row[0][0]);
    if (forced.size > cutoff) return result(100000, 'singleton-lower-bound', visited, forced.size, visited === prepared.cases.length);
  }
  return result(10000, 'singleton-complete', visited, forced.size, true);
}

export function createFastTelemetry(mode, policy = DEFAULT_FAST_POLICY) {
  if (!mode) return null;
  if (![true, 'timing', 'trace'].includes(mode)) throw new RangeError('fastDiagnostics must be false, timing or trace');
  const start = performance.now();
  const data = { schema: 1, policy, mode: mode === 'trace' ? 'trace' : 'timing',
    appliedBudgets: { preview: 0, integrated: 0, grace: 0 }, stages: [] };
  return {
    data,
    begin: () => performance.now(),
    end(name, start, result = null, seedKeys = null, budget = null) {
      const ms = performance.now() - start;
      if (budget !== null) data.appliedBudgets[name] = budget;
      const stage = { name, ms, budget, completed: result?.completed ?? null, states: result?.searchedStates ?? null };
      if (name === 'refine') stage.passes = result?.passes ?? null;
      if (mode === 'trace') Object.assign(stage, { inputKeys: seedKeys, keys: result?.keys ?? null,
        qualityVector: result?.qualityVector ?? null });
      data.stages.push(stage);
    },
    finish(reason) { return { ...data, reason, totalMs: performance.now() - start }; },
  };
}
