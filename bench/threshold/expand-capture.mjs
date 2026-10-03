import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BASELINE_SHA, sha256, validateMatrix } from './engine.mjs';

const input = resolve(process.argv[2]), output = resolve('bench/threshold/cycle1-100');
assert(!existsSync(resolve(output, 'manifest.json')), 'never overwrite a frozen selection');
const oldBytes = readFileSync(new URL('./cycle1/manifest.json', import.meta.url)), old = JSON.parse(oldBytes);
const db = JSON.parse(readFileSync(new URL('./cycle1-setups.json', import.meta.url)));
const policy = {
  version: 1, total: 100, retainPrevious: 20, additional: 80, maxPerMirrorGroup: 3,
  sourceCaptureRun: '37035704246', sourceCaptureAttempt: '1', previousManifestHash: sha256(oldBytes),
  rule: 'Retain the exact previous 20 bytes/K/seeds. Build 41 group pools from all proved capture rows; rank within group by K-F descending, levels descending, n descending, rows descending, lexical ID. Round-robin groups sorted by occupied(24,12,16), then lexical mirror group. Limit 3 matrices per board/mirror group including previous20. Exclude already selected IDs. No performance/completion observations are read.',
};
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(resolve(dir, e.name)) : e.name === 'capture.json' ? [resolve(dir, e.name)] : []); }
const reports = walk(input).map(path => ({ path, ...JSON.parse(readFileSync(path)) }));
assert.equal(reports.length, 45); assert.equal(new Set(reports.map(r => r.setupId)).size, 45);
const candidates = [];
for (const report of reports) {
  assert.equal(report.runId, policy.sourceCaptureRun); assert.equal(report.runAttempt, policy.sourceCaptureAttempt);
  assert.equal(report.buildHash, reports[0].buildHash);
  assert.equal(report.databaseHash, old.databaseHash); assert.equal(report.baseline, BASELINE_SHA);
  const setup = db.setups.find(s => s.id === report.setupId); assert(setup);
  for (const record of report.records.filter(r => r.status === 'PROVED')) {
    const source = resolve(dirname(report.path), record.file), gzip = readFileSync(source), bytes = gunzipSync(gzip);
    assert.equal(sha256(gzip), record.compressedSha256); assert.equal(sha256(bytes), record.sha256);
    const matrix = JSON.parse(bytes); validateMatrix(matrix);
    assert.equal(matrix.sourceFumen, setup.fumen); assert.equal(matrix.pattern, setup.pattern);
    assert.equal(matrix.databaseHash, old.databaseHash); assert.equal(matrix.K, record.K);
    assert.deepEqual(matrix.seed, record.seed);
    const F = new Set(matrix.rows.filter(r => new Set(r.map(x => x[0])).size === 1).map(r => r[0][0])).size;
    candidates.push({ id: matrix.id, setupId: setup.id, filter: matrix.filter, mirrorGroup: setup.mirrorGroup,
      occupied: setup.occupied, n: matrix.keys.length, K: matrix.K, F, rows: matrix.rows.length,
      qualityLevels: new Set(matrix.rows.flatMap(r => r.map(x => x[1]))).size, source, record });
  }
}
assert.equal(candidates.length, 315); assert.equal(new Set(candidates.map(c => c.id)).size, 315);
const selected = old.cases.map(c => {
  const candidate = candidates.find(x => x.id === c.id); assert(candidate);
  assert.equal(candidate.record.sha256, c.sha256); assert.deepEqual(candidate.record.seed, c.seedIds);
  return { ...candidate, suite: c.suite, cohort: 'previous20' };
});
const used = new Set(selected.map(c => c.id)), counts = new Map();
for (const c of selected) counts.set(c.mirrorGroup, (counts.get(c.mirrorGroup) ?? 0) + 1);
const rank = (a, b) => (b.K - b.F) - (a.K - a.F) || b.qualityLevels - a.qualityLevels
  || b.n - a.n || b.rows - a.rows || a.id.localeCompare(b.id, 'en');
const pools = [...new Set(candidates.map(c => c.mirrorGroup))].map(group => ({ group,
  occupied: candidates.find(c => c.mirrorGroup === group).occupied,
  cases: candidates.filter(c => c.mirrorGroup === group).sort(rank) }));
pools.sort((a, b) => [24, 12, 16].indexOf(a.occupied) - [24, 12, 16].indexOf(b.occupied)
  || a.group.localeCompare(b.group, 'en'));
let progress = true;
while (selected.length < 100 && progress) {
  progress = false;
  for (const pool of pools) {
    if ((counts.get(pool.group) ?? 0) >= 3) continue;
    const next = pool.cases.find(c => !used.has(c.id) && c.n > c.K && c.qualityLevels > 1);
    if (!next) continue;
    selected.push({ ...next, suite: 'expansion', cohort: 'additional80' }); used.add(next.id);
    counts.set(pool.group, (counts.get(pool.group) ?? 0) + 1); progress = true;
    if (selected.length === 100) break;
  }
}
assert.equal(selected.length, 100); assert.equal(new Set(selected.map(c => c.mirrorGroup)).size, 41);
assert([...counts.values()].every(n => n <= 3));
mkdirSync(resolve(output, 'inputs'), { recursive: true });
const cases = selected.map(c => {
  const file = `inputs/${c.id}.json.gz`; copyFileSync(c.source, resolve(output, file));
  const { source, record, ...info } = c;
  return { ...info, file, sha256: record.sha256, compressedSha256: record.compressedSha256,
    seedIds: record.seed, primaryBackend: record.primaryBackend, primaryStatus: record.primaryStatus,
    KProofSource: 'Actions original enumeration + exact primary kernel/HiGHS optimum',
    captureRunId: policy.sourceCaptureRun };
});
writeFileSync(resolve(output, 'selection-policy.json'), JSON.stringify(policy, null, 2) + '\n', { flag: 'wx' });
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ version: 1, dataset: 'cycle1-expanded100',
  baseline: BASELINE_SHA, databaseHash: old.databaseHash, elements: old.elements, policy,
  cases, smoke: old.smoke, factorial: old.factorial, audit: old.audit,
  note: '12 development + 8 previously evaluated validation + 80 structural expansion matrices. 100 matrices span 41 mirror groups, not 100 independent boards. Expansion may share groups with previous20; it is not a fresh untouched holdout.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ total: cases.length, groups: counts.size,
  cohorts: cases.reduce((acc, c) => (acc[c.suite] = (acc[c.suite] ?? 0) + 1, acc), {}),
  occupied: cases.reduce((acc, c) => (acc[c.occupied] = (acc[c.occupied] ?? 0) + 1, acc), {}),
  compressedBytes: cases.reduce((sum, c) => sum + readFileSync(resolve(output, c.file)).length, 0) }, null, 2));
