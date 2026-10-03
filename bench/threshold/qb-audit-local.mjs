import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(process.argv[2]); assert(root);
function walk(dir, name) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(resolve(dir, e.name), name) : e.name === name ? [resolve(dir, e.name)] : []); }
function single(dir, name) { const files = walk(resolve(root, dir), name); assert.equal(files.length, 1); return files[0]; }
process.env.THRESHOLD_FIXTURE_ROOT = dirname(single('fixtures', 'manifest.json'));
process.env.THRESHOLD_BUILD_ROOT = dirname(single('build', 'build.json'));
const reports = walk(resolve(root, 'final'), 'review.json').map(path => ({ path, review: JSON.parse(readFileSync(path)) }));
const original = reports.find(r => r.review.pairs === 3); assert(original);
const repeated = reports.find(r => r.review.pairs === 10);
process.env.GITHUB_RUN_ID = original.review.runId; process.env.GITHUB_RUN_ATTEMPT = original.review.runAttempt;
const { audit } = await import('./qb-review.mjs');
const { manifest } = await import('./fixtures.mjs');
const selectionPath = resolve(dirname(original.path), 'selection.json');
const selection = JSON.parse(readFileSync(selectionPath));
const initial = audit(resolve(root, 'bench'), 3, manifest.cases.map(c => c.id));
function same(a, b) {
  for (const key of ['candidate', 'manifestHash', 'snapshotHash', 'databaseHash', 'policyHash', 'wasmHashes', 'sourceDigest',
    'requestedSamples', 'executedSamples', 'skippedSamples', 'exact', 'timeout', 'witnessHashes']) assert.deepEqual(a[key], b[key]);
  const sort = rows => [...rows].sort((a, b) => JSON.stringify([a.caseId, a.comparisonIndex, a.pair, a.side])
    .localeCompare(JSON.stringify([b.caseId, b.comparisonIndex, b.pair, b.side])));
  assert.deepEqual(sort(a.samples), sort(b.samples)); assert.deepEqual(sort(a.perCase), sort(b.perCase));
}
same(initial, original.review);
const output = resolve(root, 'audited'); mkdirSync(resolve(output, 'qb-review'), { recursive: true });
// Preserve the exact initial compact review/selection bytes and their linked
// hashes; the preceding audit compared every record against raw witnesses.
copyFileSync(original.path, resolve(output, 'qb-review/review.json'));
copyFileSync(selectionPath, resolve(output, 'qb-review/selection.json'));
if (repeated) {
  const review = audit(resolve(root, 'recheck'), 10, selection.cases, initial); same(review, repeated.review);
  mkdirSync(resolve(output, 'qb-recheck-review'), { recursive: true });
  copyFileSync(repeated.path, resolve(output, 'qb-recheck-review/review.json'));
  copyFileSync(resolve(dirname(repeated.path), 'selection.json'), resolve(output, 'qb-recheck-review/selection.json'));
} else assert.equal(selection.cases.length, 0);
const report = spawnSync(process.execPath, ['bench/threshold/qb-report.mjs'], {
  stdio: 'inherit', env: { ...process.env, THRESHOLD_QB_RESULTS: output } }); assert.equal(report.status, 0);
writeFileSync(resolve(output, 'local-audit.json'), JSON.stringify({ runId: initial.runId,
  audit: 'All downloaded initial/recheck raw samples and full original-row witnesses independently re-audited locally; compact remote reviews matched record-by-record. Local report also includes any newly flagged comparison in repeats.',
  samples: initial.executedSamples + (repeated?.review.executedSamples || 0), manifestHash: initial.manifestHash,
  wasmHash: initial.wasmHashes.experiment }, null, 2) + '\n', { flag: 'wx' });
console.log(`Local independent raw audit passed; report: ${resolve(output, 'qb-final/report.md')}`);
