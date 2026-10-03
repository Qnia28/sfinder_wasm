import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BASELINE_SHA, ELEMENTS, sha256, validateMatrix } from './engine.mjs';
const input = resolve(process.argv[2] || 'bench/threshold/results/qb-captures');
const output = resolve('bench/threshold/qb100'); mkdirSync(resolve(output, 'inputs'), { recursive: true });
const dbBytes = readFileSync(new URL('./qb-setups.json', import.meta.url)), db = JSON.parse(dbBytes);
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(dir, e.name))
  : e.name === 'capture.json' ? [resolve(dir, e.name)] : []); }
const reports = walk(input).map(path => ({ path, ...JSON.parse(readFileSync(path)) }));
assert.equal(reports.length, 100); assert.equal(new Set(reports.map(r => r.setupId)).size, 100);
const build = JSON.parse(readFileSync(new URL('./build/build.json', import.meta.url)));
const buildHash = sha256(readFileSync(new URL('./build/build.json', import.meta.url)));
const legalHash = sha256(readFileSync(new URL('../../wasm/legal_boards_4.lgb', import.meta.url)));
const cases = [], failures = [];
for (const s of db.setups) {
  const report = reports.find(r => r.setupId === s.id); assert(report);
  assert.equal(report.baseline, BASELINE_SHA); assert.equal(report.databaseHash, db.sourceSha256);
  assert.equal(report.buildHash, buildHash); assert.equal(report.runId, process.env.GITHUB_RUN_ID);
  const proved = report.records.filter(r => r.status === 'PROVED'); assert(proved.length <= 1);
  if (!proved.length) { failures.push({ setupId: s.id, enumerationStatus: report.enumerationStatus, records: report.records }); continue; }
  const r = proved[0], source = resolve(dirname(report.path), r.file), gzip = readFileSync(source), bytes = gunzipSync(gzip);
  assert.equal(sha256(bytes), r.sha256); assert.equal(sha256(gzip), r.compressedSha256);
  const matrix = JSON.parse(bytes); validateMatrix(matrix);
  assert.equal(matrix.id, `${s.id}-${r.filter}`); assert.equal(matrix.setupId, s.id);
  assert.equal(matrix.filter, r.filter); assert.equal(matrix.K, r.K); assert.deepEqual(matrix.seed, r.seed);
  assert.equal(matrix.legalHash, legalHash); assert.equal(matrix.totalCases, 840);
  assert.equal(matrix.primaryStatus, r.primaryStatus); assert.equal(matrix.primaryBackend, r.primaryBackend);
  assert(['Optimal', 'EXACT_KERNEL'].includes(r.primaryStatus));
  assert.equal(r.objective + (r.primaryBackend === 'highs' ? r.kernel.F : 0), matrix.K);
  const raw = JSON.parse(gunzipSync(readFileSync(resolve(dirname(report.path), `${r.filter}.raw.json.gz`))));
  for (const [key, value] of Object.entries(raw)) assert.deepEqual(matrix[key], value);
  assert.equal(matrix.sourceFumen, s.fumen); assert.equal(matrix.pattern, s.pattern);
  assert.equal(matrix.snapshotHash, sha256(dbBytes)); assert.equal(matrix.databaseHash, db.sourceSha256);
  assert.equal(matrix.enumerationWasmHash, build.hashes.original);
  const enumeration = JSON.parse(readFileSync(resolve(dirname(report.path), 'enumeration.json')));
  const selected = enumeration.records.find(x => x.status === 'ENUMERATED'); assert(selected);
  assert.deepEqual(enumeration.setup, s);
  assert.equal(selected.n, matrix.keys.length); assert.equal(selected.rows, matrix.rows.length);
  assert.equal(r.filter, selected.filter);
  for (const earlier of s.filters.slice(0, s.filters.indexOf(r.filter))) {
    assert(enumeration.records.some(x => x.filter === earlier && x.status === 'NO_MINIMAL'));
  }
  const file = `inputs/${matrix.id}.json.gz`; copyFileSync(source, resolve(output, file));
  cases.push({ id: matrix.id, setupId: s.id, filter: r.filter, suite: 'validation', cohort: 'independent-qb',
    mirrorGroup: s.mirrorGroup, occupied: s.occupied, n: matrix.keys.length, rows: matrix.rows.length, K: matrix.K,
    F: new Set(matrix.rows.filter(row => new Set(row.map(([id]) => id)).size === 1).map(row => row[0][0])).size,
    qualityLevels: new Set(matrix.rows.flatMap(row => row.map(([, q]) => q))).size,
    file, sha256: r.sha256, compressedSha256: r.compressedSha256, seedIds: r.seed,
    primaryStatus: r.primaryStatus, primaryBackend: r.primaryBackend, primaryMs: r.primaryMs,
    sourcePattern: matrix.pattern, captureRunId: report.runId });
}
const manifest = { version: 1, dataset: db.dataset, baseline: BASELINE_SHA, databaseHash: db.sourceSha256,
  policyHash: db.policySha256, snapshotHash: sha256(dbBytes), seed: db.seed, sampling: db.sampling,
  elements: ELEMENTS, requestedSetups: 100, cases, generationFailures: failures,
  smoke: cases.slice(0, 2).map(c => c.id), factorial: cases.slice(0, 6).map(c => c.id) };
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
const plan = { enabled: cases.length > 0, matrix: { case: cases.map(c => c.id) }, proved: cases.length, failures: failures.length };
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) for (const [key, val] of Object.entries(plan)) {
  writeFileSync(process.env.GITHUB_OUTPUT, `${key}=${typeof val === 'object' ? JSON.stringify(val) : val}\n`, { flag: 'a' });
}
