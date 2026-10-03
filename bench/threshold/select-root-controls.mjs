// Freeze structural controls before screening outcomes are downloaded. No
// timing, completion status, or old report is consulted by this selector.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { sha256 } from './engine.mjs';
const base = new URL('./cycle1-100/', import.meta.url);
const bytes = readFileSync(new URL('manifest.json', base));
const manifest = JSON.parse(bytes);
const rows = manifest.cases.map(c => {
  const gzip = readFileSync(new URL(c.file, base)); assert.equal(sha256(gzip), c.compressedSha256);
  const input = gunzipSync(gzip); assert.equal(sha256(input), c.sha256);
  const matrix = JSON.parse(input);
  const forced = new Set(matrix.rows.filter(row => new Set(row.map(([id]) => id)).size === 1).map(row => row[0][0]));
  const coverage = matrix.rows.filter(row => row.some(([id]) => forced.has(id))).length / matrix.rows.length;
  return { caseId: c.id, mirrorGroup: c.mirrorGroup, F: forced.size, coverage };
});
const quantile = (xs, p) => {
  const a = [...xs].sort((a, b) => a - b), h = (a.length - 1) * p, lo = Math.floor(h);
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (h - lo);
};
const cutoffs = { F: [quantile(rows.map(r => r.F), 1 / 3), quantile(rows.map(r => r.F), 2 / 3)],
  coverage: [quantile(rows.map(r => r.coverage), 1 / 3), quantile(rows.map(r => r.coverage), 2 / 3)] };
const bin = (value, cuts) => value <= cuts[0] ? 'low' : value <= cuts[1] ? 'mid' : 'high';
const buckets = new Map();
for (const row of rows.sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0)) {
  const bucket = `F-${bin(row.F, cutoffs.F)}-coverage-${bin(row.coverage, cutoffs.coverage)}`;
  if (!buckets.has(bucket)) buckets.set(bucket, []);
  const entries = buckets.get(bucket);
  if (entries.length < 2 && !entries.some(c => c.mirrorGroup === row.mirrorGroup)) entries.push({ ...row, bucket });
}
const cases = [...buckets.values()].flat();
writeFileSync(new URL('./root-structural-controls.json', import.meta.url), JSON.stringify({
  manifestHash: sha256(bytes), cutoffs,
  rule: 'R7 tertiles of singleton-forced candidate count and forced original-row coverage. In each nonempty 3x3 cell, choose up to two lexical IDs from distinct mirror groups. Read only input structure, no timing or completion outcomes.',
  noneForcedInDB: rows.filter(r => r.F === 0).length,
  cases,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ cases: cases.length, cutoffs, noneForcedInDB: rows.filter(r => !r.F).length }, null, 2));
