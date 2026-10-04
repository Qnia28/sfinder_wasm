import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const wasm = new URL('../../wasm/pc_wasm.wasm', import.meta.url), original = readFileSync(wasm);
const files = ['tests/secondary-three-engine.test.mjs', 'tests/secondary-portfolio.test.mjs', 'tests/secondary-components.test.mjs',
  'tests/parallel-secondary.test.mjs', 'tests/filter-cover-worker.test.mjs'];
mkdirSync('bench/threshold-integration/results/correctness', { recursive: true });
try {
  for (const mode of ['D', 'C', 'A', 'B']) {
    writeFileSync(wasm, readFileSync(new URL(`./build/${mode}.wasm`, import.meta.url)));
    const r = spawnSync(process.execPath, ['--experimental-wasm-stack-switching', '--test-isolation=none', '--test-concurrency=1', '--test', ...files],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(`bench/threshold-integration/results/correctness/product-${mode}.txt`, r.stdout + r.stderr);
    assert.equal(r.status, 0, `${mode}: ${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /skipped 0/, 'do not count skipped CP/browser/worker tests as passed');
    console.log(`${mode}: active product secondary/portfolio/worker/CP regressions passed with no skips.`);
  }
} finally { writeFileSync(wasm, original); }
