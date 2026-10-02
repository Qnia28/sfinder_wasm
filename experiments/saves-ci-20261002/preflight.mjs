import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIR, config, readJson } from './common.mjs';
import { verifyDesign } from './runner.mjs';

assert.equal(process.version, `v${config.node}`);
assert.equal(config.runner, 'ubuntu-24.04'); assert.equal(config.maxParallel, 4);
assert.equal(config.paidFallback, false); assert.equal(config.holdoutEnabled, false);
assert.ok(['screen', 'diagnostic'].includes(config.campaign ?? 'screen'));
assert.ok(['USER_CONFIRMED_OVERAGE_BLOCK', 'FREE_HEADROOM_VERIFIED'].includes(config.storageGate), 'Storage cost gate not confirmed');
assert.ok(config.artifactTotalLimitBytes <= 96 * 1024 * 1024);
verifyDesign();
const event = readJson(process.env.GITHUB_EVENT_PATH);
assert.equal(event.repository.full_name, 'Qnia28/sfinder_wasm'); assert.equal(event.repository.private, false);
assert.equal(process.env.GITHUB_REF, 'refs/heads/experiment/saves-ci-20261002');
const response = await fetch('https://api.github.com/repos/Qnia28/sfinder_wasm', {
  headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
assert.ok(response.ok, `Repository visibility check failed: HTTP ${response.status}`);
assert.equal((await response.json()).private, false);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `enabled=${config.enabled}\n`);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `campaign=${config.campaign ?? 'screen'}\n`);
if (config.campaign === 'diagnostic') {
  const priorResponse = await fetch(`https://api.github.com/repos/Qnia28/sfinder_wasm/actions/runs/${config.reuseRun}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  assert.ok(priorResponse.ok, `Prior run proof failed: HTTP ${priorResponse.status}`);
  const prior = await priorResponse.json();
  assert.equal(prior.head_sha, config.reuseRunCommit); assert.equal(prior.conclusion, 'success');
  assert.equal(prior.run_attempt, 1);
  console.log(`Successful immutable prior run ${config.reuseRun} verified for build/correctness reuse; no prior timing paired with new timings.`);
}
console.log('Public repository, free standard runner allowlist, confirmed storage gate and design hashes verified.');
