// Read-only reconciliation and original-row reanalysis. No solver is invoked.
// node --max-old-space-size=8192 tools/fast-routing/analyze-results.mjs RESULTS_ROOT NEW_OUTPUT
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { distribution, median } from '../fast-triage/analysis.mjs';
import { verifyRoutingTelemetry } from './verify.mjs';

const [root, output] = process.argv.slice(2);
assert(root && output);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const sha = b => createHash('sha256').update(b).digest('hex');
const digest = v => sha(JSON.stringify(v));
const manifestPath = fileURLToPath(new URL('./CONTINUATION_39030155561.json', import.meta.url));
const manifest = read(manifestPath);
const planPath = path.join(root, 'fast-routing-review-39026013968/control/plan/PLAN.json');
const plan = read(planPath);
const budgetPath = path.join(root, 'fast-routing-review-39026013968/BUDGET_FINAL.json');
const budget = read(budgetPath);
assert.equal(digest(plan.schedule), manifest.scheduleHash);
assert.equal(plan.schedule.length, 25081);
const schedule = new Map(plan.schedule.map(c => [c.callId, c]));
const tasks = plan.chunks.flatMap(c => c.tasks.map(t => ({ ...t, shard: c.index })));
const commandSource = new Map(manifest.retainedCommands.map(id => [id, '39026013968']));
for (const t of manifest.additionalRetainedCommands) { assert(!commandSource.has(t.commandId)); commandSource.set(t.commandId, '39030155561'); }
const resume = new Set(manifest.chunks.flatMap(c => c.callIds));
for (const t of tasks) if (resume.has(t.calls[0].callId)) {
  assert(t.calls.every(c => resume.has(c.callId))); assert(!commandSource.has(t.command.id)); commandSource.set(t.command.id, '39030482572');
}
assert.equal(commandSource.size, 1113);
for (const id of manifest.previousContinuationUnknown) assert(resume.has(id), 'UNKNOWN must be remeasured');
fs.mkdirSync(output, { recursive: false });
const writers = new Map();
function emit(name, row) {
  if (!writers.has(name)) writers.set(name, fs.openSync(path.join(output, name + '.jsonl'), 'wx'));
  fs.writeSync(writers.get(name), JSON.stringify(row) + '\n');
}
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const count = (o, key) => { o[key] = (o[key] ?? 0) + 1; };
const files = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
// Retain byte offsets into immutable raw evidence, rather than all quality vectors in RAM.
async function* lines(file) {
  let pending = Buffer.alloc(0), offset = 0;
  for await (const chunk of fs.createReadStream(file)) {
    const b = Buffer.concat([pending, chunk]); let start = 0, end;
    while ((end = b.indexOf(10, start)) >= 0) {
      const line = b.subarray(start, end);
      if (line.length) yield { value: JSON.parse(line.toString()), offset: offset + start, length: line.length, hash: sha(line) };
      start = end + 1;
    }
    offset += start; pending = b.subarray(start);
  }
  if (pending.length) yield { value: JSON.parse(pending.toString()), offset, length: pending.length, hash: sha(pending) };
}
const runs = new Map(), sourceIndex = [];
for (const id of ['39026013968', '39030155561', '39030482572']) {
  const dir = path.join(root, `fast-routing-run-${id}${id === '39030155561' ? '-verified' : ''}`);
  const inventory = read(path.join(dir, `ARTIFACTS-${id}.json`));
  const run = { records: new Map(), raw: new Map(), starts: new Set(), environments: [] };
  runs.set(id, run);
  const add = r => {
    const c = schedule.get(r.callId); assert(c, 'foreign call');
    for (const k of ['commandId', 'phase', 'repeat', 'diagnostics', 'arm']) assert.deepEqual(r[k], c[k]);
    if (run.records.has(r.callId)) assert.deepEqual(run.records.get(r.callId), r, 'conflicting scalar');
    else run.records.set(r.callId, r);
  };
  for (const a of inventory.artifacts) {
    const ad = path.join(dir, a.name + '-' + a.id), receipt = read(ad + '.receipt.json');
    assert.equal(receipt.artifactId, a.id); assert.equal(receipt.backendDigest, a.digest);
    sourceIndex.push({ runId: id, artifactId: a.id, name: a.name, digest: a.digest, directory: ad,
      receiptSha256: sha(fs.readFileSync(ad + '.receipt.json')), sealed: receipt.sealed });
    if (!/(measure|resume)/.test(a.name) || a.name.includes('measurement-plan')) continue;
    for (const f of files(ad)) {
      const name = path.basename(f);
      if (name === 'SUMMARY.json') {
        const s = read(f); if (!s.records) continue;
        if (s.mode && s.mode !== 'measure') continue;
        assert.equal(s.runId, id);
        if (id === '39030482572') { assert.equal(s.stopped, null); assert.equal(s.sourceCommit, manifest.sourceCommit); }
        for (const r of s.records) add(r);
        if (s.environment) run.environments.push(s.environment);
      }
      if (!['raw.jsonl', 'records.jsonl', 'starts.jsonl', 'environment.jsonl'].includes(name)) continue;
      for await (const line of lines(f)) {
        const r = line.value;
        if (name === 'environment.jsonl') { run.environments.push(r); continue; }
        if (!schedule.has(r.callId)) continue;
        if (name === 'records.jsonl') add(r);
        if (name === 'starts.jsonl') run.starts.add(r.callId);
        if (name === 'raw.jsonl') {
          const ref = { file: f, offset: line.offset, length: line.length, sha256: line.hash };
          if (run.raw.has(r.callId)) assert.equal(run.raw.get(r.callId).sha256, ref.sha256, 'conflicting raw');
          else run.raw.set(r.callId, ref);
        }
      }
    }
  }
  const statuses = {};
  for (const r of run.records.values()) {
    count(statuses, r.status);
    emit('attempts', { runId: id, callId: r.callId, commandId: r.commandId, status: r.status, reaped: r.reaped,
      selected: commandSource.get(r.commandId) === id, raw: run.raw.get(r.callId) ?? null });
  }
  for (const callId of run.starts) if (!run.records.has(callId)) emit('attempts', { runId: id, callId,
    commandId: schedule.get(callId).commandId, status: 'UNKNOWN', selected: false, raw: run.raw.get(callId) ?? null });
  run.statuses = statuses;
  for (const env of run.environments) {
    assert.equal(env.node, plan.lock.node); assert.equal(env.sourceCommit ?? env.commit, manifest.sourceCommit);
  }
  console.log('INDEXED', id, JSON.stringify({ records: run.records.size, raw: run.raw.size, starts: run.starts.size, statuses }));
}
function rawAt(ref) {
  assert(ref, 'missing raw'); const fd = fs.openSync(ref.file, 'r'), b = Buffer.alloc(ref.length);
  try { assert.equal(fs.readSync(fd, b, 0, b.length, ref.offset), b.length); } finally { fs.closeSync(fd); }
  assert.equal(sha(b), ref.sha256); return JSON.parse(b.toString());
}
const selectedRows = [], pairs = [], qualityCounts = {}, qualityLosses = [], stages = new Map(), featureGroups = new Map();
const audit = { expected: 25081, selected: 0, starts: 0, raw: 0, finalWitnesses: 0, traceWitnesses: 0, fixtures: 0,
  statuses: {}, phases: {}, sourceCalls: {}, sourceCommands: {}, unknownRemeasured: [], runtime: plan.lock.node,
  sourceCommit: manifest.sourceCommit, scheduleHash: manifest.scheduleHash };
