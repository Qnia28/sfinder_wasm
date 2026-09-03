import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOrderCountQuality, recordOrderCount } from '../src/human-ranking.mjs';

test('playableOrderCount records require positive integers and missing lookups fail fast', () => {
  const index = new Map();
  assert.throws(() => recordOrderCount(index, 'C0', { key: 'S0', orderCount: 0 }), /playableOrderCount must be an integer number in 1/);
  assert.throws(() => recordOrderCount(index, 'C0', { key: 'S0', orderCount: 1.5 }), /playableOrderCount must be an integer number in 1/);
  assert.throws(() => recordOrderCount(index, 'C0', { key: 'S0', orderCount: '2' }), /playableOrderCount must be an integer number in 1/);
  assert.throws(() => recordOrderCount(index, 'C0', { key: 'S0', orderCount: true }), /playableOrderCount must be an integer number in 1/);
  recordOrderCount(index, 'C0', { key: 'S0', orderCount: 2 });
  const qualityFor = makeOrderCountQuality(index);
  assert.equal(qualityFor('S0', 'C0'), 2);
  assert.throws(() => qualityFor('missing', 'C0'), /missing playableOrderCount for covered edge/);
});
