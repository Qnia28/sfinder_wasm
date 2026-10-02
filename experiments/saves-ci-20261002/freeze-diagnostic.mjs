import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DIR, readJson, writeJson, hash } from './common.mjs';

const ids = ['broad:c7-2plus2-qb-row-241:fixed1', 'broad:c7-2plus2-qb-row-020:fixed1', 'broad:c7-2plus2-qb-row-088:prefix210',
  'deep:cycle1-pcinfo-033:q10', 'deep:cycle1-6p-pco-a:q10', 'deep:cycle1-elephant-a:bag'];
const original = readJson(path.join(DIR, 'inputs/cells.json'));
const cells = ids.map(id => {
  const source = original.cells.find(cell => cell.id === id); assert.ok(source, id);
  return { ...source, sourceCell: id, id: `diagnostic:${id}`, stage: 'diagnostic', shard: 0, conditions: ['REF', 'P', 'R', 'M'] };
});
const selected = { schema: 'saves-six-counterexample-factor-diagnostic-v1', repetitions: 2, cells,
  authorization: 'User selected six-counterexample diagnosis after first-wave result review.',
  hypothesis: 'Separate product JS vs common wrapper, original WASM vs rebuilt original Rust, rebuilt packed vs direct Rust on existing counterexamples.',
  unchanged: ['literal input', 'wantedSave', 'clear/Hold/mask/cache', 'cold/warm', 'source candidate refs', 'WASM artifact bytes'],
  noReplay: ['No original full database wave', 'No new large anchor remeasurement', 'No A1/A2/B1/B2 performance rerun', 'No holdout'],
  limits: { cells: 6, timedRequests: 48, resourceSessions: 0, requestSeconds: 15, sameVMSerial: true, jobMinutes: 8, runnerMinutes: 5 },
  priorRun: 36976418775, preservePriorObservations: true, reusePriorTimingsAsNewPairedControl: false };
writeJson(path.join(DIR, 'inputs/diagnostic.json'), selected);
const files = ['inputs/diagnostic.json', 'inputs/cells.json', 'design-seal.json'];
writeJson(path.join(DIR, 'diagnostic-design-seal.json'), { schema: 'saves-diagnostic-design-seal-v1', frozenBeforeNewTiming: true,
  files: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(DIR, file)))])), timedRequests: 48, priorRun: 36976418775 });
console.log(JSON.stringify({ diagnosticCells: ids, timedRequests: 48, noSolverCalled: true }));
