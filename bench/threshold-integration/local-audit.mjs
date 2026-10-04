import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { audit } from './review.mjs';
import { sha256 } from './engine.mjs';
const [root, output] = process.argv.slice(2); assert(root && output);
const runId = '37179296189', suffix = `${runId}-1`;
process.env.GITHUB_RUN_ID = runId; process.env.GITHUB_RUN_ATTEMPT = '1';
process.env.THRESHOLD_BUILD_ROOT = resolve(root, `integration-build-${suffix}`);
const final = resolve(root, `integration-final-${suffix}`);
const initial = JSON.parse(readFileSync(resolve(final, 'review/review.json')));
const repeat = JSON.parse(readFileSync(resolve(final, 'recheck-review/review.json')));
const control = JSON.parse(readFileSync(resolve(final, 'control/control-review.json')));
const plan = JSON.parse(readFileSync(new URL('./run.json', import.meta.url)));
const selection = JSON.parse(readFileSync(resolve(final, 'review/selection.json')));
assert.equal(selection.reviewHash, sha256(readFileSync(resolve(final, 'review/review.json'))));
const dirs = prefix => readdirSync(root).filter(name => name.startsWith(prefix)).map(name => resolve(root, name));
const original = audit(dirs('integration-bench-'), 5, plan.cases);
const json = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(json(original), initial, 'independent raw initial audit differs from workflow receipt');
const rerun = audit(dirs('integration-recheck-'), 10, selection.cases, initial);
assert.deepEqual(json(rerun), repeat, 'independent raw repeat audit differs from workflow receipt');
const bridge = audit(resolve(root, `integration-control-${suffix}`), 5, plan.controlCases, null, 'product-control');
assert.deepEqual(json(bridge), control, 'independent raw bridge audit differs from workflow receipt');
const receipt = { runId, runAttempt: 1, candidate: initial.candidate, buildHashes: initial.wasmHashes,
  original: { calls: original.executedSamples, exact: original.exact, timeout: original.timeout, unrun: original.skippedSamples },
  repeat: { calls: rerun.executedSamples, exact: rerun.exact, timeout: rerun.timeout, unrun: rerun.skippedSamples },
  bridge: { calls: bridge.executedSamples, exact: bridge.exact, timeout: bridge.timeout, unrun: bridge.skippedSamples },
  allActualCalls: original.executedSamples + rerun.executedSamples + bridge.executedSamples,
  allRawCompletedWitnessesValidated: original.exact + rerun.exact + bridge.exact,
  hashes: Object.fromEntries(['review/review.json', 'recheck-review/review.json', 'control/control-review.json'].map(path => [path, sha256(readFileSync(resolve(final, path)))])),
  audit: 'Recomputed every raw completed witness, summary median including product/solver metrics, memory, exact/timeout/early-stop/unrun and source/build identities. Deep equal to all three original workflow audits. No new performance samples.' };
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(receipt, null, 2));
