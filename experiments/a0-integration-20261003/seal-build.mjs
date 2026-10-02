import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { HERE, ROOT, read, write, sha, jsonSha } from './common.mjs';
const baseline = 'c0cb2a048e7275bfea587d176b1954efff0a8a08';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const sourceNames = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, '--', 'src', 'rust', 'package.json', 'package-lock.json'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
const changed = [], sources = sourceNames.map(file => {
  const bytes = fs.readFileSync(path.join(ROOT, file)), old = execFileSync('git', ['show', `${baseline}:${file}`], { cwd: ROOT, maxBuffer: 32 * 2 ** 20 });
  if (sha(bytes) !== sha(old)) changed.push(file);
  return { file, sha256: sha(bytes), baselineSha256: sha(old) };
});
assert.deepEqual(changed, ['src/min-cover-exact-secondary.mjs']);
const oldSecondary = execFileSync('git', ['show', `${baseline}:src/min-cover-exact-secondary.mjs`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(fs.readFileSync(path.join(ROOT, 'src/min-cover-exact-secondary.mjs'), 'utf8'), oldSecondary.replace('qualityFor, seedKeys: primaryKeys, stateBudget: FAST_EXACT_STATE_BUDGET, integrated: true,', "qualityFor, seedKeys: primaryKeys, stateBudget: FAST_EXACT_STATE_BUDGET, integrated: true,\n        partitioned: decomposition === 'off',"));
const wasm = fs.readFileSync(path.join(ROOT, 'wasm/pc_wasm.wasm')), expected = read(path.join(HERE, 'SCOPE.json')).expectedBaselineRebuildHash;
assert.equal(sha(wasm), expected, 'Must reproduce previously validated Linux baseline native implementation');
const exports = WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(e => e.name);
assert(exports.includes('solver_min_cover_at_count_integrated_partitioned_bounded'));
assert(!exports.some(e => e.startsWith('solver_bench_')));
for (const pack of read(path.join(HERE, 'INPUTS.json')).packs) assert.equal(sha(fs.readFileSync(path.join(HERE, pack.file))), pack.sha256);
const out = path.join(ROOT, '.a0/build'); fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'wasm/pc_wasm.wasm'), path.join(out, 'pc_wasm.wasm'));
const originalBinary = execFileSync('git', ['show', `${baseline}:wasm/pc_wasm.wasm`], { cwd: ROOT, maxBuffer: 32 * 2 ** 20 });
fs.writeFileSync(path.join(out, 'original-product.wasm'), originalBinary, { flag: 'wx' });
const harness = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', 'experiments/a0-integration-20261003'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(f => f.endsWith('.mjs')).map(file => ({ file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) }));
const build = { schema: 'a0-product-connection-build-v1', baselineCommit: baseline, candidateCommit: commit, wasmSha256: sha(wasm), originalProductWasmSha256: sha(originalBinary),
  sourceFiles: sources, changedProductSources: changed, harnessSources: harness, wasmExports: exports, node: process.version,
  rust: execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim(), inputsSha256: jsonSha(read(path.join(HERE, 'INPUTS.json'))), scheduleSha256: jsonSha(read(path.join(HERE, 'SCHEDULE.json'))),
  nativeAlgorithmRevalidationReusedRun: 37016499665, nativeAlgorithmsChanged: false, actualInputPrimaryCalls: 0, actualInputPcCalls: 0, productApplied: false };
write(path.join(out, 'BUILD.json'), build);
console.log(JSON.stringify({ candidateCommit: commit, wasmSha256: build.wasmSha256, changedProductSources: changed, nativeAlgorithmsChanged: false }));
