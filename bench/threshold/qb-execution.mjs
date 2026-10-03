import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './engine.mjs';
export function intervalsReview(intervals, limit = 10) {
  // GitHub step timestamps have one-second precision. Zero-length timestamps
  // are possible for very small matrices; do not invent a positive duration.
  for (const i of intervals) assert(Date.parse(i.startedAt) <= Date.parse(i.completedAt));
  const events = intervals.filter(i => i.startedAt !== i.completedAt).flatMap(i => [
    { at: Date.parse(i.startedAt), delta: 1 }, { at: Date.parse(i.completedAt), delta: -1 }]);
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let active = 0, max = 0;
  for (const e of events) { active += e.delta; assert(active >= 0); max = Math.max(max, active); }
  assert.equal(active, 0); assert(max <= limit, `actual overlap${max} exceeds shard limit${limit}`);
  const times = intervals.flatMap(i => [Date.parse(i.startedAt), Date.parse(i.completedAt)]);
  return { intervals: intervals.length, maxOverlap: max,
    zeroSecondIntervals: intervals.filter(i => i.startedAt === i.completedAt).length,
    start: times.length ? new Date(Math.min(...times)).toISOString() : null,
    end: times.length ? new Date(Math.max(...times)).toISOString() : null,
    windowMinutes: times.length ? (Math.max(...times) - Math.min(...times)) / 60000 : 0,
    longestMinutes: intervals.length ? Math.max(...intervals.map(i => (Date.parse(i.completedAt) - Date.parse(i.startedAt)) / 60000)) : 0 };
}
export function executionAudit(run, jobs, artifacts, initial, repeated) {
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success'); assert.equal(run.head_sha, initial.candidate);
  assert.equal(run.head_branch, 'experiment/threshold-engine-20261003'); assert.equal(run.run_attempt, 1);
  assert.equal(String(run.id), initial.runId);
  assert(jobs.every(j => j.status === 'completed' && ['success', 'skipped'].includes(j.conclusion)));
  const phases = [
    ['capture', 'Enumerate QB and prove the presampled single filter K', 100],
    ['benchmark', 'Sequential paired comparisons on this runner', initial.auditedMatrices],
    ['recheck', 'Ten new pairs, same frozen binary and matrices, fresh VM', repeated?.auditedMatrices || 0],
  ];
  const all = [], result = {};
  for (const [phase, stepName, expected] of phases) {
    const intervals = jobs.filter(j => j.name.startsWith(`${phase} (`)).map(j => {
      assert.equal(j.conclusion, 'success');
      const s = j.steps.find(s => s.name === stepName); assert(s); assert.equal(s.conclusion, 'success');
      return { phase, jobId: j.id, name: j.name, runnerName: j.runner_name,
        startedAt: s.started_at, completedAt: s.completed_at,
        jobStartedAt: j.started_at, jobCompletedAt: j.completed_at };
    });
    assert.equal(intervals.length, expected);
    for (const i of intervals) {
      if (phase === 'capture') continue;
      const id = i.name.slice(phase.length + 2, -1);
      const e = (phase === 'benchmark' ? initial : repeated).environments.find(e => e.runner === i.runnerName);
      assert(e, `missing recorded runner for${id}`);
    }
    result[phase] = { ...intervalsReview(intervals),
      shardJobs: intervalsReview(intervals.map(i => ({ startedAt: i.jobStartedAt, completedAt: i.jobCompletedAt }))),
      intervals }; all.push(...intervals);
  }
  result.allPhases = intervalsReview(all);
  result.allShardJobs = intervalsReview(all.map(i => ({ startedAt: i.jobStartedAt, completedAt: i.jobCompletedAt })));
  if (result.recheck.intervals.length) assert(Date.parse(result.recheck.start) >= Date.parse(result.benchmark.end));
  const names = artifacts.map(a => a.name); assert.equal(new Set(names).size, names.length);
  for (const suffix of ['build', 'fixtures', 'review', 'final']) assert(names.includes(`qb-${suffix}-${run.id}-1`));
  assert.equal(artifacts.filter(a => a.name.startsWith('qb-capture-')).length, 100);
  assert.equal(artifacts.filter(a => a.name.startsWith('qb-bench-')).length, initial.auditedMatrices);
  assert.equal(artifacts.filter(a => a.name.startsWith('qb-recheck-')).length, repeated?.auditedMatrices || 0);
  assert(artifacts.every(a => !a.expired));
  return { runId: String(run.id), url: run.html_url, candidate: run.head_sha, conclusion: run.conclusion,
    createdAt: run.created_at, completedAt: run.updated_at,
    workflowMinutes: (Date.parse(run.updated_at) - Date.parse(run.created_at)) / 60000,
    maxAllowedShards: 10, phases: result, artifactCount: artifacts.length,
    audit: 'GitHub completed job/step timestamps independently checked, inferred max overlap<=10 across capture/initial/recheck, consistent with workflow hard cap10. Timestamps have one-second resolution; zero-second steps excluded from overlap events and explicitly counted. Fresh-VM repeats start after all initial benchmarks. Runner names matched sample environments. All expected raw/fixture/build/final artifacts present.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [runId, initialPath, repeatPath, output] = process.argv.slice(2); assert(/^\d+$/.test(runId) && initialPath && output);
  const initial = JSON.parse(readFileSync(initialPath)), repeated = repeatPath === '-' ? null : JSON.parse(readFileSync(repeatPath));
  function api(endpoint, pages = false) {
    const r = spawnSync('gh', ['api', ...(pages ? ['--paginate', '--slurp'] : []), `repos/Qnia28/sfinder_wasm/actions/runs/${runId}${endpoint}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout.replace(/^\uFEFF/, ''));
  }
  const run = api(''), jobs = api('/jobs?per_page=100', true).flatMap(p => p.jobs), artifacts = api('/artifacts?per_page=100', true).flatMap(p => p.artifacts);
  const review = executionAudit(run, jobs, artifacts, initial, repeated);
  mkdirSync(output, { recursive: true });
  for (const [name, value] of Object.entries({ run, jobs, artifacts, execution: review })) {
    writeFileSync(resolve(output, `${name}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ workflowMinutes: review.workflowMinutes, artifactCount: artifacts.length,
    phases: Object.fromEntries(Object.entries(review.phases).map(([k, v]) => [k, { ...v, intervals: Array.isArray(v.intervals) ? v.intervals.length : v.intervals }])) }, null, 2));
}
