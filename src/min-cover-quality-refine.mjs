// base and (x, y) are sorted and disjoint. Compare the merged IDs without
// allocating/sorting a candidate selection for every equal-quality pair.
function mergedIdsLess(base, x, y, other) {
  let bi = 0; let added = 0;
  for (let i = 0; i < other.length; i += 1) {
    const next = added === 0 ? x : added === 1 ? y : Infinity;
    const id = bi < base.length && base[bi] < next ? base[bi++] : (added++, next);
    if (id !== other[i]) return id < other[i];
  }
  return false;
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

function selectedQualityHistogram(selected, denseRanks, caseCount, rankCount, weights) {
  const histogram = new Uint32Array(rankCount);
  for (let ci = 0; ci < caseCount; ci += 1) {
    let bestRank = 0;
    for (const id of selected) bestRank = Math.max(bestRank, denseRanks[id * caseCount + ci]);
    histogram[bestRank] += weights[ci];
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
  const { keys } = prepared;
  // Equal candidate/quality rows evolve identically under every 2-for-2 move.
  // Keep their multiplicity: dropping duplicate rows would change maximin quality.
  let cases = prepared.cases;
  let weights = new Uint32Array(cases.length).fill(1);
  if (cases.length >= 128) {
    const classes = new Map();
    const unique = [];
    const counts = [];
    for (const row of cases) {
      const signature = [...row].sort((a, b) => a[0] - b[0])
        .map(([id, q]) => `${id}:${q >>> 0}`).join(',');
      const previous = classes.get(signature);
      if (previous !== undefined) counts[previous] += 1;
      else { classes.set(signature, unique.length); unique.push(row); counts.push(1); }
    }
    cases = unique;
    weights = Uint32Array.from(counts);
  }
  const solutionCount = keys.length;
  const caseCount = cases.length;
  const { values: qualityValues, rankOf: qualityRankOf } = qualityRankTable(cases);
  const dense = new Uint32Array(solutionCount * caseCount);
  const covers = new Uint8Array(solutionCount * caseCount);
  const candidateCases = Array.from({ length: solutionCount }, () => []);
  const forced = new Uint8Array(solutionCount);
  const rowCandidates = [];
  for (let ci = 0; ci < caseCount; ci += 1) {
    const ids = [...new Set(cases[ci].map(([id]) => id))].sort((a, b) => a - b);
    rowCandidates.push(ids);
    if (ids.length === 1) forced[ids[0]] = 1;
    for (const [id, q] of cases[ci]) {
      const index = id * caseCount + ci;
      dense[index] = qualityRankOf.get(q >>> 0);
      if (!covers[index]) candidateCases[id].push(ci);
      covers[index] = 1;
    }
  }

  if (initialSelected.length < 2 || !caseCount) {
    const selected = [...initialSelected].sort((a, b) => a - b);
    const histogram = selectedQualityHistogram(selected, dense, caseCount, qualityValues.length, weights);
    return { selected, qualityVector: histogramVector(histogram, qualityValues), passes: 0 };
  }

  let selected = [...initialSelected].sort((a, b) => a - b);
  let bestHistogram = selectedQualityHistogram(selected, dense, caseCount, qualityValues.length, weights);
  let passes = 0;
  // Scratch arrays never escape. A winning histogram is snapshotted before
  // these buffers are reused; passHistogram must remain immutable in a pass.
  const coverCount = new Uint16Array(caseCount);
  const selectedSet = new Uint8Array(solutionCount);
  const top3Id = new Int32Array(caseCount * 3);
  const top3Q = new Uint32Array(caseCount * 3);
  const baseQuality = new Uint32Array(caseCount);
  const baseHistogram = new Uint32Array(qualityValues.length);
  const xQuality = new Uint32Array(caseCount);
  const xHistogram = new Uint32Array(qualityValues.length);
  const histogram = new Uint32Array(qualityValues.length);
  const contributes = new Uint8Array(solutionCount);
  let missingMasks = new Uint32Array(0);

  for (; passes < maxPasses; passes += 1) {
    coverCount.fill(0);
    selectedSet.fill(0);
    for (const id of selected) {
      selectedSet[id] = 1;
      for (const ci of candidateCases[id]) coverCount[ci] += 1;
    }
    // A proven minimum cover is irredundant. Keep the historical neighborhood
    // for nonminimal callers too: redundant seeds need the unpruned pair loop.
    const irredundant = selected.every(id => candidateCases[id].some(ci => coverCount[ci] === 1));
    const forcedAnchor = selected.find(id => forced[id]);

    // A 2-for-2 move removes exactly two selected candidates. Precompute the
    // three highest selected qualities for every case once per pass; for any
    // removal pair (a, b), the first top-3 entry owned by neither a nor b is
    // exactly max quality over selected \ {a, b}. Coverage membership remains
    // independent in `covers`; this table is quality-only.
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
        // Two forced IDs can only be re-added (a no-op). With one forced ID,
        // this is a 1-for-1 exchange of the other ID. One canonical forced
        // anchor enumerates all such exchanges for an irredundant cover.
        if (forced[a] && forced[b]) continue;
        if (irredundant && (forced[a] || forced[b]) && (forced[a] ? a : b) !== forcedAnchor) continue;
        let base;

        const missing = [];
        for (let ci = 0; ci < caseCount; ci += 1) {
          const remaining = coverCount[ci]
            - covers[a * caseCount + ci]
            - covers[b * caseCount + ci];
          if (remaining === 0) missing.push(ci);
        }
        if (!missing.length) continue;

        // Encode membership (including quality zero), not quality rank. The
        // original rows let us build the union without scanning S x missing.
        const words = Math.ceil(missing.length / 32);
        const maskLength = solutionCount * words;
        if (missingMasks.length < maskLength) missingMasks = new Uint32Array(maskLength);
        else missingMasks.fill(0, 0, maskLength);
        contributes.fill(0);
        let pivot = null;
        for (let mi = 0; mi < missing.length; mi += 1) {
          const word = mi >>> 5, bit = 1 << (mi & 31);
          const eligible = [];
          for (const id of rowCandidates[missing[mi]]) {
            if (selectedSet[id] && id !== a && id !== b) continue;
            eligible.push(id);
            missingMasks[id * words + word] |= bit;
            contributes[id] = 1;
          }
          if (pivot === null || eligible.length < pivot.length) pivot = eligible;
        }
        const candidates = [];
        for (let id = 0; id < solutionCount; id += 1) if (contributes[id]) candidates.push(id);
        // >>> 0 keeps the high-bit/full-word comparison unsigned (32,64,...).
        const lastMask = 0xffffffff >>> ((32 - (missing.length & 31)) & 31);

        baseQuality.fill(0);
        baseHistogram.fill(0);
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
          baseHistogram[baseQuality[ci]] += weights[ci];
        }

        const pivotSet = new Set(pivot);
        // Every feasible pair contains a candidate covering the sparsest
        // missing row. Orient x to that row, then choose y from a row x misses.
        // If x covers all missing rows, any contributing y remains eligible.
        for (const x of pivot) {
          const xo = x * caseCount;
          const xm = x * words;
          let xReady = false;
          let partners = null;
          for (const ci of missing) {
            if (covers[xo + ci]) continue;
            if (partners === null || rowCandidates[ci].length < partners.length) partners = rowCandidates[ci];
          }
          for (const y of partners ?? candidates) {
            if (y === x || !contributes[y] || (pivotSet.has(y) && y < x)) continue;
            const yo = y * caseCount;
            const ym = y * words;
            let coversMissing = true;
            for (let word = 0; word < words; word += 1) {
              const target = word === words - 1 ? lastMask : 0xffffffff;
              if (((missingMasks[xm + word] | missingMasks[ym + word]) >>> 0) !== target) {
                coversMissing = false; break;
              }
            }
            if (!coversMissing) continue;

            // Build base+x only for an x participating in a feasible pair.
            // Adding y can change only rows actually covered by y.
            if (!xReady) {
              xQuality.set(baseQuality);
              xHistogram.set(baseHistogram);
              for (const ci of candidateCases[x]) {
                const q = dense[xo + ci], old = xQuality[ci];
                if (q > old) {
                  xHistogram[old] -= weights[ci]; xHistogram[q] += weights[ci];
                  xQuality[ci] = q;
                }
              }
              xReady = true;
            }
            histogram.set(xHistogram);
            for (const ci of candidateCases[y]) {
              const q = dense[yo + ci], old = xQuality[ci];
              if (q > old) { histogram[old] -= weights[ci]; histogram[q] += weights[ci]; }
            }
            const cmp = compareHistograms(histogram, passHistogram);
            if (cmp < 0) continue;
            base ??= selected.filter((_, index) => index !== ai && index !== bi);
            if (cmp > 0 || (cmp === 0 && mergedIdsLess(base, Math.min(x, y), Math.max(x, y), passSelected))) {
              bestMove = [a, b, x, y];
              passHistogram = histogram.slice();
              passSelected = [...base, x, y].sort((l, r) => l - r);
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
