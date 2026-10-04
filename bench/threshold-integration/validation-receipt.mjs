import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from './engine.mjs';
const [root, output] = process.argv.slice(2); assert(root && output);
const files = [], native = [], product = [];
for (const mode of ['C', 'A', 'B']) {
  const name = `native-${mode}.txt`, bytes = readFileSync(resolve(root, 'correctness', name)), text = bytes.toString('utf8');
  const summaries = [...text.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out/g)].map(m => m.slice(1).map(Number));
  assert(summaries.length > 0); for (const s of summaries) assert(s.slice(1).every(n => n === 0));
  assert.match(text, /candidates_match_oracle_with_budget_locks_and_full_undo \.\.\. ok/);
  assert.match(text, /root_forced_duplicate_ids_equal_k_and_partial_budget_exits \.\.\. ok/);
  native.push({ mode, passed: summaries.reduce((sum, s) => sum + s[0], 0), failed: 0, ignored: 0,
    names: [...text.matchAll(/^test (.*?) \.\.\. ok$/gm)].map(m => m[1]) });
  files.push({ file: name, sha256: sha256(bytes) });
}
for (const mode of ['D', 'C', 'A', 'B']) {
  const name = `product-${mode}.txt`, bytes = readFileSync(resolve(root, 'correctness', name)), text = bytes.toString('utf8');
  const count = key => Number(text.match(new RegExp(`(?:#|ℹ) ${key} (\\d+)`))?.[1]);
  const passed = count('pass'); assert(passed > 0); assert.equal(count('tests'), passed);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(count(key), 0);
  product.push({ mode, passed, failed: 0, skipped: 0, names: text.split('\n').filter(line => line.startsWith('✔ ')).map(line => line.replace(/ \([\d.]+ms\)$/, '').slice(2)) });
  files.push({ file: name, sha256: sha256(bytes) });
}
const browser = JSON.parse(readFileSync(resolve(root, 'correctness/browser.json')));
assert.deepEqual(browser.map(b => b.mode), ['S', 'D', 'C', 'A', 'B']);
for (const b of browser) { assert(b.cancellation.activeWorkerStarted && b.cancellation.reclaimed && b.restarted); assert(b.cancellation.heartbeatTicks >= 3); }
const receipt = { native, product, browser: browser.map(b => ({ mode: b.mode, browser: b.browser, wasmHash: b.wasmHash,
  fixtures: b.results.map(r => ({ id: r.id, states: r.worker.searchedStates, decision: r.qualityDecision, route: r.route, progressSupported: r.progressSupported })),
  cancellation: b.cancellation, restarted: b.restarted })), logHashes: files,
  nativeTests: native.reduce((sum, n) => sum + n.passed, 0), productTests: product.reduce((sum, p) => sum + p.passed, 0) };
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ native: receipt.nativeTests, product: receipt.productTests, browserConfigurations: browser.length }, null, 2));
