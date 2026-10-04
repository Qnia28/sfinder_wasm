import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { sha256 } from './engine.mjs';
const [buildPath, jobsPath, output] = process.argv.slice(2); assert(buildPath && jobsPath && output);
const build = JSON.parse(readFileSync(buildPath)); assert.equal(build.dirty, '');
const jobs = JSON.parse(readFileSync(jobsPath));
function git(args, encoding = null) {
  const result = spawnSync('git', args, { encoding, maxBuffer: 64 * 1024 * 1024 }); assert.equal(result.status, 0, String(result.stderr)); return result.stdout;
}
const checked = [];
for (const [name, revision] of [['devRust', build.baseline], ['referenceRust', build.reference], ['candidateRust', build.candidate], ['productJs', build.candidate], ['harness', build.candidate]]) {
  const prefix = name === 'productJs' ? 'src/' : name === 'harness' ? 'bench/threshold-integration/' : 'rust/';
  const tree = git(['ls-tree', '-r', '-z', revision, '--', prefix], 'utf8').split('\0').filter(Boolean)
    .map(line => { const [info, path] = line.split('\t'); return { hash: info.split(' ')[2], path }; })
    .filter(({ path }) => !path.split('/').some(p => ['target', 'build', 'results', 'generated'].includes(p)));
  assert.deepEqual(tree.map(e => e.path).sort(), Object.keys(build.sources[name]).sort(), `${name} source set differs from Git`);
  for (const e of tree) { const digest = sha256(git(['cat-file', 'blob', e.hash])); assert.equal(digest, build.sources[name][e.path], `${revision}:${e.path}`); }
  assert.equal(sha256(JSON.stringify(build.sources[name])), build.sourceDigest[name]);
  checked.push({ name, revision, blobs: tree.length, digest: build.sourceDigest[name] });
}
// Product JS is not changed by this preparation branch.
assert.equal(git(['diff', '--name-only', build.baseline, build.candidate, '--', 'src', 'rust/pc-wasm/src', 'scripts/build-wasm.sh'], 'utf8').trim(), '');
const unique = new Map(); for (const job of jobs.jobs || jobs) { assert(!unique.has(job.id)); unique.set(job.id, job); }
const list = [...unique.values()]; assert(list.every(job => ['success', 'skipped'].includes(job.conclusion)), 'Actions job failed or incomplete');
const concurrency = {};
for (const phase of ['benchmark', 'recheck']) {
  const selected = list.filter(j => j.name.startsWith(`${phase} (`));
  const events = selected.flatMap(j => [{ t: Date.parse(j.started_at), delta: 1 }, { t: Date.parse(j.completed_at), delta: -1 }])
    .sort((a, b) => a.t - b.t || a.delta - b.delta);
  let active = 0, peak = 0; for (const e of events) { active += e.delta; peak = Math.max(peak, active); }
  assert(peak <= 10); assert.equal(active, 0); concurrency[phase] = { jobs: selected.length, peak };
}
assert.equal(concurrency.benchmark.jobs, 32);
const receipt = { candidate: build.candidate, sourceMaps: checked, immutableBlobs: checked.reduce((sum, e) => sum + e.blobs, 0),
  productJsAndWasmWrappersUnchanged: true, jobs: list.map(({ id, name, conclusion, started_at, completed_at }) => ({ id, name, conclusion, started_at, completed_at })),
  concurrency, runId: process.env.GITHUB_RUN_ID, jobFileHash: sha256(readFileSync(jobsPath)), buildHash: sha256(readFileSync(buildPath)) };
writeFileSync(resolve(output), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ immutableBlobs: receipt.immutableBlobs, concurrency }, null, 2));
