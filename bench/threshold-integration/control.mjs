import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { audit } from './review.mjs';
const config = JSON.parse(readFileSync(new URL('./run.json', import.meta.url)));
for (const id of config.controlCases) {
  const r = spawnSync(process.execPath, ['bench/threshold-integration/benchmark.mjs', '--profile', 'product-control', '--suite', 'all', '--mask', '0',
    '--pairs', '5', '--timeout-seconds', '300', '--case', id, '--out', `bench/threshold-integration/results/control/${id}`], { stdio: 'inherit' });
  assert.equal(r.status, 0);
}
const review = audit('bench/threshold-integration/results/control', 5, config.controlCases, null, 'product-control');
writeFileSync('bench/threshold-integration/results/control/control-review.json', JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(review.comparisons, null, 2));
