import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BASELINE_SHA, ELEMENTS, sha256, validateMatrix } from './engine.mjs';
const input = resolve(process.argv[2]), output = resolve(process.argv[3] || 'bench/threshold/cycle1');
assert(!existsSync(resolve(output, 'manifest.json')), 'selection is frozen; never overwrite it');
const db = JSON.parse(readFileSync(new URL('./cycle1-setups.json', import.meta.url)));
const policyBytes = readFileSync(new URL('./selection-policy.json', import.meta.url)), policy = JSON.parse(policyBytes);
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(resolve(dir, e.name)) : e.name === 'capture.json' ? [resolve(dir, e.name)] : []); }
const reports = walk(input).map(path => ({ path, ...JSON.parse(readFileSync(path)) }));
assert.equal(new Set(reports.map(r => r.setupId)).size, reports.length, 'duplicate capture setup');
assert(reports.length > 0, 'no captures');
for (const r of reports) {
  assert.equal(r.runId, reports[0].runId, 'mixed capture runs');
  assert.equal(r.runAttempt, reports[0].runAttempt, 'mixed capture attempts');
  assert.equal(r.buildHash, reports[0].buildHash, 'mixed capture builds');
}
const candidates = [], audit = [];
for (const report of reports) {
  assert.equal(report.databaseHash, db.sourceSha256);
  assert.equal(report.baseline, BASELINE_SHA);
  const setup = db.setups.find(s => s.id === report.setupId); assert(setup);
  audit.push({ setupId: setup.id, enumerationStatus: report.enumerationStatus,
    records: report.records.map(r => ({ filter: r.filter, status: r.status })) });
  for (const record of report.records.filter(r => r.status === 'PROVED')) {
    const source = resolve(dirname(report.path), record.file), gzip = readFileSync(source), bytes = gunzipSync(gzip);
    assert.equal(sha256(gzip), record.compressedSha256); assert.equal(sha256(bytes), record.sha256);
    const matrix = JSON.parse(bytes); validateMatrix(matrix);
    assert.equal(matrix.sourceFumen, setup.fumen); assert.equal(matrix.pattern, setup.pattern);
    assert.equal(matrix.databaseHash, db.sourceSha256);
    assert.equal(matrix.K, record.K); assert.deepEqual(matrix.seed, record.seed);
    const F = new Set(matrix.rows.filter(r => new Set(r.map(x => x[0])).size === 1).map(r => r[0][0])).size;
    const c = { id: matrix.id, setupId: setup.id, filter: matrix.filter, mirrorGroup: setup.mirrorGroup,
      occupied: setup.occupied, n: matrix.keys.length, K: matrix.K, F, rows: matrix.rows.length,
      qualityLevels: new Set(matrix.rows.flatMap(r => r.map(x => x[1]))).size, source, record };
    if (c.n > c.K && c.qualityLevels > 1) candidates.push(c);
  }
}
const rank = (a, b) => (b.K - b.F) - (a.K - a.F) || b.qualityLevels - a.qualityLevels ||
  b.n - a.n || b.rows - a.rows || a.id.localeCompare(b.id, 'en');
const validationGroups = new Set(policy.validation.map(s => s.mirrorGroup));
const selected = [], missing = [];
for (const slot of policy.validation) {
  const best = candidates.filter(c => c.mirrorGroup === slot.mirrorGroup).sort(rank)[0];
  if (best) selected.push({ ...best, suite: 'validation' }); else missing.push(slot);
}
const used = new Set(validationGroups);
const pools = [24, 12, 16].map(occupied => candidates.filter(c => c.occupied === occupied
  && !validationGroups.has(c.mirrorGroup)).sort(rank));
let progress = true;
while (selected.filter(c => c.suite === 'development').length < policy.developmentCount && progress) {
  progress = false;
  for (const pool of pools) {
    const best = pool.find(c => !used.has(c.mirrorGroup));
    if (!best) continue;
    used.add(best.mirrorGroup); selected.push({ ...best, suite: 'development' }); progress = true;
    if (selected.filter(c => c.suite === 'development').length === policy.developmentCount) break;
  }
}
const missingSetups = db.setups.filter(s => !reports.some(r => r.setupId === s.id)).map(s => s.id);
assert.equal(missingSetups.length, 0, 'full capture must have a report for every setup, including timeouts');
mkdirSync(resolve(output, 'inputs'), { recursive: true });
const cases = selected.map(c => {
  const file = `inputs/${c.id}.json.gz`; copyFileSync(c.source, resolve(output, file));
  const { source, record, ...info } = c;
  return { ...info, file, sha256: record.sha256, compressedSha256: record.compressedSha256,
    seedIds: record.seed, primaryBackend: record.primaryBackend, primaryStatus: record.primaryStatus,
    KProofSource: 'Actions original enumeration + exact primary kernel/HiGHS optimum', captureRunId: reports[0].runId };
});
const development = cases.filter(c => c.suite === 'development');
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ version: 1, dataset: 'cycle1-database',
  baseline: BASELINE_SHA, databaseHash: db.sourceSha256, selectionPolicyHash: sha256(policyBytes), elements: ELEMENTS,
  cases, smoke: development.slice(0, 2).map(c => c.id), factorial: development.slice(0, 6).map(c => c.id),
  missingValidation: missing, audit }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ development: development.length, validation: cases.length - development.length,
  missingValidation: missing, reports: reports.length, eligibleMatrices: candidates.length,
  proved: reports.reduce((n, r) => n + r.records.filter(c => c.status === 'PROVED').length, 0), cases }, null, 2));
if (missing.length || development.length < policy.developmentCount) process.exitCode = 1;
