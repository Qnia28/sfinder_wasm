// The bounded probe policy is independent of the lifetime of the exact engines.
export const DEFAULT_SECONDARY_TRIAGE_POLICY = 'A_H9';
export function decideExperimentalProbe(policy = 'baseline', primaryHard, structure) {
  if (!['baseline', 'A', 'B', 'A_H9'].includes(policy)) throw new Error('invalid experimental triage policy');
  const n = structure?.candidateCount, k = structure?.count, f = structure?.forcedCount;
  const valid = [n, k, f].every(Number.isInteger) && 0 <= f && f <= k && k <= n;
  const d = valid ? k - f : null;
  const baseline = !primaryHard;
  const useProbe = !valid || policy === 'baseline' ? baseline
    : d >= 17 ? false : policy === 'B' ? true : policy === 'A_H9' ? baseline || d <= 9 : baseline;
  return Object.freeze({ policy, primaryHard: Boolean(primaryHard), validStructure: valid, d,
    useProbe, reason: !valid ? 'unknown-baseline' : useProbe === baseline ? 'baseline-route'
      : useProbe ? 'hard-low-mid-probe' : 'high-d-skip-probe' });
}
