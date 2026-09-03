import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { loadBatchWasm } from '../src/batch-backend.mjs';

// #8: every module under src/ can end up in a browser/Vite import graph, so a
// Node builtin must only be reached through a guarded dynamic import. A static
// `import ... from "node:x"` forces the bundler to resolve it at build time.
const STATIC_NODE_IMPORT = /(?:^|[\s;])(?:import|export)\s*(?:[^'"();]*?\bfrom\s*)?(['"])node:[^'"]*\1/g;

async function browserReachableSources(dir = 'src', out = []) {
  for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await browserReachableSources(path, out);
    else if (entry.name.endsWith('.mjs')) out.push(path);
  }
  return out;
}

test('no browser-reachable src module statically imports a node: builtin', async () => {
  const sources = await browserReachableSources();
  assert.ok(sources.length > 20, `expected the full src tree, saw ${sources.length} modules`);
  const offenders = [];
  for (const path of sources) {
    const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(STATIC_NODE_IMPORT)) offenders.push(`${path}: ${match[0].trim()}`);
  }
  assert.deepEqual(offenders, []);
});

test('the guard still detects a static node: import', () => {
  const samples = [
    `import fs from'node:fs';`,
    `import fs from "node:fs";`,
    `import { readFile } from 'node:fs/promises';`,
    `import 'node:process';`,
    `export { x } from 'node:util';`,
  ];
  for (const sample of samples) {
    assert.equal([...sample.matchAll(STATIC_NODE_IMPORT)].length, 1, sample);
  }
  const guarded = [
    `const moduleName='node:fs/promises';const{readFile}=await import(/* @vite-ignore */ moduleName);`,
    `await import("node:fs/promises");`,
  ];
  for (const sample of guarded) {
    assert.deepEqual([...sample.matchAll(STATIC_NODE_IMPORT)], [], sample);
  }
});

test('batch WASM still loads through the guarded Node branch', async () => {
  const exports = await loadBatchWasm();
  assert.equal(typeof exports.batch_place_exact, 'function');
});
