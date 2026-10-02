import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, DIR, STAGE, config, gitFile, hash, readJson, writeJson, filesUnder, assertArtifactBudget } from './common.mjs';

const mode = process.argv[2] ?? 'sources';
fs.mkdirSync(STAGE, { recursive: true });
const baseline = path.join(STAGE, 'baseline');
if (mode === 'sources') {
  // Only tracked files from immutable commits: no local node_modules, targets,
  // user files or build caches enter a variant or an uploaded artifact.
  const list = execFileSync('git', ['ls-tree', '-r', '--name-only', config.baseline, '--', 'src', 'wasm', 'rust', 'tests', 'package.json', 'package-lock.json'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  for (const file of list) {
    const destination = path.join(baseline, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, gitFile(config.baseline, file));
  }
  const memoSnapshot = gitFile(config.a4, 'src/saves.mjs').toString('utf8').split('// Diagnostic snapshots')[1].split('export const tetrisSort')[0];
  const a4Ref = gitFile(config.a5, 'src/saves.mjs').toString('utf8')
    .replace('const bagInfoCache=new Map();', 'const bagInfoCache=new Map();\nconst predicateMemos=new WeakMap();')
    .replace('  exactExpressionPredicates.set(expression,predicate);', '  predicateMemos.set(predicate,cache);\n  exactExpressionPredicates.set(expression,predicate);')
    + '\n// Diagnostic snapshots' + memoSnapshot;
  const variants = {};
  for (const name of ['REF', 'P', 'R', 'M', 'A5', 'A4_REF', 'A4', 'A6']) {
    const directory = path.join(STAGE, name);
    for (const sub of ['src', 'wasm', 'tests']) fs.cpSync(path.join(baseline, sub), path.join(directory, sub), { recursive: true });
    for (const file of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(baseline, file), path.join(directory, file));
    const overlay = (ref, file) => fs.writeFileSync(path.join(directory, file), gitFile(ref, file));
    if (['P', 'R', 'M'].includes(name)) {
      overlay(config.b4, 'src/saves-feature.mjs'); overlay(config.b4, 'src/pc-wasm-enumeration.mjs'); overlay(config.a5, 'src/saves.mjs');
    }
    if (name === 'A5' || name === 'A4_REF') overlay(config.a5, 'src/saves.mjs');
    if (name === 'A4_REF') fs.writeFileSync(path.join(directory, 'src/saves.mjs'), a4Ref);
    if (name === 'A4') overlay(config.a4, 'src/saves.mjs');
    if (name === 'A6') overlay(config.a6, 'src/saves-feature.mjs');
    const sourceFiles = filesUnder(path.join(directory, 'src'));
    variants[name] = {
      sourceTree: hash(Buffer.concat(sourceFiles.flatMap(file => [Buffer.from(path.relative(directory, file).replaceAll('\\', '/') + '\0'), fs.readFileSync(file)]))),
      files: Object.fromEntries(['src/saves-feature.mjs', 'src/saves.mjs', 'src/pc-wasm-enumeration.mjs', 'wasm/legal_boards_4.lgb'].map(file => [file, hash(fs.readFileSync(path.join(directory, file)))])),
      wasm: ['R', 'M'].includes(name) ? 'PENDING_BUILD' : hash(fs.readFileSync(path.join(directory, 'wasm/pc_wasm.wasm'))),
    };
  }
  for (const [file, name] of [['saves-contract-delta.test.mjs', 'A5'], ['saves-cache-bounds.test.mjs', 'A4'], ['saves-direct-mask.test.mjs', 'M']])
    fs.copyFileSync(path.join(ROOT, 'tests', file), path.join(STAGE, name, 'tests', file));
  writeJson(path.join(STAGE, 'variants.json'), variants);
  console.log('Prepared independent immutable source variants; no solver called.');
} else if (mode === 'build') {
  const artifact = path.join(STAGE, 'artifacts/build'); fs.mkdirSync(artifact, { recursive: true });
  for (const [name, ref] of [['R', config.baseline], ['M', config.b4]]) {
    const rust = path.join(STAGE, `rust-${name}`);
    const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'rust'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
    for (const file of files) { const destination = path.join(rust, file.slice(5)); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, gitFile(ref, file)); }
    execFileSync('cargo', ['build', '--manifest-path', path.join(rust, 'Cargo.toml'), '-p', 'pc-wasm', '--release', '--target', 'wasm32-unknown-unknown', '--offline', '--locked', '--target-dir', path.join(STAGE, `target-${name}`)], { cwd: ROOT, stdio: 'inherit' });
    fs.copyFileSync(path.join(STAGE, `target-${name}/wasm32-unknown-unknown/release/pc_wasm.wasm`), path.join(artifact, `${name}.wasm`));
  }
  const sourceVariants = readJson(path.join(STAGE, 'variants.json'));
  const seal = { node: process.version, rust: execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim(),
    cargo: execFileSync('cargo', ['--version'], { encoding: 'utf8' }).trim(), variants: sourceVariants,
    wasm: Object.fromEntries(['R', 'M'].map(name => [name, hash(fs.readFileSync(path.join(artifact, `${name}.wasm`)))])),
    design: hash(fs.readFileSync(path.join(DIR, 'design-seal.json'))), config: hash(fs.readFileSync(path.join(DIR, 'config.json'))),
    lock: hash(gitFile(config.baseline, 'rust/Cargo.lock')) };
  writeJson(path.join(artifact, 'BUILD_SEAL.json'), seal);
  console.log(JSON.stringify(assertArtifactBudget(artifact)));
} else if (mode === 'attach') {
  const artifact = path.resolve(process.argv[3] ?? path.join(STAGE, 'artifacts/build'));
  const seal = readJson(path.join(artifact, 'BUILD_SEAL.json')), variants = readJson(path.join(STAGE, 'variants.json'));
  assert.equal(seal.config, hash(fs.readFileSync(path.join(DIR, 'config.json'))));
  assert.equal(seal.design, hash(fs.readFileSync(path.join(DIR, 'design-seal.json'))));
  assert.deepEqual(seal.variants, variants);
  for (const name of ['R', 'M']) {
    const bytes = fs.readFileSync(path.join(artifact, `${name}.wasm`)); assert.equal(hash(bytes), seal.wasm[name]);
    fs.writeFileSync(path.join(STAGE, name, 'wasm/pc_wasm.wasm'), bytes); variants[name].wasm = hash(bytes);
  }
  writeJson(path.join(STAGE, 'variants-attached.json'), variants);
  writeJson(path.join(STAGE, 'BUILD_SEAL.json'), seal);
  console.log('Verified and attached shared build artifacts.');
} else throw new Error(`Unknown preparation mode ${mode}`);
