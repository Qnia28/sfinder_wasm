import test from 'node:test';
import assert from 'node:assert/strict';
import { refineMinimumCoverQuality } from '../src/highs-min-cover.mjs';
import { refineMinimumCoverQualityNaive } from './helpers/naive-refine.mjs';

function check(prepared, selected, options) {
  const got = refineMinimumCoverQuality(prepared, selected, options);
  const want = refineMinimumCoverQualityNaive(prepared, selected, options);
  assert.deepEqual(got, want);
}

function prepared(keys, cases, maxQuality) {
  return { keys: Array.from({ length: keys }, (_, i) => `S${i}`), cases, maxQuality };
}

test('top3 K=1 matches naive', () => {
  check(prepared(1, [[[0, 0]]], 0), [0]);
});

test('top3 K=2 empty base matches naive', () => {
  check(prepared(4, [
    [[0, 1], [2, 3]],
    [[1, 2], [3, 4]],
  ], 4), [0, 1]);
});

test('top3 K=3 exactly full matches naive', () => {
  check(prepared(5, [
    [[0, 7], [3, 8]],
    [[1, 5], [4, 9]],
    [[2, 2], [3, 6]],
  ], 9), [0, 1, 2]);
});

test('top3 duplicate qualities match naive', () => {
  check(prepared(6, [
    [[0, 5], [1, 5], [2, 5], [3, 5]],
    [[1, 4], [4, 4], [5, 4]],
    [[0, 1], [5, 9]],
  ], 9), [0, 1, 2, 4]);
});

test('top3 zero-quality membership stays independent', () => {
  check(prepared(5, [
    [[0, 0], [2, 0], [4, 3]],
    [[1, 0], [3, 2]],
    [[0, 1], [1, 1], [4, 1]],
  ], 3), [0, 1, 2]);
});

test('top3 sparse coverage matches naive', () => {
  check(prepared(8, [
    [[0, 1], [4, 8]],
    [[1, 2], [5, 7]],
    [[2, 3], [6, 6]],
    [[3, 4], [7, 5]],
  ], 8), [0, 1, 2, 3]);
});

test('top3 stable-ID tie matches naive', () => {
  check(prepared(4, [
    [[0, 5], [2, 5]],
    [[1, 5], [3, 5]],
  ], 5), [2, 3]);
});

test('top3 fixed point pass count matches naive', () => {
  const p = prepared(6, [
    [[0, 1], [2, 4], [4, 3]],
    [[0, 4], [3, 4], [5, 2]],
    [[1, 1], [2, 4], [5, 3]],
    [[1, 4], [3, 4], [4, 2]],
  ], 4);
  check(p, [0, 1], { maxPasses: 16 });
});

test('top3 randomized differential matches naive on 400 matrices', () => {
  let state = 0x9e3779b9;
  const rnd = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const pick = (n) => rnd() % n;

  let checked = 0;
  for (let attempt = 0; attempt < 20000 && checked < 400; attempt += 1) {
    const n = 3 + pick(7);
    const c = 1 + pick(8);
    const k = 2 + pick(Math.max(1, Math.min(5, n) - 1));
    const cases = [];
    let maxQuality = 0;
    for (let ci = 0; ci < c; ci += 1) {
      const row = [];
      for (let id = 0; id < n; id += 1) {
        if (pick(100) < 48) {
          const q = pick(7); // quality 0 deliberately included for synthetic coverage.
          row.push([id, q]);
          if (q > maxQuality) maxQuality = q;
        }
      }
      if (!row.length) {
        const q = pick(7);
        row.push([pick(n), q]);
        if (q > maxQuality) maxQuality = q;
      }
      cases.push(row);
    }
    const selected = [];
    while (selected.length < k) {
      const id = pick(n);
      if (!selected.includes(id)) selected.push(id);
    }
    const chosen = new Set(selected);
    if (!cases.every((row) => row.some(([id]) => chosen.has(id)))) continue;
    check(prepared(n, cases, maxQuality), selected, { maxPasses: 5 });
    checked += 1;
  }
  assert.equal(checked, 400);
});
