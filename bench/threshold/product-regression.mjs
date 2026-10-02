import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// This operates on THIS checkout only. Save/restore the tracked binary even
// when the tests fail; generated experiment modules never replace production.
const wasm = new URL('../../wasm/pc_wasm.wasm',import.meta.url);
const original = readFileSync(wasm);
try {
  writeFileSync(wasm,readFileSync(new URL('./build/production.wasm',import.meta.url)));
  const run = spawnSync(process.execPath,[
    '--experimental-wasm-stack-switching','--test-isolation=none','--test-concurrency=1','--test',
    'tests/secondary-three-engine.test.mjs', 'tests/secondary-portfolio.test.mjs',
    'tests/secondary-components.test.mjs', 'tests/parallel-secondary.test.mjs',
    'tests/filter-cover-worker.test.mjs',
  ],{stdio:'inherit'});
  if (run.status !== 0) throw new Error(`product regression failed: ${run.error ?? run.status}`);
} finally { writeFileSync(wasm,original); }
