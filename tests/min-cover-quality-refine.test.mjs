import test from 'node:test';
import assert from 'node:assert/strict';
import { refineMinimumCoverQuality } from '../src/min-cover-quality-refine.mjs';

// Deliberately slow, independent oracle: evaluate every allowed exchange on
// original rows, with no rank table, row compression, top-3 or bit masks.
function reference(prepared, initialSelected, { maxPasses = 16 } = {}) {
  const rows = prepared.cases.map(row => new Map(row.map(([id, q]) => [id, q >>> 0])));
  const vector = ids => rows.map(row => Math.max(0, ...ids.map(id => row.get(id) ?? 0))).sort((a, b) => a - b);
  const compare = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
  };
  let selected = [...initialSelected].sort((a, b) => a - b), qualityVector = vector(selected), passes = 0;
  if (selected.length < 2 || !rows.length) return { selected, qualityVector, passes };
  for (; passes < maxPasses; passes++) {
    let next = selected, nextQuality = qualityVector;
    for (let ai = 0; ai < selected.length; ai++) for (let bi = ai + 1; bi < selected.length; bi++) {
      const base = selected.filter((_, i) => i !== ai && i !== bi);
      const missing = rows.filter(row => !base.some(id => row.has(id)));
      if (!missing.length) continue;
      const candidates = prepared.keys.map((_, id) => id).filter(id => !base.includes(id) && missing.some(row => row.has(id)));
      for (let xi = 0; xi < candidates.length; xi++) for (let yi = xi + 1; yi < candidates.length; yi++) {
        const x = candidates[xi], y = candidates[yi];
        if (!missing.every(row => row.has(x) || row.has(y))) continue;
        const ids = [...base, x, y].sort((a, b) => a - b), q = vector(ids), cmp = compare(q, nextQuality);
        if (cmp > 0 || cmp === 0 && compare(ids, next) < 0) { next = ids; nextQuality = q; }
      }
    }
    if (next === selected) break;
    selected = next; qualityVector = nextQuality;
  }
  return { selected, qualityVector, passes };
}

function check(prepared, seed, maxPasses) {
  const before = structuredClone({ prepared, seed });
  const actual = refineMinimumCoverQuality(prepared, seed, { maxPasses });
  assert.deepEqual(actual, reference(prepared, seed, { maxPasses }));
  assert.equal(actual.selected.length, seed.length);
  assert.equal(new Set(actual.selected).size, seed.length);
  assert(prepared.cases.every(row => row.some(([id]) => actual.selected.includes(id))));
  assert.deepEqual({ prepared, seed }, before, 'inputs remain unchanged');
  return actual;
}

test('empty/singleton, zero-quality coverage, unsigned qualities and stable ties', () => {
  check({ keys: [], cases: [] }, [], 16);
  check({ keys: ['a'], cases: [[[0, 0]]] }, [0], 16);
  const prepared = { keys: ['a', 'b', 'c', 'd'], cases: [
    [[0, 0], [2, 0]], [[1, 0], [3, 0]], [[0, -1], [1, 0x80000000], [2, 7], [3, 8]],
  ] };
  for (const max of [0, 1, 3, 16]) check(prepared, [3, 2], max);
  const tied = { keys: prepared.keys, cases: [[[0, 1], [2, 1]], [[1, 1], [3, 1]]] };
  assert.deepEqual(check(tied, [3, 2], 16).selected, [0, 1]);
});

test('missing coverage masks preserve high bits, partial words and duplicate row weights', () => {
  for (const count of [31, 32, 33, 63, 64, 65, 127, 128, 129]) {
    const cases = Array.from({ length: count }, (_, i) => [
      [i % 2, i + 1], [2 + i % 3, count - i], [5, i === count - 1 ? 0 : i + 3],
    ]);
    // Only candidate 0/1 plus the matching alternatives cover each row; the
    // final bit must be checked even when its quality is zero.
    if (count % 2) cases[count - 1] = [[0, 0], [4, 0]];
    check({ keys: ['a', 'b', 'c', 'd', 'e', 'f'], cases }, [1, 0], 3);
  }
  const rows = [[[0, 1], [2, 4]], [[1, 3], [3, 1]], [[0, 2], [1, 2], [2, 1], [3, 3]]];
  const cases = Array.from({ length: 160 }, (_, i) => [...rows[i < 130 ? 0 : i % 3]].reverse());
  check({ keys: ['a', 'b', 'c', 'd'], cases }, [0, 1], 16);
});

test('deterministic tiny generated matrices match exhaustive exchanges at each pass budget', () => {
  let state = 0x6a09e667;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  for (let trial = 0; trial < 120; trial++) {
    const S = 4 + random(5), K = 2 + random(Math.min(3, S - 1));
    const keys = Array.from({ length: S }, (_, i) => `k${i}`), seed = Array.from({ length: K }, (_, i) => i);
    const cases = Array.from({ length: 1 + random(12) }, () => {
      const ids = new Set([random(K)]);
      for (let i = 0; i < S; i++) if (random(3) === 0) ids.add(i);
      return [...ids].map(id => [id, random(6)]).reverse();
    });
    for (const maxPasses of [0, 1, 3, 16]) check({ keys, cases }, [...seed].reverse(), maxPasses);
  }
});