const push = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
const bucket = (value, edges) => { const hi = edges.find(e => value < e); return hi === undefined ? `>=${edges.at(-1)}` : `<${hi}`; };
for (const task of tasks) {
  const command = task.command, runId = commandSource.get(command.id), run = runs.get(runId);
  count(audit.sourceCommands, runId);
  const fixtures = new Map(), outcomesByCall = new Map(), rowsByCall = new Map();
  for (const f of task.capture.result.filters) {
    if (f.status === 'EMPTY') { fixtures.set(f.filter, { empty: true }); continue; }
    const a = task.capture.inputArtifact;
    const file = path.join(root, 'fast-routing-run-39026013968', a.name + '-' + a.id, f.member);
    const bytes = fs.readFileSync(file); assert.equal(sha(bytes), f.sha256);
    const fixture = JSON.parse(gunzipSync(bytes));
    assert.equal(fixture.K, f.K); assert.equal(fixture.cardinalityProof.status, 'PROVEN');
    const S = fixture.keys.length, N = fixture.rows.length, E = fixture.rows.reduce((n, r) => n + r.length, 0);
    const F = new Set(fixture.rows.filter(r => r.length === 1).map(r => r[0][0])).size;
    const features = { S, K: fixture.K, F, u: S - F, d: fixture.K - F, N, E, density: N && S ? E / (N * S) : 0 };
    for (const k of ['S', 'N', 'E', 'F', 'u', 'd']) assert.equal(features[k], f.features[k]);
    const context = { fixture, features, ids: new Map(fixture.keys.map((key, i) => [key, i])), cache: new Map() };
    fixtures.set(f.filter, context); audit.fixtures++;
    emit('features', { commandId: command.id, population: command.population, mirrorGroup: command.mirrorGroup, filter: f.filter,
      ...features, primaryHard: f.primaryHard, cardinalityProof: f.cardinalityProof, source: file, sha256: f.sha256 });
  }
  function witness(ctx, keys, expected) {
    assert.equal(keys.length, ctx.fixture.K); const key = digest([...keys].sort());
    if (!ctx.cache.has(key)) {
      const chosen = new Uint8Array(ctx.features.S); let n = 0;
      for (const k of keys) { const i = ctx.ids.get(k); assert(i !== undefined && !chosen[i]); chosen[i] = 1; n++; }
      assert.equal(n, ctx.fixture.K);
      const rows = ctx.fixture.rows.map(row => { let best = 0; for (const [id, q] of row) if (chosen[id] && q > best) best = q; assert(best > 0, 'uncovered row'); return best; });
      const sorted = [...rows].sort((a, b) => a - b);
      ctx.cache.set(key, { rows, sorted, keysHash: key, qualityHash: digest(sorted) });
    }
    const w = ctx.cache.get(key); if (expected) assert.deepEqual(w.sorted, expected); return w;
  }
  for (const call of task.calls) {
    const r = run.records.get(call.callId); assert(r, 'missing selected terminal'); assert.equal(r.reaped, true);
    assert(/^(RETURNED_|TIMEOUT_)/.test(r.status) || ['OOM', 'NOT_RUN_AFTER_OOM', 'NOT_RUN_CAPTURE_MISSING'].includes(r.status), 'invalid selected status');
    const ref = run.raw.get(call.callId), raw = ref ? rawAt(ref) : null;
    if (!r.status.startsWith('NOT_RUN')) { assert(raw); assert(run.starts.has(call.callId), 'missing start evidence'); audit.starts++; }
    if (raw) {
      audit.raw++; assert.equal(raw.execution.status, r.status); assert.equal(raw.execution.reaped, r.reaped);
      assert.equal(raw.execution.memoryScope.memoryMax, 3 * 1024 ** 3); assert.equal(raw.execution.memoryScope.swapMax, 0);
      assert.equal(raw.job.arm, call.arm); assert.equal(raw.job.diagnostics, call.diagnostics); assert.equal(raw.job.command.id, call.commandId);
    }
    audit.selected++; count(audit.statuses, r.status); count(audit.phases, call.phase); count(audit.sourceCalls, runId);
    if (manifest.previousContinuationUnknown.includes(call.callId)) {
      assert.equal(runId, '39030482572'); assert(raw && /^RETURNED_|^TIMEOUT_|^OOM$/.test(r.status));
      audit.unknownRemeasured.push({ callId: call.callId, commandId: command.id, runId, status: r.status, raw: ref });
    }
    const result = raw?.execution.result, returned = r.status.startsWith('RETURNED');
    const scalar = { ...call, executionRunId: runId, shard: task.shard, population: command.population, mirrorGroup: command.mirrorGroup,
      status: r.status, reaped: r.reaped, policyMs: returned ? result.policyMs : null, apiMs: returned ? result.apiMs : null,
      wallMs: r.wallMs, peakBytes: r.memoryScope?.peakBytes ?? null, raw: ref };
    if (returned) {
      assert.equal(result.policyMs, r.policyMs); assert.equal(result.apiMs, r.apiMs);
      const outs = new Map();
      assert.deepEqual(Object.keys(result.outcomes).sort(), [...fixtures.keys()].sort());
      for (const [filter, o] of Object.entries(result.outcomes)) {
        const ctx = fixtures.get(filter); assert(ctx);
        if (ctx.empty) { assert.equal(o.status, 'EMPTY'); outs.set(filter, { empty: true }); continue; }
        assert.equal(o.K, ctx.fixture.K); assert.equal(o.witnessAudit, 'PASS');
        assert.deepEqual(o.selected, o.keys.map(k => ctx.ids.get(k)));
        const w = witness(ctx, o.keys, o.qualityVector); audit.finalWitnesses++;
        verifyRoutingTelemetry(ctx.fixture, o, call.arm, call.diagnostics);
        const t = o.fastTelemetry;
        const stageMs = Object.fromEntries((t?.stages ?? []).map(s => [s.name, s.ms]));
        const filterRow = { callId: call.callId, commandId: command.id, population: command.population, filter, arm: call.arm,
          phase: call.phase, repeat: call.repeat, diagnostics: call.diagnostics, executionRunId: runId, features: ctx.features,
          selection: t?.selection ?? null, appliedBudgets: t?.appliedBudgets ?? null, stageMs, totalFastMs: t?.totalMs ?? null,
          stages: t?.stages.map(({ keys, inputKeys, qualityVector, ...s }) => s) ?? null,
          passes: o.qualityRefinementPasses, fastDecision: o.fastDecision, bypass: o.fastBypass,
          qualityBackend: o.qualityBackend, cardinalityBackend: o.cardinalityBackend, qualityExact: o.qualityExact,
          keysHash: w.keysHash, qualityHash: w.qualityHash, primarySeedIdentity: o.primarySeedIdentity };
        emit('filter-results', filterRow);
        if (call.phase === 'e2e') {
          for (const [name, ms] of Object.entries(stageMs)) push(stages, [command.population, call.arm, name].join(':'), ms);
          for (const [name, edges] of Object.entries({ S: [50, 100, 200, 400], K: [8, 16, 32, 64], F: [1, 8, 32, 64], u: [64, 128, 192, 384], d: [1, 4, 8, 16, 32] })) {
            const key = [command.population, call.arm, name, bucket(ctx.features[name], edges)].join(':');
            if (!featureGroups.has(key)) featureGroups.set(key, { calls: 0, probeMs: [], refineMs: [], passes: [] });
            const g = featureGroups.get(key); g.calls++; g.probeMs.push(['preview', 'integrated', 'grace'].reduce((n, s) => n + (stageMs[s] ?? 0), 0));
            g.refineMs.push(stageMs.refine ?? 0); if (Number.isFinite(o.qualityRefinementPasses)) g.passes.push(o.qualityRefinementPasses);
          }
        }
        if (call.diagnostics === 'trace' && t) {
          const traceStages = [];
          for (const s of t.stages) {
            const item = { ...s };
            for (const prop of ['inputKeys', 'keys']) if (s[prop]) {
              const sw = witness(ctx, s[prop], prop === 'keys' ? s.qualityVector : null); audit.traceWitnesses++;
              item[prop + 'Hash'] = sw.keysHash; item[prop + 'QualityHash'] = sw.qualityHash;
            }
            traceStages.push(item);
          }
          emit('trace-seeds', { ...filterRow, stages: traceStages });
        }
        outs.set(filter, { ...w, exact: o.qualityExact, stageMs, features: ctx.features, seed: o.primarySeedIdentity });
      }
      outcomesByCall.set(call.callId, outs);
    }
    selectedRows.push(scalar); rowsByCall.set(call.callId, scalar); emit('selected-calls', scalar);
  }
  const blocks = new Map();
  for (const call of task.calls) {
    const key = JSON.stringify([call.phase, call.repeat, call.diagnostics]);
    if (!blocks.has(key)) blocks.set(key, new Map()); blocks.get(key).set(call.arm, rowsByCall.get(call.callId));
  }
  for (const block of blocks.values()) for (const baseline of ['BASE100', 'DIRECT']) {
    const b = block.get(baseline); assert(b);
    for (const [arm, c] of block) {
      if (arm === baseline) continue;
      const valid = b.policyMs !== null && c.policyMs !== null;
      const pair = { commandId: command.id, population: command.population, mirrorGroup: command.mirrorGroup, executionRunId: runId,
        baseline, arm, phase: c.phase, repeat: c.repeat, diagnostics: c.diagnostics, baselineCallId: b.callId, callId: c.callId,
        baselineStatus: b.status, candidateStatus: c.status, baselineMs: b.policyMs, candidateMs: c.policyMs,
        deltaMs: valid ? c.policyMs - b.policyMs : null, baselineApiMs: b.apiMs, candidateApiMs: c.apiMs,
        quality: { BETTER: 0, EQUAL: 0, WORSE: 0 }, lowerRows: 0, higherRows: 0 };
      if (valid) for (const [filter, co] of outcomesByCall.get(c.callId)) {
        const bo = outcomesByCall.get(b.callId).get(filter); assert(bo);
        if (co.empty || bo.empty) { assert(co.empty && bo.empty); continue; }
        let first = -1, lowerRows = 0, higherRows = 0, lowerMagnitude = 0, higherMagnitude = 0;
        for (let i = 0; i < co.sorted.length; i++) {
          if (first < 0 && co.sorted[i] !== bo.sorted[i]) first = i;
          const diff = co.rows[i] - bo.rows[i];
          if (diff < 0) { lowerRows++; lowerMagnitude -= diff; }
          if (diff > 0) { higherRows++; higherMagnitude += diff; }
        }
        const relation = first < 0 ? 'EQUAL' : co.sorted[first] > bo.sorted[first] ? 'BETTER' : 'WORSE';
        pair.quality[relation]++; pair.lowerRows += lowerRows; pair.higherRows += higherRows;
        const q = { commandId: command.id, population: command.population, baseline, arm, phase: c.phase, repeat: c.repeat,
          diagnostics: c.diagnostics, filter, callId: c.callId, baselineCallId: b.callId, features: co.features, relation,
          firstSortedDifference: first < 0 ? null : first, baselineAtDifference: first < 0 ? null : bo.sorted[first],
          candidateAtDifference: first < 0 ? null : co.sorted[first], lowerRows, higherRows, lowerMagnitude, higherMagnitude,
          proofLost: bo.exact && !co.exact, proofGained: !bo.exact && co.exact,
          samePrimarySeed: co.seed === 'UNOBSERVED_PRODUCT_API' || bo.seed === 'UNOBSERVED_PRODUCT_API' ? null : co.seed === bo.seed,
          probeDeltaMs: ['preview', 'integrated', 'grace'].reduce((n, s) => n + (co.stageMs[s] ?? 0) - (bo.stageMs[s] ?? 0), 0),
          refineDeltaMs: (co.stageMs.refine ?? 0) - (bo.stageMs.refine ?? 0) };
        emit('quality-pairs', q); count(qualityCounts, [baseline, c.phase, command.population, arm, relation].join(':'));
        if (relation === 'WORSE' && c.phase === 'e2e') qualityLosses.push(q);
      }
      pairs.push(pair); emit('pairs', pair);
    }
  }
  if (audit.sourceCommands[runId] % 100 === 0) console.log('VERIFIED', audit.selected, 'calls;', audit.finalWitnesses, 'witnesses');
}
assert.equal(audit.selected, 25081); assert.equal(audit.unknownRemeasured.length, 8);
assert.deepEqual(audit.phases, { e2e: 23373, 'long-repeat': 364, trace: 1344 });
const timing = {};
for (const phase of ['e2e', 'long-repeat', 'trace']) for (const population of ['ALL', 'per-save', 'edge', 'regression']) for (const arm of ['BASE100', 'DIRECT', 'PREVIEW_ONLY', 'I1K', 'I10K', 'S200_OR_D16', 'U192_OR_D16']) for (const diagnostics of phase === 'trace' ? [false, 'timing', 'trace'] : ['timing']) {
  const rows = selectedRows.filter(r => r.phase === phase && r.population === population && r.arm === arm && r.diagnostics === diagnostics);
  if (!rows.length) continue;
  const statuses = {}; for (const r of rows) count(statuses, r.status);
  const done = rows.filter(r => r.policyMs !== null);
  timing[[phase, population, arm, ...(phase === 'trace' ? [diagnostics] : [])].join(':')] = { expected: rows.length, returned: done.length, statuses,
    policyMs: distribution(done.map(r => r.policyMs)), apiMs: distribution(done.map(r => r.apiMs)),
    wallMs: distribution(rows.filter(r => Number.isFinite(r.wallMs)).map(r => r.wallMs)),
    peakBytes: distribution(rows.filter(r => Number.isFinite(r.peakBytes)).map(r => r.peakBytes)),
    worst: [...done].sort((a, b) => b.policyMs - a.policyMs).slice(0, 10).map(r => ({ callId: r.callId, commandId: r.commandId, policyMs: r.policyMs })) };
}
const groups = new Map();
for (const p of pairs.filter(p => p.phase !== 'trace')) push(groups, [p.baseline, p.arm, p.phase, p.commandId].join('|'), p);
const medians = [...groups.values()].map(ps => {
  const p = ps[0], expected = p.phase === 'e2e' ? 3 : 4;
  const complete = ps.length === expected && ps.every(r => r.deltaMs !== null);
  const baselineMs = complete ? median(ps.map(r => r.baselineMs)) : null, candidateMs = complete ? median(ps.map(r => r.candidateMs)) : null;
  return { commandId: p.commandId, population: p.population, mirrorGroup: p.mirrorGroup, baseline: p.baseline, arm: p.arm,
    phase: p.phase, complete, baselineMs, candidateMs, deltaMs: complete ? candidateMs - baselineMs : null,
    qualityWorseCalls: ps.filter(p => p.quality.WORSE > 0).length, qualityBetterCalls: ps.filter(p => p.quality.BETTER > 0).length };
});
for (const m of medians) emit('command-medians', m);
const comparisons = {};
const callComparisons = {}, pairGroups = new Map();
for (const p of pairs) push(pairGroups, [p.baseline, p.phase, p.population, p.arm, p.diagnostics].join(':'), p);
for (const [key, all] of pairGroups) {
  const valid = all.filter(p => p.deltaMs !== null);
  callComparisons[key] = { expected: all.length, complete: valid.length, faster: valid.filter(p => p.deltaMs < 0).length,
    slower: valid.filter(p => p.deltaMs > 0).length, deltaMs: distribution(valid.map(p => p.deltaMs)),
    qualityWorseCalls: valid.filter(p => p.quality.WORSE > 0).length, qualityBetterCalls: valid.filter(p => p.quality.BETTER > 0).length };
}
const comparisonGroups = new Map();
for (const m of medians) push(comparisonGroups, [m.baseline, m.phase, m.population, m.arm].join(':'), m);
for (const [key, all] of comparisonGroups) {
  const ms = all.filter(m => m.complete), bs = distribution(ms.map(m => m.baselineMs)), cs = distribution(ms.map(m => m.candidateMs));
  comparisons[key] = { expectedCommands: all.length, completeCommands: ms.length, baseline: bs, candidate: cs,
    totalMedianChangePercent: bs.sum ? (cs.sum / bs.sum - 1) * 100 : null,
    delta: distribution(ms.map(m => m.deltaMs)), faster: ms.filter(m => m.deltaMs < 0).length,
    slower: ms.filter(m => m.deltaMs > 0).length, qualityWorseCommands: all.filter(m => m.qualityWorseCalls > 0).length,
    qualityBetterCommands: all.filter(m => m.qualityBetterCalls > 0).length,
    worst: [...ms].sort((a, b) => b.deltaMs - a.deltaMs).slice(0, 15), best: [...ms].sort((a, b) => a.deltaMs - b.deltaMs).slice(0, 15) };
}
const diagnostics = new Map();
for (const r of selectedRows.filter(r => r.phase === 'trace')) {
  const key = JSON.stringify([r.commandId, r.arm, r.repeat]);
  if (!diagnostics.has(key)) diagnostics.set(key, new Map()); diagnostics.get(key).set(r.diagnostics, r);
}
const overhead = [];
for (const modes of diagnostics.values()) for (const mode of ['timing', 'trace']) {
  const off = modes.get(false), on = modes.get(mode), valid = off.policyMs !== null && on.policyMs !== null;
  const row = { commandId: off.commandId, population: off.population, arm: off.arm, repeat: off.repeat, mode,
    offCallId: off.callId, onCallId: on.callId, offStatus: off.status, onStatus: on.status,
    offMs: off.policyMs, onMs: on.policyMs, deltaMs: valid ? on.policyMs - off.policyMs : null };
  overhead.push(row); emit('diagnostic-pairs', row);
}
const statusByRun = Object.fromEntries([...runs].map(([id, r]) => [id, { statuses: r.statuses, raw: r.raw.size, starts: r.starts.size,
  unknownStarted: [...r.starts].filter(id => !r.records.has(id)), environments: r.environments }]));
