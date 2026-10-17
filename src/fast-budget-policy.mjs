// Opt-in Fast experiment policies. The legacy budget contract remains the default.
export const FAST_POLICIES = Object.freeze(['legacy', 'U192', 'U228', 'S200',
  'U228_OR_D16', 'U192_OR_D16', 'S200_OR_D16', 'I10_FIXED_AUX', 'DIRECT_2X2', 'PREVIEW_ONLY']);

export function resolveFastBudgets({ fastStateBudget, fastPolicy = 'legacy',
  fastPreviewBudget, fastGraceBudget } = {}) {
  if (!FAST_POLICIES.includes(fastPolicy)) throw new RangeError(`invalid fastPolicy: ${fastPolicy}`);
  const explicit = fastStateBudget !== undefined;
  // Preserve historical 0/NaN/default and negative-value handling.
  const integrated = Math.max(1, Math.floor(Number(fastStateBudget) || 100000));
  const legacy = explicit || fastPolicy === 'legacy';
  const auxiliary = (value, fallback, name) => {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a nonnegative safe integer`);
    return value; // Explicit zero disables this auxiliary stage.
  };
  // Route-only experiments preserve explicit integrated-budget precedence,
  // including the historical fastStateBudget:0 => 100K contract.
  if (!explicit && ['DIRECT_2X2', 'PREVIEW_ONLY'].includes(fastPolicy)) {
    // Validate overrides even when this route does not execute their stages.
    auxiliary(fastGraceBudget, 0, 'fastGraceBudget');
    const preview = auxiliary(fastPreviewBudget, fastPolicy === 'PREVIEW_ONLY' ? 2500 : 0, 'fastPreviewBudget');
    return { policy: fastPolicy, explicit, integrated: 0, preview: fastPolicy === 'PREVIEW_ONLY' ? preview : 0, grace: 0 };
  }
  return { policy: fastPolicy, explicit, integrated,
    preview: auxiliary(fastPreviewBudget, legacy ? Math.max(1, Math.min(2500, Math.floor(integrated / 20))) : 2500, 'fastPreviewBudget'),
    grace: auxiliary(fastGraceBudget, legacy ? Math.max(1, Math.min(5000, Math.floor(integrated / 10))) : 5000, 'fastGraceBudget') };
}

// F counts DISTINCT original singleton candidates, never kernel-forced IDs.
// With proven K, F <= K. Partial observations are bounds, not exact features.
export function selectFastBudget(prepared, K, budgets) {
  const S = prepared.keys.length;
  const result = (budget, reason, visitedRows = 0, lower = 0, exact = false) => ({
    budget, reason, S, K, visitedRows, forcedLowerBound: lower, forcedUpperBound: exact ? lower : K,
    featuresComplete: exact, F: exact ? lower : null, u: exact ? S - lower : null, d: exact ? K - lower : null,
  });
  if (budgets.explicit || budgets.policy === 'legacy') return result(budgets.integrated, budgets.explicit ? 'explicit-budget' : 'legacy');
  if (['DIRECT_2X2', 'PREVIEW_ONLY'].includes(budgets.policy)) return result(0, budgets.policy.toLowerCase());
  if (budgets.policy === 'I10_FIXED_AUX') return result(10000, 'fixed-10k');
  if (budgets.policy === 'S200') return result(S > 200 ? 10000 : 100000, 'S>200');
  if (budgets.policy === 'S200_OR_D16' && S >= 200) return result(10000, 'S>=200');
  const u = budgets.policy.startsWith('U192') ? 192 : budgets.policy.startsWith('U228') ? 228 : Infinity;
  const d = budgets.policy.endsWith('_OR_D16') ? 16 : Infinity;
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

export function createFastTelemetry(mode, policy = 'legacy') {
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
