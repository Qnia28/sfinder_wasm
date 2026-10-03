import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const runId = process.argv[2]; assert(/^\d+$/.test(runId));
const root = resolve(`bench/threshold/results/remote-qb-${runId}`);
function run(args) {
  const r = spawnSync('gh', args, { stdio: 'inherit' }); assert.equal(r.status, 0, `gh ${args.join(' ')} failed`);
}
assert(!existsSync(root), 'never overwrite downloaded/audited raw artifacts');
mkdirSync(root, { recursive: true });
for (const [label, pattern] of [
  ['build', `qb-build-${runId}-1`], ['fixtures', `qb-fixtures-${runId}-1`], ['final', `qb-final-${runId}-1`],
  ['capture', `qb-capture-*-${runId}-1`], ['bench', `qb-bench-*-${runId}-1`],
]) run(['run', 'download', runId, '--pattern', pattern, '--dir', resolve(root, label)]);
function walk(dir, name) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(resolve(dir, e.name), name) : e.name === name ? [resolve(dir, e.name)] : []); }
const reviews = walk(resolve(root, 'final'), 'review.json').map(path => ({ path, ...JSON.parse(readFileSync(path)) }));
assert(reviews.some(r => r.pairs === 3));
if (reviews.some(r => r.pairs === 10)) run(['run', 'download', runId, '--pattern', `qb-recheck-*-${runId}-1`, '--dir', resolve(root, 'recheck')]);
console.log(JSON.stringify({ root, reviews: reviews.map(r => ({ path: r.path, pairs: r.pairs, matrices: r.auditedMatrices })) }, null, 2));
