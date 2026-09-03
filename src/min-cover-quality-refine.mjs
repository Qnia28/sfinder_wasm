function stableIdsLess(a, b) {
  if (!b) return true;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

function compareHistograms(a, b) {
  const n = Math.max(a.length, b.length);
  for (let q = 0; q < n; q += 1) {
    const av = a[q] ?? 0;
    const bv = b[q] ?? 0;
    if (av !== bv) return av < bv ? 1 : -1;
  }
  return 0;
}

function qualityRankTable(cases) {
  const values = [0];
  for (const row of cases) for (const [, quality] of row) values.push(quality >>> 0);
  values.sort((a, b) => a - b);
  let write = 1;
  for (let read = 1; read < values.length; read += 1) {
    if (values[read] !== values[write - 1]) values[write++] = values[read];
  }
  values.length = write;
  return { values, rankOf: new Map(values.map((quality, rank) => [quality, rank])) };
}

function selectedQualityHistogram(selected, denseRanks, caseCount, rankCount) {
  const histogram = new Uint32Array(rankCount);
  for (let ci = 0; ci < caseCount; ci += 1) {
    let bestRank = 0;
    for (const id of selected) bestRank = Math.max(bestRank, denseRanks[id * caseCount + ci]);
    histogram[bestRank] += 1;
  }
  return histogram;
}

function histogramVector(histogram, qualityValues) {
  const out = [];
  for (let rank = 0; rank < histogram.length; rank += 1) {
    for (let n = histogram[rank]; n > 0; n -= 1) out.push(qualityValues[rank]);
  }
  return out;
}

// Deterministic 2-for-2 local refinement. Cardinality and full coverage remain
// exact; this pass only chooses a more human-friendly member of the proven
// minimum-cardinality family. The pass is deliberately bounded to local moves
// so hard matrices never re-enter an exponential exact quality enumeration.
export function refineMinimumCoverQuality(prepared, initialSelected, { maxPasses = 16 } = {}) {
  const { cases, keys } = prepared;
  const solutionCount = keys.length;
  const caseCount = cases.length;
  const { values: qualityValues, rankOf: qualityRankOf } = qualityRankTable(cases);
  const dense = new Uint32Array(solutionCount * caseCount);
  const covers = new Uint8Array(solutionCount * caseCount);
  const candidateCases = Array.from({ length: solutionCount }, () => []);
  for (let ci = 0; ci < caseCount; ci += 1) {
    for (const [id, q] of cases[ci]) {
      const index = id * caseCount + ci;
      dense[index] = qualityRankOf.get(q >>> 0);
      covers[index] = 1;
      candidateCases[id].push(ci);
    }
  }

  if (initialSelected.length < 2 || !caseCount) {
    const selected = [...initialSelected].sort((a, b) => a - b);
    const histogram = selectedQualityHistogram(selected, dense, caseCount, qualityValues.length);
    return { selected, qualityVector: histogramVector(histogram, qualityValues), passes: 0 };
  }

  let selected = [...initialSelected].sort((a, b) => a - b);
  let bestHistogram = selectedQualityHistogram(selected, dense, caseCount, qualityValues.length);
  let passes = 0;

  for (; passes < maxPasses; passes += 1) {
    const coverCount = new Uint16Array(caseCount);
    for (const id of selected) for (const ci of candidateCases[id]) coverCount[ci] += 1;

    // A 2-for-2 move removes exactly two selected candidates. Precompute the
    // three highest selected qualities for every case once per pass; for any
    // removal pair (a, b), the first top-3 entry owned by neither a nor b is
    // exactly max quality over selected \ {a, b}. Coverage membership remains
    // independent in `covers`; this table is quality-only.
    const top3Id = new Int32Array(caseCount * 3).fill(-1);
    const top3Q = new Uint32Array(caseCount * 3);
    for (let ci = 0; ci < caseCount; ci += 1) {
      let id0 = -1; let q0 = 0;
      let id1 = -1; let q1 = 0;
      let id2 = -1; let q2 = 0;
      for (const id of selected) {
        const q = dense[id * caseCount + ci];
        if (id0 === -1 || q > q0) {
          id2 = id1; q2 = q1; id1 = id0; q1 = q0; id0 = id; q0 = q;
        } else if (id1 === -1 || q > q1) {
          id2 = id1; q2 = q1; id1 = id; q1 = q;
        } else if (id2 === -1 || q > q2) {
          id2 = id; q2 = q;
        }
      }
      const offset = ci * 3;
      top3Id[offset] = id0; top3Q[offset] = q0;
      top3Id[offset + 1] = id1; top3Q[offset + 1] = q1;
      top3Id[offset + 2] = id2; top3Q[offset + 2] = q2;
    }

    let bestMove = null;
    let passHistogram = bestHistogram;
    let passSelected = selected;

    for (let ai = 0; ai < selected.length; ai += 1) {
      for (let bi = ai + 1; bi < selected.length; bi += 1) {
        const a = selected[ai];
        const b = selected[bi];
        const base = selected.filter((_, index) => index !== ai && index !== bi);
        const baseSet = new Uint8Array(solutionCount);
        for (const id of base) baseSet[id] = 1;

        const missing = [];
        for (let ci = 0; ci < caseCount; ci += 1) {
          const remaining = coverCount[ci]
            - covers[a * caseCount + ci]
            - covers[b * caseCount + ci];
          if (remaining === 0) missing.push(ci);
        }
        if (!missing.length) continue;

        const candidates = [];
        for (let id = 0; id < solutionCount; id += 1) {
          if (baseSet[id]) continue;
          let contributes = false;
          const offset = id * caseCount;
          for (const ci of missing) {
            if (covers[offset + ci]) { contributes = true; break; }
          }
          if (contributes) candidates.push(id);
        }

        const baseQuality = new Uint32Array(caseCount);
        for (let ci = 0; ci < caseCount; ci += 1) {
          const offset = ci * 3;
          for (let rank = 0; rank < 3; rank += 1) {
            const id = top3Id[offset + rank];
            if (id === -1) break;
            if (id !== a && id !== b) {
              baseQuality[ci] = top3Q[offset + rank];
              break;
            }
          }
        }

        for (let xi = 0; xi < candidates.length; xi += 1) {
          const x = candidates[xi];
          const xo = x * caseCount;
          for (let yi = xi + 1; yi < candidates.length; yi += 1) {
            const y = candidates[yi];
            const yo = y * caseCount;
            let coversMissing = true;
            for (const ci of missing) {
              if (!covers[xo + ci] && !covers[yo + ci]) { coversMissing = false; break; }
            }
            if (!coversMissing) continue;

            const histogram = new Uint32Array(qualityValues.length);
            for (let ci = 0; ci < caseCount; ci += 1) {
              const q = Math.max(baseQuality[ci], dense[xo + ci], dense[yo + ci]);
              histogram[q] += 1;
            }
            const candidateSelected = [...base, x, y].sort((l, r) => l - r);
            const cmp = compareHistograms(histogram, passHistogram);
            if (cmp > 0 || (cmp === 0 && stableIdsLess(candidateSelected, passSelected))) {
              bestMove = [a, b, x, y];
              passHistogram = histogram;
              passSelected = candidateSelected;
            }
          }
        }
      }
    }

    if (!bestMove) break;
    selected = passSelected;
    bestHistogram = passHistogram;
  }

  return { selected, qualityVector: histogramVector(bestHistogram, qualityValues), passes };
}

