import assert from 'node:assert/strict';
export const median = values => {
  const a = [...values].sort((x, y) => x - y), n = a.length;
  return n ? (a[Math.floor((n - 1) / 2)] + a[Math.floor(n / 2)]) / 2 : null;
};
export function distribution(values) {
  const a = [...values].sort((x, y) => x - y);
  const q = p => a.length ? a[Math.max(0, Math.ceil(a.length * p) - 1)] : null;
  return { n: a.length, sum: a.reduce((x, y) => x + y, 0), median: median(a), p95: q(.95), p99: q(.99), max: q(1) };
}
export function qualityDifference(base, candidate, fixture = null) {
  assert.equal(base.K, candidate.K);
  assert.equal(base.qualityVector.length, candidate.qualityVector.length);
  const first = base.qualityVector.findIndex((v, i) => v !== candidate.qualityVector[i]);
  const result = { relation: first < 0 ? 'EQUAL' : candidate.qualityVector[first] > base.qualityVector[first] ? 'BETTER' : 'WORSE',
    firstSortedDifference: first < 0 ? null : first,
    baselineAtDifference: first < 0 ? null : base.qualityVector[first],
    candidateAtDifference: first < 0 ? null : candidate.qualityVector[first],
    proofLost: base.qualityExact === true && candidate.qualityExact === false,
    proofGained: base.qualityExact === false && candidate.qualityExact === true };
  if (fixture) {
    const ids = keys => new Set(keys.map(k => { const id = fixture.keys.indexOf(k); assert(id >= 0); return id; }));
    const b = ids(base.keys), c = ids(candidate.keys);
    let lowerRows = 0, higherRows = 0, lowerMagnitude = 0, higherMagnitude = 0;
    for (const row of fixture.rows) {
      let bv = 0, cv = 0;
      for (const [id, value] of row) { if (b.has(id)) bv = Math.max(bv, value); if (c.has(id)) cv = Math.max(cv, value); }
      assert(bv > 0 && cv > 0);
      if (cv < bv) { lowerRows++; lowerMagnitude += bv - cv; }
      if (cv > bv) { higherRows++; higherMagnitude += cv - bv; }
    }
    Object.assign(result, { lowerRows, higherRows, lowerMagnitude, higherMagnitude });
  }
  return result;
}
