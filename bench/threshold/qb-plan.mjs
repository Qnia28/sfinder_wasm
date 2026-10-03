import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('./qb-run.json', import.meta.url)));
const db = JSON.parse(readFileSync(new URL('./qb-setups.json', import.meta.url)));
assert.equal(config.profile, 'qb-confirm'); assert.equal(config.mask, 20);
assert.equal(config.pairs, 3); assert.equal(config.recheckPairs, 10);
assert.equal(config.timeoutSeconds, 300); assert.equal(config.maxParallel, 10);
assert.equal(db.setups.length, 100); assert.equal(new Set(db.setups.map(s => s.id)).size, 100);
const plan = { matrix: { setup: db.setups.map(s => s.id) }, maxParallel: config.maxParallel,
  pairs: config.pairs, recheckPairs: config.recheckPairs, seconds: config.timeoutSeconds,
  // Every call allows30sec setup,300sec solver,15sec witness and5sec cleanup.
  // Four calls per pair, plus10min checkout/artifact/upload margin.
  jobMinutes: Math.ceil(4 * config.pairs * (config.timeoutSeconds + 50) / 60) + 10,
  recheckMinutes: Math.ceil(4 * config.recheckPairs * (config.timeoutSeconds + 50) / 60) + 10 };
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(plan)) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}\n`);
}
