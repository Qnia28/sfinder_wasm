import { readdirSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const input = resolve(process.argv[2] || 'bench/threshold/results/downloads');
const output = resolve(process.argv[3] || 'bench/threshold/results/aggregate');
mkdirSync(output,{recursive:true});
function collect(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? collect(resolve(dir,entry.name)) : entry.name==='summary.json' ? [resolve(dir,entry.name)] : []);
}
const reports = collect(input).map(file=>({file,...JSON.parse(readFileSync(file))}));
if (!reports.length) throw new Error('no benchmark summaries; jobs may have failed before recording results');
const reference = reports[0].environment;
for (const report of reports) for (const key of ['profile','mask','pairs','timeoutSeconds','candidate','baseline','manifestHash']) {
  assert.deepEqual(report.environment[key],reference[key],`mixed runs: ${key}`);
}
for (const report of reports) assert.deepEqual(report.environment.build.hashes,reference.build.hashes,'mixed WASM builds');
const invalid = reports.some(r=>r.invalid), rows = reports.flatMap(r=>r.rows.map(row=>({
  ...row, runner:r.environment.runner, candidate:r.environment.candidate, report:r.file,
})));
const expected = process.env.EXPECTED_MATRIX ? JSON.parse(process.env.EXPECTED_MATRIX).case : [];
const observed = new Set(rows.map(r=>r.caseId));
const missing = expected.filter(id=>!observed.has(id));
const result = { invalid: invalid || missing.length > 0, missing, reports:reports.map(r=>({file:r.file,environment:r.environment})), rows,
  note:'Only within-job paired ratios are valid. Absolute times are not pooled across runners. No censored timeout is converted to a completed time.' };
writeFileSync(resolve(output,'results.json'),JSON.stringify(result,null,2));
const markdown = ['# Threshold paired results', result.note,
  '| Case | Comparison | Exact L/R | Paired speedup | Left-only / right-only |',
  '|---|---|---|---|---|',...rows.map(r=>`| ${r.caseId} | ${r.left.engine}/${r.left.mask} → ${r.right.engine}/${r.right.mask} | ${r.leftExact}/${r.rightExact} | ${r.pairedSpeedupMedian?.toFixed(3) ?? '-'} | ${r.leftOnlyExact}/${r.rightOnlyExact} |`),
  `\nReports=${reports.length}; invalid=${result.invalid}; missing=${missing.join(',') || 'none'}. Check failed jobs before making conclusions.`,
].join('\n');
writeFileSync(resolve(output,'summary.md'),markdown+'\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown+'\n');
console.log(markdown);
if (result.invalid) process.exitCode=1;
