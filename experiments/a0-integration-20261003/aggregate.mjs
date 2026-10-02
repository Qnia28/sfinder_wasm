import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, read, write, seal, sha, jsonSha, compare, unrle } from './common.mjs';
const [downloadArg, outputArg, phase] = process.argv.slice(2), downloads = path.resolve(downloadArg), output = path.resolve(outputArg);
const expected = read(path.join(HERE, 'SCHEDULE.json')).runs.filter(r => r.phase === phase);
const dirs = fs.readdirSync(downloads).filter(n => n.startsWith(`a0-${phase}-`)).map(n => path.join(downloads, n));
assert.equal(dirs.length, phase === 'smoke' ? 8 : 16);
const rows = [], shards = [];
for (const dir of dirs) {
  for (const f of read(path.join(dir, 'FILES.json')).files) { const bytes = fs.readFileSync(path.join(dir, f.file)); assert.equal(bytes.length, f.bytes); assert.equal(sha(bytes), f.sha256); }
  const s = read(path.join(dir, 'SHARD.json')); shards.push(s); assert.equal(s.phase, phase);
  const r = fs.readFileSync(path.join(dir, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.equal(r.length, s.observedRuns); rows.push(...r);
}
assert.equal(new Set(shards.map(s => s.shard)).size, dirs.length);
assert.equal(new Set(shards.map(s => jsonSha(s.build))).size, 1);
assert.equal(new Set(rows.map(r => r.runId)).size, rows.length);
const expectedIDs = new Set(expected.map(r => r.runId)); assert(rows.every(r => expectedIDs.has(r.runId)));
const failures = rows.filter(r => !['EXACT', 'INCONCLUSIVE'].includes(r.status));
const censored = rows.filter(r => r.status !== 'EXACT').map(r => ({ runId: r.runId, status: r.status, reason: r.reason }));
const byMatrix = new Map(); for (const row of rows) { if (!byMatrix.has(row.matrixId)) byMatrix.set(row.matrixId, []); byMatrix.get(row.matrixId).push(row); }
const determinismErrors = [], exactErrors = [], boundedQualityErrors = [], scopeErrors = [], stateErrors = [];
const median = a => { a = [...a].sort((a, b) => a - b); return (a[1] + a[2]) / 2; };
const metrics = [], probeCounts = { R: 0, A: 0 };
for (const [id, list] of byMatrix) {
  for (const variant of ['R', 'A']) {
    const a = list.filter(r => r.variant === variant && r.status === 'EXACT');
    if (new Set(a.map(r => jsonSha({ witness: r.finalWitness, decision: r.decision, states: r.finalStates, trace: r.trace.map(t => ({ ...t, apiMs: null })) }))).size > 1) determinismErrors.push(`${id}:${variant}`);
    if (a.length === 4 && a.every(r => r.trace[0]?.completed)) probeCounts[variant]++;
    for (const r of a) if (r.trace[0]?.engine !== 'integrated' || r.trace[0].partitioned !== (variant === 'A') || r.trace[0].stateBudget !== 100000 || r.trace.length > 2) scopeErrors.push(r.runId);
  }
  const exact = list.filter(r => r.status === 'EXACT');
  if (new Set(exact.map(r => jsonSha({ ids: r.finalWitness.selectedIDs, q: r.finalWitness.qualityRLE }))).size > 1) exactErrors.push(id);
  for (let rep = 1; rep <= 4; rep++) {
    const r = list.find(r => r.variant === 'R' && r.repetition === rep), a = list.find(r => r.variant === 'A' && r.repetition === rep);
    if (r?.trace && a?.trace) {
      if (a.trace[0].states > r.trace[0].states) stateErrors.push(`${id}:r${rep}`);
      if (compare(unrle(a.trace[0].qualityRLE), unrle(r.trace[0].qualityRLE)) < 0) boundedQualityErrors.push(`${id}:r${rep}`);
    }
  }
  const r = list.filter(r => r.variant === 'R'), a = list.filter(r => r.variant === 'A');
  if (r.length === 4 && a.length === 4 && r.every(r => r.status === 'EXACT') && a.every(r => r.status === 'EXACT')) metrics.push({ matrixId: id, mirrorGroup: read(path.join(HERE, 'INPUTS.json')).entries.find(e => e.id === id).mirrorGroup,
    baselineMedianMs: median(r.map(r => r.routeWallMs)), candidateMedianMs: median(a.map(r => r.routeWallMs)), baselineProbeMs: median(r.map(r => r.trace[0].apiMs)), candidateProbeMs: median(a.map(r => r.trace[0].apiMs)) });
}
const allComplete = rows.length === expected.length && shards.every(s => s.status === 'COMPLETE');
const correctness = allComplete && !failures.length && !determinismErrors.length && !exactErrors.length && !boundedQualityErrors.length && !scopeErrors.length && !stateErrors.length;
const ratios = metrics.map(m => m.candidateMedianMs / m.baselineMedianMs).sort((a, b) => a - b);
const summary = { phase, status: correctness ? 'PASS' : 'FAILED_OR_INCOMPLETE', expectedRuns: expected.length, observedRuns: rows.length, statuses: rows.reduce((a, r) => (a[r.status] = (a[r.status] ?? 0) + 1, a), {}),
  failures, censored, determinismErrors, exactErrors, boundedQualityErrors, scopeErrors, stateErrors, probeExactMatrices: probeCounts,
  pairedFinalRouteMatrices: metrics.length, finalRouteAllConfirmed: metrics.length === byMatrix.size, apiMedianSumRatio: metrics.length ? metrics.reduce((n, m) => n + m.candidateMedianMs, 0) / metrics.reduce((n, m) => n + m.baselineMedianMs, 0) : null,
  p95SlowdownRatio: ratios.length ? ratios[Math.ceil(.95 * ratios.length) - 1] : null, metrics, build: shards[0].build, nativeEffectCampaignRepeated: false,
  actualInputPrimaryCalls: 0, actualInputPcCalls: 0, devApplied: false };
if (phase === 'smoke') {
  // Validation state caps are not product correctness failures. Freeze a single
  // unchanged candidate to finish reserved checks, never certify promotion on
  // these censored routes or rerun them with larger/unlimited budgets.
  summary.mayFreezeForReserved = correctness && censored.every(c => c.status === 'INCONCLUSIVE');
  summary.productRoutePromotionEvidenceComplete = correctness && !censored.length;
}
if (phase === 'reserved') summary.reservedPointGatePass = correctness && !censored.length && metrics.length === 104 && probeCounts.A >= probeCounts.R && summary.apiMedianSumRatio <= 1.05 && summary.p95SlowdownRatio <= 1.10;
write(path.join(output, 'SUMMARY.json'), summary); fs.writeFileSync(path.join(output, 'ALL_RUNS.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx' }); seal(output);
console.log(JSON.stringify({ ...summary, build: jsonSha(summary.build), metrics: metrics.length }, null, 2));
if (!correctness) process.exitCode = 1;
