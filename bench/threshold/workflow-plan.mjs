import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';

// Push uses a committed config so a newly added workflow works even before it
// is discoverable for workflow_dispatch on GitHub's default branch.
const config = JSON.parse(readFileSync(new URL('./ci-run.json',import.meta.url)));
assert(['cycle1', 'cycle1-100', undefined, 'legacy'].includes(config.fixtureSet));
const fixtureRoot = config.fixtureSet === 'cycle1-100' ? 'bench/threshold/cycle1-100'
  : config.fixtureSet === 'cycle1' ? 'bench/threshold/cycle1' : 'bench/threshold';
process.env.THRESHOLD_FIXTURE_ROOT = fixtureRoot;
const { settings, defaults, caseIds } = await import('./profiles.mjs');
const { manifest, loadFixture } = await import('./fixtures.mjs');
for (const entry of manifest.cases) loadFixture(entry.id);
const dispatch = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const value = (name, fallback) => dispatch && process.env[`INPUT_${name}`] ? process.env[`INPUT_${name}`] : fallback;
const profile = value('PROFILE',config.profile);
const mask = Number(value('MASK',config.candidateMask));
settings(profile,mask);
const suite = value('SUITE',config.suite);
const [defaultPairs, defaultTimeout] = defaults(profile);
const pairs = Number(value('PAIRS',config.pairs ?? defaultPairs));
const seconds = Number(value('TIMEOUT',config.timeoutSeconds ?? defaultTimeout));
assert(Number.isInteger(pairs) && pairs >= 1 && pairs <= 10);
assert(Number.isInteger(seconds) && seconds >= 1 && seconds <= 300);
const ids = caseIds(profile,suite);
const maxParallel = config.maxParallel ?? 2;
assert(Number.isInteger(maxParallel) && maxParallel >= 1 && maxParallel <= 20);
const comparisons = settings(profile,mask).length;
// Worst case: every serial paired side times out. Leave setup/validation/upload
// margin so a legitimate 5-minute call is not cut short by the job deadline.
const jobMinutes = Math.max(45, Math.ceil(comparisons * pairs * 2 * seconds / 60) + 15);
assert(jobMinutes <= 360, 'profile exceeds GitHub per-job execution limit');
const plan = { profile, mask, suite, pairs, seconds, fixtureRoot, maxParallel, jobMinutes, matrix: { case: ids } };
console.log(JSON.stringify(plan,null,2));
if (process.env.GITHUB_OUTPUT) for (const [key, val] of Object.entries(plan)) {
  appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${typeof val === 'object' ? JSON.stringify(val) : val}\n`);
}
