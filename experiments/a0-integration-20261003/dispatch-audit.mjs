// Metadata dispatch audit, not a native timing or primary proof rerun.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { minimumCoverAdaptiveAsync } from '../../src/min-cover-adaptive.mjs';
import { solveExactSecondary } from '../../src/min-cover-exact-secondary.mjs';
import { HERE, ROOT, read, write, matrixInput } from './common.mjs';
const phase = process.argv[2];
const entries = read(path.join(HERE, 'INPUTS.json')).entries.filter(e => e.partition === 'reserved-validation' && e.route === 'TINY_LEGACY_EXACT');
if (phase !== 'reserved') throw Error('Reserved dispatch before freeze');
const ledger = [];
for (const entry of entries) {
  // Candidate-count dispatch only. Placeholder results do not certify native
  // quality or cardinality; real native parity is tested on small fixtures.
  let legacy = 0;
  const keys = Array.from({ length: entry.n }, (_, i) => String(i).padStart(3, '0'));
  const coverage = new Map([[0, new Set(keys)]]);
  const solver = { minimumCover() { legacy++; return { count: 1, keys: [keys[0]], qualityVector: [1], searchedStates: 0 }; },
    minimumCoverAtCount() { throw Error('A0 dispatched to legacy tiny route'); } };
  const result = await minimumCoverAdaptiveAsync(coverage, { solver, qualityFor: () => 1, exactQuality: 'true', secondary: 'rust' });
  assert.equal(legacy, 1); assert.equal(result.qualityDecision, 'tiny-legacy-exact');
  ledger.push({ matrixId: entry.id, n: entry.n, legacyCalls: 1, a0Calls: 0, nativeSolverCalls: 0, actualInputDecoded: false });
}
assert.equal(ledger.length, 115);
write(path.join(ROOT, '.a0/dispatch/DISPATCH.json'), { status: 'PASS', phase, reservedTinyMatrices: 115, ledger, nativePrimaryCalls: 0, nativeQualityCalls: 0, limitation: 'Metadata-derived dispatch spies only; not all-original-row tiny timings' });
console.log(JSON.stringify({ status: 'PASS', reservedTinyDispatches: 115, nativeSolverCalls: 0 }));
