import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { hash, writeJson } from './contracts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [output] = process.argv.slice(2);
if (!output) throw new Error('usage: source-lock.mjs <new-output.json>');
const files = {};
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const name = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('source lock refuses junction/symlink: ' + name);
    if (entry.isDirectory()) { if (!['target', 'generated', 'node_modules', 'results'].includes(entry.name)) walk(name); }
    else if (!name.endsWith('.log')) files[name] = hash(fs.readFileSync(path.join(root, name)));
  }
}
for (const directory of ['src', 'wasm', 'rust/pc-core', 'rust/pc-wasm', 'tools/secondary-bench']) walk(directory);
for (const name of ['.gitattributes', 'package.json', 'package-lock.json', '.github/workflows/secondary-bench-preflight.yml', '.github/workflows/secondary-bench-wave.yml', '.github/workflows/secondary-bench-campaign.yml', '.github/workflows/secondary-bench-extended.yml',
  'tests/secondary-bench.test.mjs', 'tests/secondary-bench-campaign.test.mjs', 'tests/helpers/secondary-bench-stall.mjs', 'tests/helpers/secondary-bench-startup-stall.mjs']) files[name] = hash(fs.readFileSync(path.join(root, name)));
writeJson(output, { schema: 1, baselineCommit: '7ef62d18e1d155b6479e00d651c851ff3baa7112',
  workingHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, v8: process.versions.v8, platform: process.platform, files });
console.log(JSON.stringify({ files: Object.keys(files).length, pcWasmSha256: files['wasm/pc_wasm.wasm'] }));
