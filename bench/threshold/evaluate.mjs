import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Descriptive screening only. It never selects/enables a candidate automatically.
const path = resolve(process.argv[2] || 'bench/threshold/results/aggregate/results.json');
const report = JSON.parse(readFileSync(path));
assert(!report.invalid, 'invalid/missing jobs block evaluation');
const rows = report.rows.map(r => ({ ...r,
  regressionReview: r.pairedComplete > 0 && r.rightMedianMs >= r.leftMedianMs * 1.1
    && r.rightMedianMs - r.leftMedianMs >= 5,
  exactToTimeout: r.leftOnlyExact > 0,
  memoryReview: r.rightPeakRssMedianKiB > r.leftPeakRssMedianKiB * 1.2
    || r.rightWasmMemoryMedianBytes > r.leftWasmMemoryMedianBytes * 1.2,
}));
const groups = new Map();
for (const row of rows) {
  const key = `${row.suite}:${row.left.engine}/${row.left.mask}->${row.right.engine}/${row.right.mask}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const comparisons = [...groups].map(([comparison, local]) => {
  const finite = local.map(r => r.pairedSpeedupMedian).filter(s => s !== null && s > 0);
  return { comparison, cases: local.length, completedCases: finite.length,
    descriptiveGeomeanSpeedup: finite.length ? Math.exp(finite.reduce((n, s) => n + Math.log(s), 0) / finite.length) : null,
    regressionReview: local.filter(r => r.regressionReview).map(r => r.caseId),
    exactToTimeout: local.filter(r => r.exactToTimeout).map(r => r.caseId),
    rightOnlyExactPairs: local.reduce((n, r) => n + r.rightOnlyExact, 0),
    memoryReview: local.filter(r => r.memoryReview).map(r => r.caseId) };
});
const evaluation = { source: path, comparisons, rows,
  note: 'Geomean is descriptive over completed-case within-job median ratios; not a pooled absolute time or statistical significance test. Inspect each case and censored outcomes. No automatic candidate promotion.' };
const out = dirname(path);
writeFileSync(resolve(out, 'evaluation.json'), JSON.stringify(evaluation, null, 2));
const md = ['# Threshold review', evaluation.note,
  '| Comparison | Completed cases | Descriptive speedup | Regression review | Exact→timeout | Memory review |',
  '|---|---|---|---|---|---|',
  ...comparisons.map(c => `| ${c.comparison} | ${c.completedCases}/${c.cases} | ${c.descriptiveGeomeanSpeedup?.toFixed(3) ?? '-'} | ${c.regressionReview.join(', ') || '-'} | ${c.exactToTimeout.join(', ') || '-'} | ${c.memoryReview.join(', ') || '-'} |`),
  '\nFull per-case data are in evaluation.json. Candidate mask requires an explicit frozen decision and ablation/confirmation runs.'
].join('\n');
writeFileSync(resolve(out, 'evaluation.md'), md + '\n');
console.log(md);
