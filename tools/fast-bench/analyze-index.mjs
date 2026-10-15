// Scalar/index reanalysis only. No solver and no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const [directory, output] = process.argv.slice(2);
assert(directory && output);
const audit = JSON.parse(fs.readFileSync(path.join(directory, 'AUDIT.json')));
const plan = JSON.parse(fs.readFileSync(path.join(directory, 'PLAN.json')));
const rows = gunzipSync(fs.readFileSync(path.join(directory, 'calls.jsonl.gz'))).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
assert.equal(rows.length, audit.observed); assert.equal(plan.scheduleHash, audit.scheduleHash);
fs.mkdirSync(output, { recursive: false });
const schedule = new Map(plan.schedule.map(c => [c.callId, c]));
const returned = r => r?.status?.startsWith('RETURNED');
const groups = new Map(), pairs = [], tracePairs = [];
for (const row of rows) {
  const call = schedule.get(row.callId); assert(call);
  const key = JSON.stringify([call.phase, call.fixture?.id ?? call.taskId, call.repeat, call.trace]);
  if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row);
}
for (const [group, values] of groups) {
  for (const reference of ['BASE100', 'DIRECT']) {
    const base = values.find(r => r.arm === reference);
    for (const candidate of values.filter(r => r.arm !== reference)) {
      const completedPair = returned(base) && returned(candidate);
      pairs.push({ group, reference, arm: candidate.arm, referenceStatus: base?.status ?? 'MISSING',
        candidateStatus: candidate.status, completedPair,
        deltaPolicyMs: completedPair ? candidate.policyMs - base.policyMs : null,
        referenceProof: base?.qualityExact ?? null, candidateProof: candidate.qualityExact ?? null,
        // A hash mismatch says only DIFFERENT, not better/worse. Open raw vectors for ordering.
        qualityRelation: base?.qualityHash && candidate.qualityHash ? base.qualityHash === candidate.qualityHash ? 'EQUAL' : 'DIFFERENT_ORDER_UNOBSERVED' : 'UNOBSERVED',
        referenceCallId: base?.callId ?? null, candidateCallId: candidate.callId });
    }
  }
}
const trace = new Map();
for (const r of rows.filter(r => r.phase === 'trace')) {
  const key = JSON.stringify([r.fixtureId, r.arm, r.repeat]);
  if (!trace.has(key)) trace.set(key, []); trace.get(key).push(r);
}
for (const [key, values] of trace) {
  const on = values.find(r => r.trace), off = values.find(r => !r.trace);
  const completedPair = returned(on) && returned(off), deltaMs = completedPair ? on.policyMs - off.policyMs : null;
  tracePairs.push({ key, onStatus: on?.status ?? 'MISSING', offStatus: off?.status ?? 'MISSING', completedPair, deltaMs,
    screenThresholdMs: completedPair ? Math.max(5, .05 * off.policyMs) : null,
    screenExceeded: completedPair ? deltaMs > Math.max(5, .05 * off.policyMs) : null,
    interpretation: 'two-pair descriptive screen; no overhead subtraction or performance gate' });
}
const csv = data => {
  if (!data.length) return '';
  const keys = Object.keys(data[0]), quote = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return [keys.map(quote).join(','), ...data.map(r => keys.map(k => quote(r[k])).join(','))].join('\n') + '\n';
};
fs.writeFileSync(path.join(output, 'pairs.csv'), csv(pairs));
fs.writeFileSync(path.join(output, 'trace-pairs.csv'), csv(tracePairs));
fs.writeFileSync(path.join(output, 'SUMMARY.json'), JSON.stringify({ runId: audit.runId, collectionStatus: audit.status,
  expected: audit.expected, observed: audit.observed, missing: audit.missing.length, statuses: audit.statuses,
  pairedRows: pairs.length, tracePairs: tracePairs.length,
  warning: 'Completed-pair timing has selection bias. Read all status transitions and raw quality vectors. No candidate selected.' }, null, 2));
console.log(JSON.stringify({ collectionStatus: audit.status, pairedRows: pairs.length, tracePairs: tracePairs.length }));
