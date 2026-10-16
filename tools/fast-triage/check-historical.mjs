// Original-row replay of only the feature selector, never a solver or timing benchmark.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolveFastBudgets, selectFastBudget } from '../../src/fast-budget-policy.mjs';
import { expectedBudget } from './verify.mjs';
assert(process.argv[2], 'database path required');
const child = spawn('python', [fileURLToPath(new URL('./historical-features.py', import.meta.url)), process.argv[2]], { stdio: ['ignore', 'pipe', 'inherit'] });
const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('reader exit ' + code))); });
done.catch(() => {});
const policies = ['U192', 'U228_OR_D16', 'U192_OR_D16', 'S200_OR_D16'];
let fixtures = 0, checks = 0;
for await (const line of createInterface({ input: child.stdout })) {
  const f = JSON.parse(line), prepared = { keys: Array(f.S), cases: f.singletons.map(id => id === null ? [[0, 1], [1, 1]] : [[id, 1]]) };
  for (const fastPolicy of policies) {
    const actual = selectFastBudget(prepared, f.K, resolveFastBudgets({ fastPolicy }));
    assert.equal(actual.budget, expectedBudget(fastPolicy, f, f.K), `${f.id}/${fastPolicy}`);
    assert(actual.forcedLowerBound <= f.F && actual.forcedUpperBound >= f.F);
    if (actual.featuresComplete) assert.equal(actual.F, f.F);
    checks++;
  }
  fixtures++;
}
await done;
assert.equal(fixtures, 931);
console.log(JSON.stringify({ status: 'PASS', fixtures, checks, solverCalls: 0, timingBenchmark: false }));
