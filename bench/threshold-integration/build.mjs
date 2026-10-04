import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { sha256 } from './engine.mjs';
const config = JSON.parse(readFileSync(new URL('./run.json', import.meta.url)));
const out = resolve('bench/threshold-integration/build'); mkdirSync(out, { recursive: true });
function run(command, args, cwd = process.cwd(), env = process.env) {
  const r = spawnSync(command, args, { cwd, env, stdio: 'inherit' }); assert.equal(r.status, 0, `${command}: ${r.error || r.status}`);
}
function text(command, args) { const r = spawnSync(command, args, { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
function archived(name, rev) {
  const root = resolve(out, name); if (!existsSync(resolve(root, 'rust/Cargo.toml'))) {
    mkdirSync(root, { recursive: true }); const tar = resolve(out, `${name}.tar`);
    run('git', ['archive', '--format=tar', `--output=${tar}`, rev, 'rust']); run('tar', ['-xf', tar, '-C', root]);
  } return root;
}
const original = archived('dev-source', config.baseline), reference = archived('reference-source', config.reference);
const modes = {
  D: { root: original, features: [] }, C: { root: process.cwd(), features: [] },
  A: { root: process.cwd(), features: ['threshold-current-propagation'] },
  B: { root: process.cwd(), features: ['threshold-current-propagation', 'threshold-root-forced'] },
  reference: { root: reference, features: ['threshold-experiment'] },
};
const hashes = {}, exports = {};
for (const [name, mode] of Object.entries(modes)) {
  const target = resolve(out, 'target', name);
  run(process.env.CARGO || 'cargo', ['build', '--manifest-path', resolve(mode.root, 'rust/Cargo.toml'), '-p', 'pc-wasm', '--release',
    '--target', 'wasm32-unknown-unknown', '--offline', ...(mode.features.length ? ['--features', mode.features.join(',')] : [])],
    mode.root, { ...process.env, CARGO_TARGET_DIR: target });
  const file = resolve(out, `${name}.wasm`); copyFileSync(resolve(target, 'wasm32-unknown-unknown/release/pc_wasm.wasm'), file);
  const bytes = readFileSync(file); hashes[name] = sha256(bytes);
  exports[name] = WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map(e => [e.name, e.kind]).sort();
  if (name !== 'reference') assert.deepEqual(exports[name], exports.D, 'product ABI export set changed');
}
// The tracked Dev asset predates four exports already present in Dev Rust.
// Preserve it separately; do not silently replace it or call its rebuild an optimization.
copyFileSync(resolve('wasm/pc_wasm.wasm'), resolve(out, 'S.wasm'));
const shipped = readFileSync(resolve(out, 'S.wasm')); hashes.S = sha256(shipped);
exports.S = WebAssembly.Module.exports(new WebAssembly.Module(shipped)).map(e => [e.name, e.kind]).sort();
for (const item of exports.S) assert(exports.D.some(e => e[0] === item[0] && e[1] === item[1]), 'rebuilt Dev removed a shipped export');
const inheritedDevSourceExports = exports.D.filter(([name]) => !exports.S.some(([n]) => n === name));
function sources(root, dir) {
  function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['target', 'build', 'results', 'generated'].includes(e.name)) return [];
    return e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)];
  }); }
  return Object.fromEntries(walk(resolve(root, dir)).map(p => [relative(root, p).replaceAll('\\', '/'), sha256(readFileSync(p))]).sort(([a], [b]) => a.localeCompare(b)));
}
const sourceMaps = { devRust: sources(original, 'rust'), candidateRust: sources(process.cwd(), 'rust'),
  referenceRust: sources(reference, 'rust'), productJs: sources(process.cwd(), 'src'), harness: sources(process.cwd(), 'bench/threshold-integration') };
const build = { baseline: config.baseline, reference: config.reference, candidate: text('git', ['rev-parse', 'HEAD']),
  dirty: text('git', ['status', '--porcelain']), node: process.version, rustc: text(process.env.RUSTC || 'rustc', ['--version']),
  modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, v.features])), hashes, exports, inheritedDevSourceExports,
  sources: sourceMaps, sourceDigest: Object.fromEntries(Object.entries(sourceMaps).map(([k, v]) => [k, sha256(JSON.stringify(v))])) };
writeFileSync(resolve(out, 'build.json'), JSON.stringify(build, null, 2) + '\n'); console.log(JSON.stringify(hashes, null, 2));
