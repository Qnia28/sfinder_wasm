import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { BASELINE_SHA, sha256 } from './engine.mjs';

const out = resolve('bench/threshold/build');
mkdirSync(out, { recursive: true });
const cargo = process.env.CARGO || 'cargo';
function run(command, args, cwd = process.cwd(), env = process.env) {
  const r = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${command} failed: ${r.error ?? r.status}`);
}
// Archive only Rust sources from the pinned ancestor. No checkout/switch/reset of
// the developer's working tree, and no access to the read-only dev repository.
const original = resolve(out, 'baseline-source');
if (!existsSync(resolve(original, 'rust/Cargo.toml'))) {
  mkdirSync(original, { recursive: true });
  run('git', ['archive', '--format=tar', `--output=${resolve(out, 'baseline.tar')}`, BASELINE_SHA, 'rust']);
  run('tar', ['-xf', resolve(out, 'baseline.tar'), '-C', original]);
}
const variants = [
  { name: 'original', root: original, features: [] },
  { name: 'production', root: process.cwd(), features: [] },
  { name: 'experiment', root: process.cwd(), features: ['threshold-experiment'] },
  { name: 'trace', root: process.cwd(), features: ['threshold-trace'] },
];
const hashes = {};
for (const variant of variants) {
  const target = resolve(out, 'target', variant.name);
  run(cargo, ['build', '--manifest-path', resolve(variant.root, 'rust/Cargo.toml'), '-p', 'pc-wasm',
    '--release', '--target', 'wasm32-unknown-unknown', '--offline',
    ...(variant.features.length ? ['--features', variant.features.join(',')] : [])],
  variant.root, { ...process.env, CARGO_TARGET_DIR: target });
  const wasm = resolve(out, `${variant.name}.wasm`);
  copyFileSync(resolve(target, 'wasm32-unknown-unknown/release/pc_wasm.wasm'), wasm);
  hashes[variant.name] = sha256(readFileSync(wasm));
}
const capture = (command, args) => {
  const r = spawnSync(command, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${command}: ${r.stderr || r.error}`);
  return r.stdout.trim();
};
function sourceHashes(root, directory) {
  function walk(dir) {
    return readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
      if (['target','generated','build','results'].includes(entry.name)) return [];
      const path = resolve(dir,entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  }
  return Object.fromEntries(walk(resolve(root,directory)).map(path=>[relative(root,path).replaceAll('\\','/'),
    sha256(readFileSync(path))]).sort(([a],[b])=>a<b?-1:a>b?1:0));
}
const sources = { originalRust: sourceHashes(original,'rust'), candidateRust: sourceHashes(process.cwd(),'rust'),
  candidateJs: sourceHashes(process.cwd(),'src'), harness: sourceHashes(process.cwd(),'bench/threshold') };
const sourceDigest = Object.fromEntries(Object.entries(sources).map(([name, map])=>[name,sha256(JSON.stringify(map))]));
writeFileSync(resolve(out, 'build.json'), JSON.stringify({ baseline: BASELINE_SHA,
  baselineSrcTree: capture('git', ['rev-parse', `${BASELINE_SHA}:src`]),
  candidate: capture('git', ['rev-parse', 'HEAD']), dirty: capture('git', ['status', '--porcelain']),
  node: process.version, cargo: capture(cargo, ['--version']),
  rustc: capture(process.env.RUSTC || 'rustc', ['--version']),
  target: 'wasm32-unknown-unknown', profile: 'release', rustflags: process.env.RUSTFLAGS ?? '',
  hashes, sourceDigest, sources }, null, 2));
console.log(JSON.stringify(hashes, null, 2));
