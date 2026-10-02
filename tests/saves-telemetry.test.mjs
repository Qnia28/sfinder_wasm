import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaves } from '../src/saves-feature.mjs';

const input = { sourceFumen: 'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH', pattern: 'T,*p3', wantedSave: 'ALL' };
test('A6: off path does not read measurement clocks or solver counters', () => {
  let clocks = 0, scans = 0;
  const previous = globalThis.performance;
  globalThis.performance = { now() { clocks++; return 0; } };
  try {
    const result = calculateSaves({ ...input, solver: {
      saveOutcomesPattern() { return new Uint32Array(); },
      stats() { scans++; throw new Error('stats must not be scanned'); },
    } });
    assert.equal(clocks, 0); assert.equal(scans, 0); assert.equal('stats' in result, false);
  } finally { globalThis.performance = previous; }
});
test('A6: on path retains exact results, finite accounting and independent snapshots', () => {
  const solver = { saveOutcomesPattern() { return new Uint32Array(); } };
  for (const wantedSave of ['ALL', 'I,J', 'TIJ||IOS']) {
    const plain = calculateSaves({ ...input, wantedSave, solver });
    const { stats, ...measured } = calculateSaves({ ...input, wantedSave, solver, stats: true });
    assert.deepEqual(measured, plain);
    let assigned = 0;
    for (const key of ['expandMs', 'prepareMs', 'searchMs', 'aggregateMs', 'evalMs', 'unassignedMs']) {
      assert.ok(Number.isFinite(stats[key]) && stats[key] >= 0, key); assigned += stats[key];
    }
    assert.ok(assigned <= stats.wallMs + 0.5);
    const snapshot = structuredClone(stats);
    calculateSaves({ ...input, wantedSave, solver, stats: true });
    assert.deepEqual(stats, snapshot);
  }
});
