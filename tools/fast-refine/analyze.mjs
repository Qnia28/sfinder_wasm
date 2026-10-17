// Offline only. Can also run on a full `gh run download` directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';
import { hash, selectedVector } from '../secondary-bench/contracts.mjs';
import { verifySnapshot, seal } from '../secondary-bench/common/evidence.mjs';
import { digest } from '../fast-bench/planner.mjs';
import { distribution, median, qualityDifference } from '../fast-triage/analysis.mjs';

const [planRoot, shardsRoot, output] = process.argv.slice(2);
assert(planRoot && shardsRoot && output, 'usage: analyze.mjs PLAN_DIR SHARDS_DIR NEW_OUTPUT_DIR');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
verifySnapshot(planRoot);
const plan = read(path.join(planRoot, 'PLAN.json')), lock = read(path.join(planRoot, 'LOCK.json'));
assert.equal(digest(plan.tasks), lock.scheduleHash);
const directories = fs.readdirSync(shardsRoot, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('fast-refine-shard-'))
  .map(d => path.join(shardsRoot, d.name));
const scheduled = new Map(plan.tasks.flatMap(t => t.calls.map(c => [c.callId, c])));
const seen = new Set(), records = new Map(), captures = new Map(), replays = new Map();
const failures = [], shardIDs = new Set(), allStatuses = {}, checks = { snapshots: 0, finalWitnesses: 0, sameSeedPass: 0, sameSeedCensored: 0 };
const completed = r => r?.execution.status.startsWith('RETURNED');
for (const dir of directories) {
  verifySnapshot(dir); checks.snapshots++;
  const summary = read(path.join(dir, 'SUMMARY.json'));
  assert.equal(summary.runId, lock.runId); assert.equal(summary.scheduleHash, lock.scheduleHash);
  assert(!shardIDs.has(summary.shard)); shardIDs.add(summary.shard);
  assert.deepEqual(read(path.join(dir, 'LOCK.json')), lock);
  if (summary.failure) failures.push({ shard: summary.shard, error: summary.failure });
  const starts = fs.readFileSync(path.join(dir, 'starts.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const localSeen = new Set(), fixtureCache = new Map();
  for await (const line of createInterface({ input: fs.createReadStream(path.join(dir, 'raw.jsonl')) })) {
    if (!line.trim()) continue;
    const r = JSON.parse(line), task = plan.tasks.find(t => t.command.id === r.commandId);
    assert(task && task.shard === summary.shard);
    assert(!seen.has(r.callId)); seen.add(r.callId); localSeen.add(r.callId);
    const start = starts.find(s => s.callId === r.callId); assert(start); assert.deepEqual(r.job, start.job);
    allStatuses[r.execution.status] = (allStatuses[r.execution.status] ?? 0) + 1;
    if (!r.execution.reaped || r.execution.status.startsWith('ERROR')) failures.push({ callId: r.callId, error: r.execution.status });
    if (r.phase === 'capture') {
      assert.equal(r.callId, digest([plan.study, r.commandId, 'capture']));
      captures.set(r.commandId, r);
    } else if (r.phase === 'replay') {
      assert.equal(r.callId, digest([plan.study, r.fixtureId, 'replay', r.implementation]));
      const key = r.fixtureId;
      if (!replays.has(key)) replays.set(key, {});
      assert(!replays.get(key)[r.implementation]); replays.get(key)[r.implementation] = r;
    } else {
      assert.equal(r.phase, 'e2e');
      const expected = scheduled.get(r.callId); assert(expected);
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(r[key], value);
      assert.deepEqual(r.job.command, task.command); assert.equal(r.job.arm, expected.policy);
      const capture = captures.get(r.commandId); assert.equal(capture?.execution.status, 'CAPTURED');
      assert.deepEqual(r.job.filters, capture.execution.result.filters);
      if (completed(r)) for (const [filter, o] of Object.entries(r.execution.result.outcomes)) {
        const ref = r.job.filters.find(f => f.filter === filter); assert(ref);
        if (o.status === 'EMPTY') { assert.equal(ref.status, 'EMPTY'); continue; }
        assert.equal(o.K, ref.K); assert.equal(o.witnessAudit, 'PASS');
        if (!fixtureCache.has(ref.id)) {
          const bytes = fs.readFileSync(path.join(dir, 'input-' + task.index, ref.member));
          assert.equal(hash(bytes), ref.sha256); fixtureCache.set(ref.id, JSON.parse(gunzipSync(bytes)));
        }
        const fixture = fixtureCache.get(ref.id), ids = new Map(fixture.keys.map((k, i) => [k, i]));
        assert.deepEqual(selectedVector(fixture, o.keys.map(k => ids.get(k))), o.qualityVector);
        checks.finalWitnesses++;
      }
      records.set(r.callId, r);
    }
  }
  assert.equal(new Set(starts.map(s => s.callId)).size, starts.length);
  for (const s of starts) if (!localSeen.has(s.callId)) failures.push({ callId: s.callId, error: 'started call has no terminal evidence' });
  assert.equal(localSeen.size, summary.completed.length);
  for (const r of summary.completed) assert(localSeen.has(r.callId));
}
const replayDetails = [];
for (const [fixtureId, pair] of replays) {
  if (!pair.reference || !pair.candidate) { failures.push({ fixtureId, error: 'missing replay evidence' }); continue; }
  const complete = completed(pair.reference) && completed(pair.candidate);
  if (complete) {
    assert.deepEqual(pair.reference.execution.result.seed, pair.candidate.execution.result.seed);
    assert.deepEqual(pair.reference.execution.result.result, pair.candidate.execution.result.result, fixtureId);
    checks.sameSeedPass++;
  } else checks.sameSeedCensored++;
  replayDetails.push({ fixtureId, referenceStatus: pair.reference.execution.status, candidateStatus: pair.candidate.execution.status,
    comparable: complete, referenceMs: complete ? pair.reference.execution.result.refineMs : null,
    candidateMs: complete ? pair.candidate.execution.result.refineMs : null });
}
for (const r of captures.values()) if (r.execution.status === 'CAPTURED') {
  for (const f of r.execution.result.filters.filter(f => f.status === 'CAPTURED')) {
    if (!replays.has(f.id)) failures.push({ fixtureId: f.id, error: 'missing planned capture-seed replays' });
  }
}
const missing = [...scheduled.values()].filter(c => !records.has(c.callId)).map(c => ({ ...c,
  status: captures.has(c.commandId) && captures.get(c.commandId).execution.status !== 'CAPTURED' ? 'NOT_RUN_CAPTURE_CENSORED' : 'MISSING' }));
for (const c of missing.filter(c => c.status === 'MISSING')) failures.push({ callId: c.callId, error: 'missing scheduled E2E evidence' });
const pairs = [], quality = [];
for (const task of plan.tasks) for (const c of task.calls.filter(c => c.implementation === 'candidate')) {
  const b = task.calls.find(b => b.implementation === 'reference' && b.policy === c.policy && b.repeat === c.repeat);
  const reference = records.get(b.callId), candidate = records.get(c.callId);
  const complete = completed(reference) && completed(candidate);
  pairs.push({ commandId: c.commandId, population: task.command.population, policy: c.policy, repeat: c.repeat,
    referenceCallId: b.callId, candidateCallId: c.callId,
    referenceStatus: reference?.execution.status ?? 'NOT_RUN', candidateStatus: candidate?.execution.status ?? 'NOT_RUN',
    referenceMs: complete ? reference.execution.result.policyMs : null, candidateMs: complete ? candidate.execution.result.policyMs : null,
    referenceApiMs: complete ? reference.execution.result.apiMs : null, candidateApiMs: complete ? candidate.execution.result.apiMs : null,
    deltaMs: complete ? candidate.execution.result.policyMs - reference.execution.result.policyMs : null });
  if (complete) for (const [filter, o] of Object.entries(candidate.execution.result.outcomes)) {
    const base = reference.execution.result.outcomes[filter]; assert(base);
    if (o.status === 'EMPTY' || base.status === 'EMPTY') { assert.equal(o.status, base.status); continue; }
    quality.push({ commandId: c.commandId, policy: c.policy, repeat: c.repeat, filter,
      referenceBackend: base.primaryResolved, candidateBackend: o.primaryResolved, ...qualityDifference(base, o),
      interpretation: 'Actual E2E final-quality difference; primary seed is not fixed in these calls' });
  }
}
const medians = [], timing = {};
for (const task of plan.tasks) for (const policy of new Set(task.calls.map(c => c.policy))) {
  const a = pairs.filter(p => p.commandId === task.command.id && p.policy === policy);
  const complete = a.every(p => p.deltaMs !== null);
  medians.push({ commandId: task.command.id, population: task.command.population, policy, expectedPairs: a.length,
    completedPairs: a.filter(p => p.deltaMs !== null).length, complete,
    referenceMs: complete ? median(a.map(p => p.referenceMs)) : null, candidateMs: complete ? median(a.map(p => p.candidateMs)) : null });
}
for (const population of new Set(medians.map(r => r.population))) for (const policy of new Set(medians.map(r => r.policy))) {
  const all = medians.filter(r => r.population === population && r.policy === policy), done = all.filter(r => r.complete);
  timing[population + ':' + policy] = { expectedCommands: all.length, completeCommands: done.length,
    reference: distribution(done.map(r => r.referenceMs)), candidate: distribution(done.map(r => r.candidateMs)),
    delta: distribution(done.map(r => r.candidateMs - r.referenceMs)) };
}
fs.mkdirSync(output, { recursive: false });
const write = (file, value) => fs.writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const status = failures.length ? 'INVALID' : missing.length ? 'INCOMPLETE_CAPTURE_CENSORING' : 'COMPLETE';
write('SUMMARY.json', { study: plan.study, runId: lock.runId, scheduleHash: lock.scheduleHash, status, failures, checks,
  expectedE2E: scheduled.size, observedE2E: records.size, allStatuses, missing, timing,
  qualityCounts: Object.fromEntries([...new Set(quality.map(q => q.policy))].map(p => [p,
    Object.fromEntries(['EQUAL', 'BETTER', 'WORSE'].map(r => [r, quality.filter(q => q.policy === p && q.relation === r).length]))])),
  interpretation: 'Development bottleneck screen. Same-seed equivalence is a refactor contract, not an E2E seed constraint. No full-population/holdout or automatic winner claim.' });
write('pairs.json', pairs); write('command-medians.json', medians); write('quality.json', quality); write('replays.json', replayDetails);
await seal(output, { runId: lock.runId, study: plan.study, phase: 'analysis' });
const message = `## Refine screen: ${status}\n${records.size}/${scheduled.size} E2E records; ${checks.finalWitnesses} witnesses verified; fixed-seed ${checks.sameSeedPass} PASS / ${checks.sameSeedCensored} censored.\n${failures.map(f => JSON.stringify(f)).join('\n') || 'E2E seed/quality changes are observations. Evidence completion is not a performance win.'}`;
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
if (failures.length) process.exitCode = 1;
