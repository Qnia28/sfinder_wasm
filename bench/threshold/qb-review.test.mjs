import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { reviewRow, median } from './qb-review.mjs';
function data(off, on, statuses = null) {
  const raw = off.flatMap((x, pair) => [
    { pair, side: 'left', status: statuses?.[pair]?.[0] || 'EXACT', nativeMs: x },
    { pair, side: 'right', status: statuses?.[pair]?.[1] || 'EXACT', nativeMs: on[pair] },
  ]);
  const done = off.map((x, i) => [x, on[i], statuses?.[i] || ['EXACT', 'EXACT']]).filter(([, , s]) => s.every(x => x === 'EXACT'));
  const row = { executedPairs: off.length, pairedComplete: done.length,
    pairedSpeedupMedian: median(done.map(([a, b]) => a / b)),
    leftMedianMs: median(done.map(([a]) => a)), rightMedianMs: median(done.map(([, b]) => b)),
    leftPeakRssMedianKiB: 100, rightPeakRssMedianKiB: 100, leftWasmMemoryMedianBytes: 100, rightWasmMemoryMedianBytes: 100 };
  return { row, raw };
}
test('anomaly policy ignores tiny absolute slowdowns and pure timing noise, retains material regressions', () => {
  for (const [off, on, expected] of [
    [[1, 1, 1], [2, 2, 2], false], [[10, 20, 30], [20, 20, 20], false],
    [[100, 100, 100], [120, 120, 120], true],
  ]) {
    const { row, raw } = data(off, on); const r = reviewRow(row, raw);
    assert.equal(r.recheckReasons.length > 0, expected);
  }
});
test('long consistent slowdowns, substantial gains, discordance and memory flagged', () => {
  for (const [off, on, reason] of [
    [[60000, 60000, 60000], [60200, 60200, 60200], 'long-input-consistent-slowdown'],
    [[1000, 1000, 1000], [500, 500, 500], 'large-gain-over1point5'],
  ]) {
    const { row, raw } = data(off, on); assert(reviewRow(row, raw).recheckReasons.includes(reason));
  }
  const { row, raw } = data([100, 100, 100], [100, undefined, 100], [['EXACT', 'EXACT'], ['EXACT', 'TIMEOUT'], ['EXACT', 'EXACT']]);
  row.rightWasmMemoryMedianBytes = 121;
  const reasons = reviewRow(row, raw).recheckReasons;
  assert(reasons.includes('completion-discordance')); assert(reasons.includes('memory-over20percent'));
});
test('QB workflow is max10 shards with serial campaigns and enough deadline for all40 recheck calls', () => {
  const r = spawnSync(process.execPath, ['bench/threshold/qb-plan.mjs'], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } });
  assert.equal(r.status, 0, r.stderr); const plan = JSON.parse(r.stdout);
  assert.equal(plan.matrix.setup.length, 100); assert.equal(plan.maxParallel, 10);
  assert.equal(plan.jobMinutes, 80); assert.equal(plan.recheckMinutes, 244);
  const wf = readFileSync(new URL('../../.github/workflows/threshold-qb.yml', import.meta.url), 'utf8');
  assert.equal((wf.match(/max-parallel: 10/g) || []).length, 3);
  assert.match(wf, /needs: \[build, package, review\]/);
  assert.match(wf, /node bench\/threshold\/qb-review\.mjs/);
  assert.match(wf, /node bench\/threshold\/check-retest-build\.mjs/);
});
