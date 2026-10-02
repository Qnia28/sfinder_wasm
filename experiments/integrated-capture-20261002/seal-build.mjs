import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HERE, ROOT, read, write, sha, jsonSha } from './common.mjs';
const manifest = read(path.join(HERE, 'selection.json'));
for (const row of manifest.sources) {
  if (row.file !== 'wasm/pc_wasm.wasm' && sha(fs.readFileSync(path.join(ROOT, row.file))) !== row.sha256) throw new Error(`Source drift ${row.file}`);
}
for (const [file, hash] of Object.entries(manifest.databases)) {
  if (sha(fs.readFileSync(path.join(HERE, 'inputs', file))) !== hash) throw new Error(`DB drift ${file}`);
}
const directory = path.join(ROOT, '.capture', 'build');
fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'wasm/pc_wasm.wasm'), path.join(directory, 'pc_wasm.wasm'));
write(path.join(directory, 'BUILD.json'), { schema: 'integrated-capture-build-v1',
  baselineCommit: manifest.baselineCommit, ciCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceManifestSha256: jsonSha(manifest.sources), selectionSha256: jsonSha(manifest),
  wasmSha256: sha(fs.readFileSync(path.join(directory, 'pc_wasm.wasm'))),
  node: process.version, rust: execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim(),
  secondaryAllowed: false, benchmarksAllowed: false });
console.log('Build/source/DB provenance verified. No secondary execution.');
