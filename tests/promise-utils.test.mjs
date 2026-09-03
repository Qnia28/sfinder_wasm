import test from 'node:test';
import assert from 'node:assert/strict';
import { keyedRetryableLoader, retryableLoader } from '../src/promise-utils.mjs';

// #6: the invariants every persistent initialization Promise in this package
// must hold. They live in one primitive so all four layers -- WASM assets,
// HiGHS, the batch engine, and the Worker's solver-per-height cache -- share
// exactly one implementation instead of four copies of the same guard.

// The factory runs in a microtask, so a gate is only registered after a tick.
const tick = () => new Promise((resolve) => { setTimeout(resolve, 0); });

test('concurrent callers share one in-flight initialization', async () => {
  let calls = 0;
  let release;
  const load = retryableLoader(() => { calls += 1; return new Promise((r) => { release = r; }); });
  const a = load();
  const b = load();
  assert.equal(a, b, 'the same promise object is handed to both callers');
  await tick();
  release('value');
  assert.equal(await a, 'value');
  assert.equal(await b, 'value');
  assert.equal(calls, 1);
});

test('a successful initialization stays cached', async () => {
  let calls = 0;
  const load = retryableLoader(async () => { calls += 1; return { id: calls }; });
  const first = await load();
  const second = await load();
  assert.equal(first, second, 'the same resolved object, not an equal copy');
  assert.equal(calls, 1);
});

test('a rejected initialization permits a retry that can succeed', async () => {
  let calls = 0;
  const load = retryableLoader(async () => {
    calls += 1;
    if (calls === 1) throw new Error('transient');
    return 'recovered';
  });
  const poisoned = load();
  await assert.rejects(poisoned, /transient/);
  const retry = load();
  assert.notEqual(retry, poisoned, 'the rejected promise must not be handed out again');
  assert.equal(await retry, 'recovered');
  assert.equal(await load(), 'recovered');
  assert.equal(calls, 2);
});

test('a synchronous throw is a retryable rejection, not a thrown call', async () => {
  let calls = 0;
  const load = retryableLoader(() => {
    calls += 1;
    if (calls === 1) throw new Error('sync boom');
    return Promise.resolve('ok');
  });
  await assert.rejects(load(), /sync boom/);
  assert.equal(await load(), 'ok');
});

test('a settled rejection does not disturb the attempt that replaces it', async () => {
  // The cache is only ever cleared by a rejection handler that still owns the
  // cache entry (`current === attempt`). A handler from an abandoned attempt is
  // therefore inert: here attempt 1 rejects, attempt 2 is installed and then
  // resolves, and attempt 2's value survives and stays cached.
  const gates = [];
  let calls = 0;
  const load = retryableLoader(() => new Promise((resolve, reject) => {
    calls += 1;
    gates.push({ resolve, reject });
  }));

  const first = load();
  await tick();
  gates[0].reject(new Error('slow failure'));
  await assert.rejects(first, /slow failure/);

  const second = load();
  assert.notEqual(second, first);
  await tick();
  assert.equal(load(), second, 'the newer in-flight attempt is still the cache entry');
  gates[1].resolve('late success');
  assert.equal(await second, 'late success');
  assert.equal(await load(), 'late success', 'the newer success stays cached');
  assert.equal(calls, 2, 'no third attempt was started');
});

test('keyed loaders hold the invariants independently per key', async () => {
  const calls = new Map();
  const load = keyedRetryableLoader(async (key) => {
    calls.set(key, (calls.get(key) ?? 0) + 1);
    if (key === 'bad' && calls.get(key) === 1) throw new Error('first attempt fails');
    return `built:${key}`;
  });
  const a = load('x');
  const b = load('x');
  assert.equal(a, b, 'one in-flight attempt per key');
  assert.equal(await a, 'built:x');
  assert.equal(await load('y'), 'built:y');
  await assert.rejects(load('bad'), /first attempt fails/);
  assert.equal(await load('bad'), 'built:bad');
  assert.equal(calls.get('x'), 1);
  assert.equal(calls.get('y'), 1);
  assert.equal(calls.get('bad'), 2);
});
