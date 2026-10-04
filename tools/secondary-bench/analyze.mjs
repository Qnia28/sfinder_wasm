import assert from 'node:assert/strict';
import fs from 'node:fs';
import { writeJson } from './contracts.mjs';
import { selectInformationRetests } from './select-retests.mjs';

const [output, repeats, ...rawFiles] = process.argv.slice(2);
assert(output && rawFiles.length, 'usage: analyze.mjs <new-output.json> <repeats> <raw.jsonl> [...]');
const records = rawFiles.flatMap(filename => fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)));
const seen = new Set();
for (const row of records) { assert(!seen.has(row.callId), 'duplicate call ID; do not combine repeated/replaced runs'); seen.add(row.callId); }
const measured = records.filter(r => r.condition), unrun = records.filter(r => !r.condition);
const analysis = selectInformationRetests(measured, { expectedRepeats: Number(repeats) });
const exact = measured.filter(r => r.status === 'EXACT'), byFixture = new Map();
for (const row of exact) {
  const witness = JSON.stringify(row.execution.result.verified);
  const invariant = JSON.stringify({ selected: row.execution.result.verified.selected, qualityHash: row.execution.result.verified.qualityHash });
  if (byFixture.has(row.inputId)) assert.equal(invariant, byFixture.get(row.inputId), 'cross-engine/repeat exact witness mismatch: ' + row.inputId);
  else byFixture.set(row.inputId, invariant);
  assert(witness);
}
writeJson(output, { ...analysis, unrun, crossEngineWitness: 'AGREEMENT_ONLY_NOT_INDEPENDENT_PROOF',
  rawFiles, calls: records.length, statuses: Object.fromEntries([...new Set(records.map(r => r.status))].map(status => [status, records.filter(r => r.status === status).length])) });
console.log(JSON.stringify({ calls: records.length, retestItems: analysis.selected.length, blocked: analysis.blocked.length, unrun: unrun.length }));
