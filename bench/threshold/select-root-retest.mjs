import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';
const reportBytes = readFileSync(new URL('./reports/root-confirm.json', import.meta.url));
const report = JSON.parse(reportBytes);
const controls = JSON.parse(readFileSync(new URL('./root-structural-controls.json', import.meta.url)));
assert.equal(report.profile, 'root-confirm'); assert.equal(report.pairs, 5);
assert.equal(report.comparisons.length, 1); assert.equal(report.cases, 100);
assert.equal(report.manifestHash, controls.manifestHash);
const full = report.perCase.filter(c => c.pairedComplete === 5);
assert(full.length > 0);
const quantile = (xs, p) => {
  const a = [...xs].sort((a, b) => a - b), h = (a.length - 1) * p, lo = Math.floor(h);
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (h - lo);
};
const cutoff = { p90: quantile(full.map(c => c.pairedSpeedupMedian), 0.9),
  p10: quantile(full.map(c => c.pairedSpeedupMedian), 0.1), relativeRange: 0.1, fullMatrices: full.length };
const cases = report.perCase.flatMap(c => {
  const reasons = [];
  if (c.pairedComplete === 5 && c.pairedSpeedupMedian >= cutoff.p90) reasons.push('p90-fast');
  if (c.pairedComplete === 5 && c.pairedSpeedupMedian <= cutoff.p10) reasons.push('p90-slow');
  for (const [key, name] of [['offSpread', 'off'], ['onSpread', 'on'], ['ratioSpread', 'paired']]) {
    if (c[key] !== null && c[key] >= 0.1) reasons.push(`${name}-spread>=10%`);
  }
  if (c.sideRegression || c.pairedRegression) reasons.push('regression-alert');
  if (c.leftOnlyExact > 0 || c.rightOnlyExact > 0) reasons.push('completion-discordance');
  if (c.memoryReview) reasons.push('memory-alert');
  const control = controls.cases.find(s => s.caseId === c.caseId);
  if (control) reasons.push(`structural:${control.bucket}`);
  return reasons.length ? [{ caseId: c.caseId, reasons, initialRatio: c.pairedSpeedupMedian }] : [];
}).sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0);
writeFileSync(new URL('./root-retest-selection.json', import.meta.url), JSON.stringify({
  sourceRunId: report.runId, sourceReportHash: sha256(reportBytes), manifestHash: report.manifestHash,
  mask: report.comparisons[0].rightMask & ~16, pairs: 10, timeoutSeconds: 300,
  wasmHash: report.wasmHashes.experiment, sourceDigest: report.sourceDigest,
  cutoff, cases,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ selected: cases.length, calls: cases.length * 20, cutoff }, null, 2));
