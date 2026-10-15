import test from 'node:test';
import assert from 'node:assert/strict';
import { runFastFixedK, ARMS } from '../tools/fast-bench/adapter.mjs';

const fixture = { keys: ['a', 'b', 'c'], rows: [[[0, 1], [1, 2], [2, 3]]], K: 1, seed: [0] };
const context = { fixture, coverage: {}, qualityFor: () => 1,
  prepared: { keys: fixture.keys, cases: fixture.rows }, primaryHard: false, previewEligible: true };
const answer = (key, completed = false) => ({ count: 1, keys: [key], qualityVector: [fixture.keys.indexOf(key) + 1], completed, searchedStates: 1 });

test('discard preview incumbent; carry integrated then grace into refine', () => {
  const calls = [];
  const solver = { minimumCoverAtCount: (_c, _k, o) => {
    calls.push(o); return answer(['c', 'b', 'c'][calls.length - 1]);
  } };
  const r = runFastFixedK(context, solver, 'BASE100');
  assert.deepEqual(calls.map(c => c.seedKeys), [['a'], ['a'], ['b']]);
  assert.deepEqual(calls.map(c => c.stateBudget), [2500, 100000, 5000]);
  assert.deepEqual(r.stages.at(-1).inputKeys, ['c']);
  assert.equal(r.qualityExact, false); assert.deepEqual(r.qualityVector, [3]);
});

test('each completed proof terminates subsequent stages', () => {
  for (let stop = 0; stop < 3; stop++) {
    let calls = 0;
    const r = runFastFixedK(context, { minimumCoverAtCount: () => answer('b', calls++ === stop) }, 'BASE100');
    assert.equal(calls, stop + 1); assert.equal(r.qualityExact, true);
    assert.equal(r.stages.length, calls);
  }
});

test('DIRECT, hard guard, preview eligibility and preview-only semantics', () => {
  const forbidden = { minimumCoverAtCount: () => assert.fail('unexpected probe') };
  runFastFixedK(context, forbidden, 'DIRECT');
  for (const arm of Object.keys(ARMS)) runFastFixedK({ ...context, primaryHard: true }, forbidden, arm);
  runFastFixedK({ ...context, previewEligible: false }, forbidden, 'P_ONLY_2x2');
  let calls = 0;
  const r = runFastFixedK(context, { minimumCoverAtCount: () => { calls++; return answer('c'); } }, 'P_ONLY_2x2');
  assert.equal(calls, 1); assert.deepEqual(r.stages.at(-1).inputKeys, ['a']);
});

test('abort before entry and reject invalid witnesses, including discarded preview', () => {
  const ac = new AbortController(); ac.abort();
  assert.throws(() => runFastFixedK(context, {}, 'DIRECT', { signal: ac.signal }), /abort/i);
  assert.throws(() => runFastFixedK(context, { minimumCoverAtCount: () => ({ ...answer('b'), qualityVector: [99] }) }, 'P_ONLY_2x2'), /quality mismatch/);
});
