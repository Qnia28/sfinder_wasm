import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { validateIncumbent } from './a0-contracts.mjs';
import { prepareNumericInput } from './a0-numeric-input.mjs';

let solver;
let calls = 0;
try {
  const bytes = fs.readFileSync(workerData.fixturesPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), workerData.fixturesSha256);
  const { fixtures } = JSON.parse(bytes);
  const [{ createWasmSolver }, { registerNumericCoverage }, { packNumericQualityRows }] = await Promise.all([
    import(pathToFileURL(path.join(workerData.snapshotRoot, 'src/wasm-backend.mjs'))),
    import(pathToFileURL(path.join(workerData.snapshotRoot, 'src/numeric-cover-data.mjs'))),
    import(pathToFileURL(path.join(workerData.snapshotRoot, 'src/pc-wasm-cover-matrix.mjs'))),
  ]);
  solver = await createWasmSolver(4, { legal: false });
  for (const fixture of fixtures) {
    const { matrix, expected } = fixture;
    const { coverage, qualityFor } = prepareNumericInput(matrix, { registerNumericCoverage, packNumericQualityRows });
    for (const partitioned of [false, true]) {
      const invoke = (budget, seedKeys = matrix.seedKeys) => {
        const value = solver.minimumCoverAtCount(coverage, matrix.K, {
          qualityFor, seedKeys, stateBudget: budget, integrated: true, partitioned });
        calls++;
        const incumbent = validateIncumbent({ ...matrix, seedKeys }, value, Math.max(1, budget));
        if (value.completed) assert.deepEqual(incumbent, { count: expected.count, keys: expected.keys, qualityVector: expected.qualityVector }, fixture.name);
        return value;
      };
      const exact = invoke(100_000);
      assert.equal(exact.completed, true, `${fixture.name}: small synthetic search should finish`);
      const budgets = new Set([0, 1, 2, 5, 32, 128, Math.max(1, exact.searchedStates - 1), Math.max(1, exact.searchedStates)]);
      for (const budget of budgets) invoke(budget);
      // Same isolate/solver/memory after multiple capped calls: no stale trail/result.
      assert.deepEqual(invoke(100_000), exact, `${fixture.name}: repeated-call determinism`);
      invoke(100_000, expected.keys); // An already optimal seed must remain valid.
    }
  }
  solver.close(); solver = null;
  parentPort.postMessage({ event: 'result', status: 'PASS', fixtureCount: fixtures.length, solverCalls: calls });
} catch (error) {
  parentPort.postMessage({ event: 'error', status: 'ERROR', message: error.message, stack: error.stack, solverCalls: calls });
} finally { solver?.close(); }
