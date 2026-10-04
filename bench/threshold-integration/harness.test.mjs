import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifest, loadFixture } from './fixtures.mjs';
import { settings } from './profiles.mjs';
import { reviewRow } from './review.mjs';
test('frozen source200 and selected32 inputs, direct product comparisons, hard10 shard cap', () => {
  assert.equal(manifest.cases.length, 200);
  const config = JSON.parse(readFileSync(new URL('./run.json', import.meta.url)));
  assert.equal(config.cases.length, 32); assert.equal(new Set(config.cases).size, 32);
  assert.equal(config.cases.filter(id => loadFixture(id).entry.cohort === 'qb').length, 16);
  assert.deepEqual(settings('product-confirm').map(c => [c.left.engine, c.right.engine]), [['D', 'A'], ['A', 'B']]);
  assert.throws(() => settings('product-confirm', 16));
  const workflow = readFileSync(new URL('../../.github/workflows/threshold-integration.yml', import.meta.url), 'utf8');
  assert.equal((workflow.match(/max-parallel: 10/g) || []).length, 2);
  assert.match(workflow, /needs: \[build, correctness, control\]/);
  assert.match(workflow, /pc-wasm\/threshold-current-propagation,pc-wasm\/threshold-root-forced/);
});
test('small repeat-consistent slowdowns remain reported below material threshold', () => {
  const raw = Array.from({ length: 10 }, (_, pair) => [{ pair, side: 'left', status: 'EXACT', nativeMs: 20 }, { pair, side: 'right', status: 'EXACT', nativeMs: 23 }]).flat();
  const row = { executedPairs: 10, pairedComplete: 10, pairedSpeedupMedian: 20 / 23, leftMedianMs: 20, rightMedianMs: 23,
    leftPeakRssMedianKiB: 100, rightPeakRssMedianKiB: 100, leftWasmMemoryMedianBytes: 100, rightWasmMemoryMedianBytes: 100 };
  const result = reviewRow(row, raw); assert.equal(result.slowerPairs, 10); assert.equal(result.pairedDeltaMs, 3);
  assert.equal(result.pairedRegression, false); assert.equal(result.recheckReasons.length, 0);
});
