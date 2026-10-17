// Offline reconciliation only: never imports or invokes a solver.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { verifySnapshot } from '../secondary-bench/common/evidence.mjs';
import { digest } from '../fast-bench/planner.mjs';
const [control, inventoryPath, runPath, output] = process.argv.slice(2);
assert(control && inventoryPath && runPath && output);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
verifySnapshot(path.join(control, 'plan'));
const plan = read(path.join(control, 'plan/PLAN.json')), run = read(runPath), inventory = read(inventoryPath);
assert.equal(plan.study, 'fast-routing-e2e-20261017'); assert.equal(plan.lock.runId, '39026013968');
assert.equal(digest(plan.schedule), plan.scheduleHash); assert.equal(run.headSha, plan.lock.commit);
const byId = new Map(plan.schedule.map(c => [c.callId, c])), records = new Map(), starts = new Set(), sources = [], checkpoints = new Map();
const add = (r, file) => {
  assert(byId.has(r.callId), 'foreign record');
  for (const key of ['phase', 'arm', 'repeat', 'commandId', 'diagnostics']) assert.deepEqual(r[key], byId.get(r.callId)[key]);
  if (records.has(r.callId)) assert.deepEqual(records.get(r.callId), r, 'conflicting record ' + file);
  else records.set(r.callId, r);
};
for (const file of files(path.join(control, 'shards'))) {
  if (path.basename(file) === 'SUMMARY.json') {
    const s = read(file); if (!s.records || s.mode !== 'measure') continue;
    const snap = verifySnapshot(path.dirname(file)); sources.push({ path: path.relative(control, file), checkpointId: snap.checkpointId });
    assert.equal(s.runId, plan.lock.runId); assert.equal(s.planHash, plan.scheduleHash);
    assert(!s.stopped || s.stopped.includes('CANCELLED'), 'non-transport failure requires review: ' + s.stopped);
    for (const r of s.records) add(r, file);
    for (const ref of s.checkpoints) { if (checkpoints.has(ref.id)) assert.deepEqual(checkpoints.get(ref.id), ref); checkpoints.set(ref.id, ref); }
  }
  if (path.basename(file) === 'records.jsonl') for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) add(JSON.parse(line), file);
  if (path.basename(file) === 'starts.jsonl') for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line); assert(byId.has(r.callId)); starts.add(r.callId);
  }
}
const accepted = r => r && r.reaped === true && (/^(RETURNED_|TIMEOUT_)/.test(r.status) || ['OOM', 'NOT_RUN_AFTER_OOM', 'NOT_RUN_CAPTURE_MISSING'].includes(r.status));
for (const r of records.values()) {
  assert(!r.status.startsWith('ERROR'), 'product/witness error requires review');
  if (!r.status.startsWith('NOT_RUN')) starts.add(r.callId);
}
const chunks = [], retainedCommands = [], interruptedCommands = [], newCommands = [], originalStatusCounts = {};
for (const chunk of plan.chunks) {
  const selected = [];
  const job = run.jobs.find(j => j.name === `measure (${chunk.index})`); assert(job);
  for (const task of chunk.tasks) {
    if (task.calls.every(c => accepted(records.get(c.callId)))) { retainedCommands.push(task.command.id); continue; }
    selected.push(...task.calls.map(c => c.callId));
    const prior = task.calls.filter(c => starts.has(c.callId));
    const uncertain = !task.calls.some(c => records.has(c.callId)) && job.steps?.some(s => s.name.includes('Seven routes') && s.conclusion !== 'skipped');
    (prior.length || uncertain ? interruptedCommands : newCommands).push({ commandId: task.command.id,
      priorStartedCalls: prior.map(c => c.callId), unknownStarted: uncertain,
      selection: 'whole command, all arms/repeats/diagnostics; preserve same-VM comparison' });
  }
  if (selected.length) chunks.push({ shard: chunk.index, callIds: selected });
}
const resumed = new Set(chunks.flatMap(c => c.callIds));
for (const r of records.values()) originalStatusCounts[r.status] = (originalStatusCounts[r.status] ?? 0) + 1;
const spentSeconds = run.jobs.reduce((sum, j) => sum + Math.max(0, (Date.parse(j.completedAt) - Date.parse(j.startedAt)) / 1000 || 0), 0);
const reserved = plan.schedule.filter(c => resumed.has(c.callId)).reduce((sum, c) => sum + c.reservationSeconds, 0);
const conservativeHours = (spentSeconds + reserved + chunks.length * 900 + 7200) / 3600;
assert(conservativeHours <= 1200); assert(Date.now() < plan.lock.deadlineMs);
const artifact = inventory.artifacts.find(a => a.name === 'fast-measurement-plan'); assert(artifact);
fs.mkdirSync(output, { recursive: false });
const manifest = { schema: 1, attributionLabel: 'GLM', parentRunId: plan.lock.runId, sourceCommit: plan.lock.commit,
  originUtc: plan.lock.originUtc, deadlineMs: plan.lock.deadlineMs, scheduleHash: plan.scheduleHash,
  reason: 'Artifact REST full-inventory pagination exhausted installation rate limit; fail-fast cancelled other jobs. Product untouched.',
  policy: 'REUSE_COMPLETE_COMMANDS_RERUN_WHOLE_TRANSPORT_INTERRUPTED_COMMANDS',
  attempts: 'Keep every original raw/terminal/start evidence. Select continuation only for predeclared complete command blocks; no outcome-based selection.',
  planArtifact: { id: artifact.id, digest: artifact.digest, checkpointId: verifySnapshot(path.join(control, 'plan')).checkpointId },
  chunks, resumeCalls: resumed.size, retainedCommands, interruptedCommands, newCommands,
  parentObservedCalls: records.size, originalStatusCounts,
  previousStartedRemeasurements: [...resumed].filter(id => starts.has(id)).length,
  budget: { closedParentRunnerSeconds: spentSeconds, remainingCallReservationSeconds: reserved,
    continuationControlSeconds: chunks.length * 900 + 7200, cumulativeConservativeHours: conservativeHours, capHours: 1200 },
  parentCheckpoints: [...checkpoints.values()], reconciliationSources: sources,
  evidence: { inventorySha256: createHash('sha256').update(fs.readFileSync(inventoryPath)).digest('hex'),
    runSha256: createHash('sha256').update(fs.readFileSync(runPath)).digest('hex') } };
fs.writeFileSync(path.join(output, 'CONTINUATION_39026013968.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'PARENT_CALLS.jsonl.gz'), gzipSync([...records.values()].map(r => JSON.stringify(r)).join('\n') + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ retainedCommands: retainedCommands.length, interruptedCommands: interruptedCommands.length,
  newCommands: newCommands.length, resumeCalls: resumed.size, chunks: chunks.length, parentObservedCalls: records.size,
  originalStatusCounts, previousStartedRemeasurements: manifest.previousStartedRemeasurements, conservativeHours }, null, 2));
