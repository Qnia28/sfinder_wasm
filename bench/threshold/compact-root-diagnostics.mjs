// Migrate our own generated retained archive to the compact trace representation.
// Full vectors have already been audited, and remain in the raw Actions artifacts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';
const path = new URL('./reports/root-retained.json', import.meta.url);
const report = JSON.parse(readFileSync(path));
assert.equal(report.runId, '37113754448'); assert.equal(report.cases, 58);
for (const trace of report.diagnostics) trace.results = trace.results.map(result => {
  if (!result.selected) return result;
  const { mask, completed, count, searchedStates, provenPrefix, diagnostics, selected, quality } = result;
  return { mask, completed, count, searchedStates, provenPrefix, diagnostics,
    witnessHash: sha256(JSON.stringify({ selected, quality })),
    note: 'Full selected/quality vectors verified against original rows before compacting; available in raw trace artifacts.' };
});
writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
console.log(`Compacted retained trace archive to ${readFileSync(path).length} bytes.`);
