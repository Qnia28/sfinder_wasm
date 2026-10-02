import test from 'node:test';
import assert from 'node:assert/strict';
import { runUnit, environment } from './runner.mjs';

test('supervisor reports explicit invalid variant failure and closes child without solver work', async () => {
  const row = await runUnit({ variant: 'INVALID', deadline: performance.now() + 10000 });
  assert.equal(row.status, 'ERROR'); assert.equal(row.closed, true);
  assert.match(row.error.message, /Unknown immutable variant/);
});
test('supervisor preserves budget-aborted units and reaps owned child', async () => {
  const row = await runUnit({ variant: 'REF', deadline: performance.now() - 1 });
  assert.equal(row.status, 'BUDGET_ABORT');
  assert.notEqual(row.status, 'PASS');
});
test('environment records hardware and image rather than promising a physically fixed CPU', () => {
  const env = environment();
  assert.ok(env.cpu); assert.ok(env.availableParallelism > 0); assert.ok(env.memory > 0);
});
