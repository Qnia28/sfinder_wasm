// Reconcile preserved failed-upload dumps without running a solver.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifySnapshot } from '../secondary-bench/common/evidence.mjs';
const [root, review, output] = process.argv.slice(2);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const files = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
const hash = b => createHash('sha256').update(b).digest('hex');
const parent = read(path.join(review, 'reconciliation/CONTINUATION_39026013968.json'));
const plan = read(path.join(review, 'control/plan/PLAN.json'));
const inventory = read(path.join(review, 'RUNTIME_ARTIFACTS.json')).flatMap(p => p.artifacts).filter(a => a.name.startsWith('fast-routing-resume-failure-'));
assert.equal(inventory.length, 16);
const records = new Map(), raw = new Map(), evidence = [], starts = new Set();
for (const a of inventory) {
  const dir = path.join(root, a.name); assert(fs.existsSync(dir));
  for (const file of files(dir)) {
    evidence.push({ path: path.relative(root, file), sha256: hash(fs.readFileSync(file)) });
    if (path.basename(file) === 'SNAPSHOT.json') verifySnapshot(path.dirname(file));
    if (['records.jsonl', 'raw.jsonl', 'starts.jsonl'].includes(path.basename(file))) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
        const r = JSON.parse(line);
        if (path.basename(file) === 'starts.jsonl') { starts.add(r.callId); continue; }
        const map = path.basename(file) === 'raw.jsonl' ? raw : records;
        assert(!map.has(r.callId)); map.set(r.callId, r);
      }
    }
  }
}
const allowed = new Set(parent.chunks.flatMap(c => c.callIds));
for (const [id, r] of records) {
  assert(allowed.has(id)); const e = raw.get(id)?.execution; assert(e);
  assert.equal(e.status, r.status); assert.equal(e.reaped, r.reaped);
  assert(!r.status.startsWith('ERROR'), 'measurement failure requires review');
}
const retained = [], chunks = [];
for (const chunk of plan.chunks) {
  const callIds = [];
  for (const task of chunk.tasks) {
    if (!allowed.has(task.calls[0].callId)) continue;
    assert(task.calls.every(c => allowed.has(c.callId)));
    const complete = task.calls.every(c => records.get(c.callId)?.reaped === true && /^(RETURNED_|TIMEOUT_|OOM$)/.test(records.get(c.callId).status));
    if (complete) retained.push({ commandId: task.command.id, runId: '39030155561', callIds: task.calls.map(c => c.callId) });
    else callIds.push(...task.calls.map(c => c.callId));
  }
  if (callIds.length) chunks.push({ shard: chunk.index, callIds });
}
const run = read(path.join(review, 'RUNTIME_RUN_FINAL.json'));
const spent = run.jobs.reduce((sum, j) => sum + Math.max(0, (Date.parse(j.completedAt) - Date.parse(j.startedAt)) / 1000 || 0), 0);
const remaining = new Set(chunks.flatMap(c => c.callIds));
const reserved = plan.schedule.filter(c => remaining.has(c.callId)).reduce((n, c) => n + c.reservationSeconds, 0);
const manifest = { ...parent, schema: 2, policy: 'REUSE_COMPLETE_COMMANDS_FROM_BOTH_RUNS', chunks, resumeCalls: remaining.size,
  additionalRetainedCommands: retained, previousContinuationRunId: '39030155561',
  previousContinuationRecords: records.size, previousContinuationStarted: starts.size,
  previousContinuationUnknown: [...starts].filter(id => !raw.has(id)),
  previousContinuationEvidence: evidence,
  budget: { ...parent.budget, closedContinuationRunnerSeconds: spent, remainingCallReservationSeconds: reserved,
    continuationControlSeconds: chunks.length * 900 + 7200,
    cumulativeConservativeHours: (parent.budget.closedParentRunnerSeconds + spent + reserved + chunks.length * 900 + 7200) / 3600 },
  previousContinuationArtifacts: inventory.map(a => ({ id: a.id, name: a.name, digest: a.digest })) };
assert(manifest.budget.cumulativeConservativeHours + 2 < 1200);
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ retainedCommands: retained.length, retainedCalls: retained.reduce((n, r) => n + r.callIds.length, 0),
  records: records.size, unknown: manifest.previousContinuationUnknown.length, resumeCalls: remaining.size, chunks: chunks.length,
  cumulativeHoursWithControl: manifest.budget.cumulativeConservativeHours + 2 }));
