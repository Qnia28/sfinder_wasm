// Opt-in experiment only. The default product policy remains the audited Auto.
export function decideExperimentalProbe(policy = 'baseline', primaryHard, structure) {
  if (!['baseline', 'A', 'B'].includes(policy)) throw new Error('invalid experimental triage policy');
  const n = structure?.candidateCount, k = structure?.count, f = structure?.forcedCount;
  const valid = [n, k, f].every(Number.isInteger) && 0 <= f && f <= k && k <= n;
  const d = valid ? k - f : null;
  const baseline = !primaryHard;
  const useProbe = !valid || policy === 'baseline' ? baseline
    : d >= 17 ? false : policy === 'B' ? true : baseline;
  return Object.freeze({ policy, primaryHard: Boolean(primaryHard), validStructure: valid, d,
    useProbe, reason: !valid ? 'unknown-baseline' : useProbe === baseline ? 'baseline-route'
      : useProbe ? 'hard-low-mid-probe' : 'high-d-skip-probe' });
}
