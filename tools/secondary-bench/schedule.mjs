import assert from 'node:assert/strict';
import { hash, ENGINES, positiveMs, validateLimits, assertExact } from './contracts.mjs';

const ORDERS = [
  ['integrated', 'threshold', 'cpsat'], ['threshold', 'cpsat', 'integrated'], ['cpsat', 'integrated', 'threshold'],
  ['integrated', 'cpsat', 'threshold'], ['cpsat', 'threshold', 'integrated'], ['threshold', 'integrated', 'cpsat'],
];
export function informationSchedule(fixtures, { repeats, shards, seed }) {
  assert(Number.isInteger(repeats) && repeats >= 2, 'information collection needs >=2 repeats');
  assert(Number.isInteger(shards) && shards >= 1 && shards <= 16);
  assert(typeof seed === 'string' && seed.length > 0);
  const ids = new Set();
  const sorted = [...fixtures].sort((a, b) => hash(seed + a.id).localeCompare(hash(seed + b.id)) || a.id.localeCompare(b.id));
  return sorted.flatMap((fixture, index) => {
    assert(typeof fixture.id === 'string' && !ids.has(fixture.id), 'unique fixture IDs required'); ids.add(fixture.id);
    const shard = index % shards, initial = parseInt(hash(seed + '\n' + fixture.id).slice(0, 8), 16) % 6;
    return Array.from({ length: repeats }, (_, repeat) => {
      const direction = (Math.floor(initial / 3) + Math.floor(repeat / 3)) % 2;
      const order = ORDERS[direction * 3 + (initial % 3 + repeat) % 3];
      return order.map((engine, position) => ({
      callId: `${index}-${repeat + 1}-${position}-${engine}`, blockId: `${fixture.id}/r${repeat + 1}`,
      inputId: fixture.id, fixture, engine, repeat: repeat + 1, position, shard,
      }));
    }).flat();
  });
}
export function validateManifest(plan) {
  assert.equal(plan.schema, 1);
  assert.equal(plan.state, 'APPROVED', 'plan is draft; agree sample/repeats/timeouts/budget before running');
  assert.equal(plan.purpose, 'information', 'this runner is for initial information collection only');
  assert.equal(plan.lifecycle, 'fresh-process-cold', 'unsupported lifecycle; do not mix contracts');
  assertExact(plan.exactHumanQuality);
  assert(typeof plan.campaignId === 'string' && plan.campaignId.length);
  assert(typeof plan.approvalRecord === 'string' && plan.approvalRecord.length, 'agreement provenance required');
  assert(typeof plan.scheduleSeed === 'string' && plan.scheduleSeed.length);
  assert(Number.isInteger(plan.shards) && plan.shards >= 1 && plan.shards <= 16);
  assert(Number.isInteger(plan.repeats) && plan.repeats >= 2);
  for (const engine of ENGINES) validateLimits(plan.limits?.[engine]);
  positiveMs(plan.cpLimitMs, 'CP internal limit');
  assert(plan.cpLimitMs <= plan.limits.cpsat.callMs, 'CP internal deadline exceeds whole call deadline');
  for (const name of ['jobMs', 'overallMs']) positiveMs(plan.budget?.[name], name);
  assert(Number.isSafeInteger(plan.budget.maxCalls) && plan.budget.maxCalls > 0);
  assert.equal(plan.budget.overallMs, 8 * 3600000, 'campaign uses 8h wall runtime, not runner-hour budget');
  assert(Number.isFinite(Date.parse(plan.budget.originUtc)), 'campaign origin required');
  assert(Object.keys(plan.sourceFiles ?? {}).length > 0, 'source/asset lock required');
  assert(Array.isArray(plan.fixtures) && plan.fixtures.length > 0);
  for (const fixture of plan.fixtures) assert(typeof fixture.path === 'string' && /^[a-f0-9]{64}$/.test(fixture.sha256));
  const calls = plan.fixtures.length * plan.repeats * ENGINES.length;
  assert(calls <= plan.budget.maxCalls, 'scheduled calls exceed agreed maximum');
  return plan;
}
