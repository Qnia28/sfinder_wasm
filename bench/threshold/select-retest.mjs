import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';

const bytes = readFileSync(new URL('./reports/expanded100.json', import.meta.url)), report = JSON.parse(bytes);
const manifest = readFileSync(new URL('./cycle1-100/manifest.json', import.meta.url));
assert.equal(report.manifestHash, sha256(manifest));
const completed = report.perCase.filter(c => c.pairedComplete === 5);
assert.equal(completed.length, 80);
// R-7 linear interpolation, as used by common statistical packages.
function quantile(values, p) {
  const a = [...values].sort((x, y) => x - y), index = (a.length - 1) * p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return a[lo] + (a[hi] - a[lo]) * (index - lo);
}
function spread(values) {
  if (values.length < 2) return null;
  return (Math.max(...values) - Math.min(...values)) / quantile(values, 0.5);
}
const ratios = completed.map(c => c.pairedSpeedupMedian);
const p90 = quantile(ratios, 0.9), p10 = quantile(ratios, 0.1);
const cases = [];
for (const row of report.perCase) {
  const samples = report.samples.filter(s => s.caseId === row.caseId);
  const offSpread = spread(samples.filter(s => s.side === 'left' && s.status === 'EXACT').map(s => s.nativeMs));
  const onSpread = spread(samples.filter(s => s.side === 'right' && s.status === 'EXACT').map(s => s.nativeMs));
  const ratioSpread = spread(row.paired.filter(p => p.speedup !== null).map(p => p.speedup));
  const reasons = [];
  if (row.pairedComplete === 5 && row.pairedSpeedupMedian >= p90) reasons.push('p90-fast');
  if (row.pairedComplete === 5 && row.pairedSpeedupMedian <= p10) reasons.push('p90-slow');
  if (offSpread !== null && offSpread >= 0.1) reasons.push('off-spread>=10%');
  if (onSpread !== null && onSpread >= 0.1) reasons.push('on-spread>=10%');
  if (ratioSpread !== null && ratioSpread >= 0.1) reasons.push('paired-spread>=10%');
  if (reasons.length) cases.push({ caseId: row.caseId, suite: row.suite, reasons,
    firstSpeedup: row.pairedSpeedupMedian, offSpread, onSpread, ratioSpread,
    offExact: row.leftExact, onExact: row.rightExact });
}
cases.sort((a, b) => a.caseId.localeCompare(b.caseId, 'en'));
const selection = { version: 1, sourceRunId: report.runId, sourceReportHash: sha256(bytes),
  manifestHash: report.manifestHash, wasmHash: report.wasmHashes.experiment,
  sourceDigest: report.sourceDigest, mask: 16, pairs: 10, timeoutSeconds: 300,
  policy: 'P90 fast/slow = upper/lower deciles of per-matrix paired-median OFF/ON ratios among 80 matrices with five complete pairs (R7 quantile). Spread = (max-min)/median of OFF nativeMs, ON nativeMs or complete paired ratios; any >=10% selects a matrix. Censored timeout is never converted to a time. Select the union, do not replace the initial100 or duplicate matrix.',
  cutoff: { completeMatrices: completed.length, p90Speedup: p90, p10Speedup: p10, relativeRange: 0.1 }, cases };
writeFileSync(new URL('./retest-selection.json', import.meta.url), JSON.stringify(selection, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ selected: cases.length, calls: cases.length * 20, cutoff: selection.cutoff,
  reasonCounts: [...new Set(cases.flatMap(c => c.reasons))].map(reason => ({ reason, count: cases.filter(c => c.reasons.includes(reason)).length })) }, null, 2));
