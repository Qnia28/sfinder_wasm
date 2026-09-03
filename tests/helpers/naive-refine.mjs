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

function selectedQualityHistogram(selected, dense, caseCount, maxQuality) {
  const histogram = new Uint32Array(maxQuality + 1);
  for (let ci = 0; ci < caseCount; ci += 1) {
    let best = 0;
    for (const id of selected) best = Math.max(best, dense[id * caseCount + ci]);
    histogram[best] += 1;
  }
  return histogram;
}

function histogramVector(histogram) {
  const out = [];
  for (let q = 0; q < histogram.length; q += 1) {
    for (let n = histogram[q]; n > 0; n -= 1) out.push(q);
  }
  return out;
}

// Test/benchmark oracle: Release 2.5 refinement with the original O(K*N)
// baseQuality rescan retained verbatim.
export function refineMinimumCoverQualityNaive(prepared, initialSelected, { maxPasses = 16 } = {}) {
  const { cases, keys, maxQuality } = prepared;
  const solutionCount = keys.length;
  const caseCount = cases.length;
  const dense = new Uint32Array(solutionCount * caseCount);
  const covers = new Uint8Array(solutionCount * caseCount);
  const candidateCases = Array.from({ length: solutionCount }, () => []);
  for (let ci = 0; ci < caseCount; ci += 1) {
    for (const [id, q] of cases[ci]) {
      const index = id * caseCount + ci;
      dense[index] = q;
      covers[index] = 1;
      candidateCases[id].push(ci);
    }
  }

  if (initialSelected.length < 2 || !caseCount) {
    const selected = [...initialSelected].sort((a, b) => a - b);
    const histogram = selectedQualityHistogram(selected, dense, caseCount, maxQuality);
    return { selected, qualityVector: histogramVector(histogram), passes: 0 };
  }

  let selected = [...initialSelected].sort((a, b) => a - b);
  let bestHistogram = selectedQualityHistogram(selected, dense, caseCount, maxQuality);
  let passes = 0;

  for (; passes < maxPasses; passes += 1) {
    const coverCount = new Uint16Array(caseCount);
    for (const id of selected) for (const ci of candidateCases[id]) coverCount[ci] += 1;
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
        for (const id of base) {
          const offset = id * caseCount;
          for (let ci = 0; ci < caseCount; ci += 1) {
            if (dense[offset + ci] > baseQuality[ci]) baseQuality[ci] = dense[offset + ci];
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

            const histogram = new Uint32Array(maxQuality + 1);
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

  return { selected, qualityVector: histogramVector(bestHistogram), passes };
}
