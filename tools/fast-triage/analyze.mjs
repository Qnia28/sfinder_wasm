// Offline post-run analysis. Input is download-results.mjs --full output.
// Original vectors/rows are read only here, outside every timed solver call.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { gunzipSync } from 'node:zlib';
import { verifySnapshot } from '../secondary-bench/common/evidence.mjs';
import { hash } from '../secondary-bench/contracts.mjs';
import { digest } from '../fast-bench/planner.mjs';
import { distribution, median, qualityDifference } from './analysis.mjs';
const [root, output] = process.argv.slice(2);
assert(root && output, 'usage: node tools/fast-triage/analyze.mjs FULL_DOWNLOAD_DIR NEW_OUTPUT_DIR');
const directories = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(root, e.name));
const unique = prefix => { const found = directories.filter(d => path.basename(d).startsWith(prefix)); assert.equal(found.length, 1, prefix); return found[0]; };
const index = unique('fast-analysis-index-'); verifySnapshot(index);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const plan = read(path.join(index, 'PLAN.json')), audit = read(path.join(index, 'AUDIT.json'));
assert.equal(plan.study, 'fast-triage-e2e-20261017');
assert.equal(digest(plan.schedule), audit.scheduleHash);
const rows = gunzipSync(fs.readFileSync(path.join(index, 'calls.jsonl.gz'))).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
assert.equal(rows.length, audit.observed);
const observed = new Map(rows.map(r => [r.callId, r])); assert.equal(observed.size, rows.length);
const schedule = new Map(plan.schedule.map(c => [c.callId, c]));
const commands = new Map(plan.chunks.flatMap(c => c.tasks.map(t => [t.command.id, t.command])));
const byBlock = new Map();
for (const call of plan.schedule) {
  const key = JSON.stringify([call.commandId, call.phase, call.repeat, call.diagnostics]);
  if (!byBlock.has(key)) byBlock.set(key, new Map());
  byBlock.get(key).set(call.arm, { ...call, ...observed.get(call.callId), status: observed.get(call.callId)?.status ?? 'MISSING' });
}
const completed = r => r?.status.startsWith('RETURNED');
const pairs = [];
for (const block of byBlock.values()) {
  const base = block.get('BASE100');
  for (const [arm, r] of block) if (arm !== 'BASE100') pairs.push({ commandId: r.commandId,
    population: commands.get(r.commandId).population, mirrorGroup: commands.get(r.commandId).mirrorGroup,
    arm, phase: r.phase, repeat: r.repeat, diagnostics: r.diagnostics,
    baseCallId: base.callId, callId: r.callId, baselineStatus: base.status, candidateStatus: r.status,
    baselineMs: completed(base) ? base.policyMs : null, candidateMs: completed(r) ? r.policyMs : null,
    deltaMs: completed(base) && completed(r) ? r.policyMs - base.policyMs : null,
    baselineApiMs: completed(base) ? base.apiMs : null, candidateApiMs: completed(r) ? r.apiMs : null,
    baselinePeakBytes: base.memoryScope?.peakBytes ?? null, candidatePeakBytes: r.memoryScope?.peakBytes ?? null });
}
// Read immutable raw checkpoints twice, retaining only BASE witnesses between passes.
const deltas = audit.artifactIndex.map(ref => {
  const dir = path.join(root, ref.name + '-' + ref.id);
  assert.equal(verifySnapshot(dir).checkpointId, ref.checkpointId);
  return path.join(dir, 'raw.jsonl');
}).filter(p => fs.existsSync(p));
async function* raw() {
  for (const file of deltas) for await (const line of createInterface({ input: fs.createReadStream(file) })) {
    if (!line.trim()) continue;
    const r = JSON.parse(line); if (schedule.has(r.callId)) yield r;
  }
}
const bases = new Map(), rawSeen = new Set();
for await (const r of raw()) {
  assert(!rawSeen.has(r.callId), 'duplicate raw evidence'); rawSeen.add(r.callId);
  if (r.arm === 'BASE100' && r.execution.result?.outcomes) bases.set(r.callId, r.execution.result.outcomes);
}
for (const r of rows.filter(completed)) assert(rawSeen.has(r.callId), 'missing completed raw evidence');
const pairByCall = new Map(pairs.map(p => [p.callId, p]));
const fixtures = new Map(plan.selection.main.map(f => [f.id, f]));
let cachedId, cachedFixture;
function fixtureFor(commandId, filter) {
  const id = commandId + '/' + filter;
  if (cachedId === id) return cachedFixture;
  const ref = fixtures.get(id); assert(ref, 'missing captured fixture ' + id);
  const dir = path.join(root, ref.inputArtifact.name + '-' + ref.inputArtifact.id);
  const bytes = fs.readFileSync(path.join(dir, ref.member)); assert.equal(hash(bytes), ref.sha256);
  cachedId = id; cachedFixture = JSON.parse(gunzipSync(bytes)); return cachedFixture;
}
fs.mkdirSync(output, { recursive: false });
const qualityFile = fs.openSync(path.join(output, 'quality-pairs.jsonl'), 'wx');
const losses = [], proofLosses = [], qualityCounts = {};
try {
  for await (const r of raw()) {
    const pair = pairByCall.get(r.callId), base = pair && bases.get(pair.baseCallId);
    if (!pair || !base || !completed(observed.get(r.callId))) continue;
    for (const [filter, candidate] of Object.entries(r.execution.result.outcomes)) {
      const b = base[filter]; assert(b);
      if (b.status === 'EMPTY' || candidate.status === 'EMPTY') { assert.equal(b.status, candidate.status); continue; }
      const diff = qualityDifference(b, candidate, fixtureFor(pair.commandId, filter));
      const row = { commandId: pair.commandId, population: pair.population, arm: pair.arm, phase: pair.phase,
        repeat: pair.repeat, diagnostics: pair.diagnostics, callId: pair.callId, baseCallId: pair.baseCallId,
        filter, features: fixtures.get(pair.commandId + '/' + filter).features, ...diff };
      fs.writeSync(qualityFile, JSON.stringify(row) + '\n');
      if (pair.phase === 'e2e') {
        const key = [pair.population, pair.arm, diff.relation].join(':'); qualityCounts[key] = (qualityCounts[key] ?? 0) + 1;
        if (diff.relation === 'WORSE') losses.push(row);
        if (diff.proofLost) proofLosses.push(row);
      }
    }
  }
} finally { fs.closeSync(qualityFile); }
const groups = new Map();
for (const p of pairs.filter(p => p.phase === 'e2e')) {
  const key = [p.commandId, p.arm].join(':');
  if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p);
}
const medians = [...groups.values()].map(rs => ({ commandId: rs[0].commandId, arm: rs[0].arm,
  population: rs[0].population, mirrorGroup: rs[0].mirrorGroup,
  complete3: rs.length === 3 && rs.every(r => r.deltaMs !== null),
  baselineMs: rs.every(r => r.baselineMs !== null) ? median(rs.map(r => r.baselineMs)) : null,
  candidateMs: rs.every(r => r.candidateMs !== null) ? median(rs.map(r => r.candidateMs)) : null,
})).map(r => ({ ...r, deltaMs: r.complete3 ? r.candidateMs - r.baselineMs : null }));
const timing = {};
for (const population of new Set(medians.map(r => r.population))) for (const arm of new Set(medians.map(r => r.arm))) {
  const all = medians.filter(r => r.population === population && r.arm === arm), valid = all.filter(r => r.complete3);
  timing[population + ':' + arm] = { expectedCommands: all.length, pairedComplete3: valid.length,
    missingOrCensored: all.length - valid.length, baseline: distribution(valid.map(r => r.baselineMs)),
    candidate: distribution(valid.map(r => r.candidateMs)), delta: distribution(valid.map(r => r.deltaMs)),
    slowerCommands: valid.filter(r => r.deltaMs > 0).length,
    worst: [...valid].sort((a, b) => b.deltaMs - a.deltaMs).slice(0, 20) };
}
const trace = new Map();
for (const r of rows.filter(r => r.phase === 'trace')) {
  const key = [r.commandId, r.arm, r.repeat].join(':');
  if (!trace.has(key)) trace.set(key, new Map()); trace.get(key).set(r.diagnostics, r);
}
const overhead = [...trace].flatMap(([key, modes]) => ['timing', 'trace'].map(mode => {
  const off = modes.get(false), on = modes.get(mode), valid = completed(off) && completed(on);
  return { key, mode, offCallId: off?.callId, onCallId: on?.callId, offStatus: off?.status ?? 'MISSING', onStatus: on?.status ?? 'MISSING',
    deltaMs: valid ? on.policyMs - off.policyMs : null,
    screenExceeded: valid ? on.policyMs - off.policyMs > Math.max(5, .05 * off.policyMs) : null };
}));
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const stageStats = new Map(), filterTimings = [];
for (const r of rows.filter(r => r.phase === 'e2e' && completed(r))) {
  const population = commands.get(r.commandId).population;
  for (const [filter, outcome] of Object.entries(r.outcomes ?? {})) {
    const telemetry = outcome.fastTelemetry;
    filterTimings.push({ callId: r.callId, commandId: r.commandId, population, arm: r.arm, repeat: r.repeat,
      filter, qualityExact: outcome.qualityExact, fastDecision: outcome.fastDecision,
      bypass: outcome.fastBypass, selection: telemetry?.selection ?? null,
      appliedBudgets: telemetry?.appliedBudgets ?? null, stages: telemetry?.stages ?? null });
    for (const stage of telemetry?.stages ?? []) {
      const key = [population, r.arm, stage.name].join(':');
      if (!stageStats.has(key)) stageStats.set(key, []); stageStats.get(key).push(stage.ms);
    }
  }
}
write('filter-timings.json', filterTimings);
write('pairs.json', pairs); write('command-medians.json', medians); write('diagnostic-overhead.json', overhead);
write('SUMMARY.json', { schema: 1, runId: audit.runId, scheduleHash: audit.scheduleHash,
  collectionStatus: audit.status, expected: audit.expected, observed: audit.observed, missing: audit.missing,
  statuses: audit.statuses, timing, filterStageCosts: Object.fromEntries([...stageStats].map(([k, v]) => [k, distribution(v)])),
  qualityCounts, losses, proofLosses,
  interpretation: 'Historical development replay. Complete-pair timing has censoring/selection bias. Quality counts are filter-call counts, not unique inputs. No overhead subtraction, acceptance threshold or winner inferred. See retained trace seeds and original rows for seed follow-up.' });
console.log(JSON.stringify({ collectionStatus: audit.status, pairedCalls: pairs.length, qualityLossCalls: losses.length, proofLossCalls: proofLosses.length }));