write('AUDIT.json', { schema: 1, attributionLabel: 'GLM', ...audit, statusByRun,
  collectionStatus: 'COMPLETE', executionValidity: 'K/coverage/quality/start/raw/terminal PASS; censored outcomes preserved',
  sourceManifestSha256: sha(fs.readFileSync(manifestPath)), planSha256: sha(fs.readFileSync(planPath)) });
write('SOURCE_INDEX.json', sourceIndex);
write('BUDGET.json', { ...budget, sourceSha256: sha(fs.readFileSync(budgetPath)) });
write('SUMMARY.json', { schema: 1, attributionLabel: 'GLM', audit, timing, comparisons, callComparisons, qualityCounts,
  qualityLossFilterCalls: qualityLosses.length,
  stageCosts: Object.fromEntries([...stages].map(([k, v]) => [k, distribution(v)])),
  featureStageCosts: Object.fromEntries([...featureGroups].map(([k, v]) => [k, { calls: v.calls, probeMs: distribution(v.probeMs), refineMs: distribution(v.refineMs), passes: distribution(v.passes) }])),
  diagnosticDifferences: Object.fromEntries(['timing', 'trace'].map(mode => [mode, distribution(overhead.filter(r => r.mode === mode && r.deltaMs !== null).map(r => r.deltaMs))])),
  interpretation: 'Historical development population; dependent repeats/filters/mirrors. Timing includes measured instrumentation, never subtract diagnostic differences. Complete-pair distributions retain censored denominators. Quality is relative to measured BASE100/DIRECT, not a global optimum. No policy winner or quality tolerance adopted.' });
for (const [name, fd] of writers) { fs.closeSync(fd); console.log('WROTE', name); }
const hashes = [];
for (const f of fs.readdirSync(output)) {
  const h = createHash('sha256'), p = path.join(output, f); for await (const b of fs.createReadStream(p)) h.update(b);
  hashes.push({ path: f, bytes: fs.statSync(p).size, sha256: h.digest('hex') });
}
write('MANIFEST.json', { schema: 1, files: hashes, analysisScriptSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))) });
console.log(JSON.stringify(audit));
