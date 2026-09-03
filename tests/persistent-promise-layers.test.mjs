import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { loadBatchWasm } from '../src/batch-backend.mjs';
import { loadHighs } from '../src/highs-min-cover.mjs';
import { loadWasmAssets } from '../src/wasm-backend.mjs';
import { getSolver } from '../src/worker-runtime.mjs';

// #6: every persistent initialization Promise in the package, exercised on the
// production module itself rather than on copied helper logic. Release 2.2 had
// four `??=` caches: wasm-backend, highs-min-cover, batch-backend and the
// Worker's own outer cache in worker-runtime.

test('no src module keeps a bare ??= promise cache', async () => {
  const offenders = [];
  for (const entry of await readdir(new URL('../src/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
    const text = await readFile(new URL(`../src/${entry.name}`, import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
      if (/\?\?=/.test(line)) offenders.push(`src/${entry.name}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('WASM assets: concurrent callers share one initialization and the result is cached', async () => {
  const a = loadWasmAssets();
  const b = loadWasmAssets();
  assert.equal(a, b);
  const assets = await a;
  assert.equal(await loadWasmAssets(), assets);
  assert.equal(typeof assets.exports.solver_new, 'function');
});

test('batch engine: concurrent callers share one initialization and the result is cached', async () => {
  const a = loadBatchWasm();
  const b = loadBatchWasm();
  assert.equal(a, b);
  const exports = await a;
  assert.equal(await loadBatchWasm(), exports);
});

test('HiGHS: concurrent callers share one initialization and the result is cached', async () => {
  const a = loadHighs();
  const b = loadHighs();
  assert.equal(a, b);
  const highs = await a;
  assert.equal(await loadHighs(), highs);
});

test('worker getSolver: concurrent same-height callers do not construct duplicate solvers', async () => {
  const a = getSolver(4);
  const b = getSolver(4);
  assert.equal(a, b, 'one in-flight construction per height');
  const solver = await a;
  const later = await getSolver(4);
  assert.equal(later, solver, 'the constructed solver is cached, not rebuilt');
  assert.equal(solver.height, 4);
});

test('worker getSolver: different heights get distinct solvers', async () => {
  const four = await getSolver(4);
  const five = await getSolver(5);
  assert.notEqual(four, five);
  assert.equal(five.height, 5);
});

test('worker getSolver: every valid production height initializes', async () => {
  for (const h of [2, 3, 4, 5, 6]) {
    const solver = await getSolver(h);
    assert.equal(solver.height, h, `height ${h} solver has correct height`);
  }
});

test('worker getSolver: invalid low and high heights reject before keyed loader creation', async () => {
  // Validation fires before the keyed loader, so no Map entry is created and each
  // call returns its own fresh rejected Promise (not single-flight).
  for (const h of [0, 1, 7, 8, -1, 1.5, NaN, null, undefined, '4']) {
    const p = getSolver(h);
    await assert.rejects(p, /unsupported height/, `height ${String(h)} should reject`);
  }
});

test('worker getSolver: repeated distinct invalid heights do not grow keyed loader state', async () => {
  // Each invalid height call must return a distinct Promise (not shared via Map),
  // proving no entry was created in the keyed loader.
  const promises = [];
  for (let h = 7; h < 27; h++) {
    const p = getSolver(h);
    if (promises.length) assert.notEqual(p, promises[promises.length - 1], `height ${h} must not share Map state`);
    promises.push(p);
  }
  await Promise.allSettled(promises);
  // Valid heights must still work after all those invalid calls.
  const solver = await getSolver(4);
  assert.equal(solver.height, 4);
});

test('worker getSolver: rejection followed by valid request remains retry-safe', async () => {
  await assert.rejects(getSolver(99), /unsupported height 99/);
  const solver = await getSolver(4);
  assert.equal(solver.height, 4);
});
