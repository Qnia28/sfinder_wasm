import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export function resourceTrace(api, trace) {
  const digest = crypto.createHash('sha256'), snapshots = [], retained = [];
  let checks = 0, current;
  const gcAvailable = typeof globalThis.gc === 'function';
  if (gcAvailable) globalThis.gc();
  const snapshot = label => snapshots.push({ label, checks, cache: api.saveCacheSnapshot(current), memory: process.memoryUsage() });
  snapshot('before');
  const add = value => { digest.update(JSON.stringify(value) + '\n'); checks++; };
  const maybeSnapshot = (n, every = 128) => { if ((n + 1) % every === 0) snapshot(`step-${n + 1}`); };
  if (trace === 'T1') {
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < 1024; n++) {
      const expression = `/^I{${n}}$/`;
      current = api.compileExactSaveExpression(expression);
      if (pass === 0 && n < 8) retained.push({ n, run: current });
      add([...api.compileSaveExpression(expression)]);
      add(current('I'.repeat(n))); maybeSnapshot(pass * 1024 + n);
    }
    for (const { n, run } of retained) {
      assert.equal(run('I'.repeat(n)), true); assert.equal(run('T'), false);
      add([n, run('I'.repeat(n)), run('T')]);
    }
  } else if (trace === 'T2') {
    current = api.compileExactSaveExpression('/I/');
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < 4096; n++) {
      const result = current('I'.repeat(n)); assert.equal(result, n > 0); add(result); maybeSnapshot(pass * 4096 + n, 256);
    }
  } else if (trace === 'T3') {
    let step = 0;
    for (const [rounds, count, prefix] of [[64, 16, 'hot'], [4, 520, 'churn']]) {
      for (let round = 0; round < rounds; round++) for (let n = 0; n < count; n++) {
        const expression = `/^I{${n}}$/#${prefix}`;
        current = api.compileExactSaveExpression(expression);
        add([...api.compileSaveExpression(expression)]); add(current('I'.repeat(n))); maybeSnapshot(step++);
      }
    }
  } else if (trace === 'T4') {
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < 1024; n++) {
      const value = api.prepareSaveCase('I'.repeat(n) + 'T', 'I'.repeat(n) + ',*p1');
      add({ queueCounts: [...value.queueCounts], baseSavedMask: value.baseSavedMask }); maybeSnapshot(pass * 1024 + n);
    }
  } else throw new Error(`Unknown trace ${trace}`);
  snapshot('before-final-gc');
  if (gcAvailable) globalThis.gc();
  snapshot('after-final-gc');
  return { signature: digest.digest('hex'), checks, snapshots, gcAvailable, forcedGcCount: gcAvailable ? 2 : 0,
    claims: 'Entry/key-character bounds and diagnostic process memory only, not an exact heap bound or timing benchmark.' };
}
