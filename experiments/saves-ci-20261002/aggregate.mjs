import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIR, STAGE, readJson, writeJson, hash, assertArtifactBudget } from './common.mjs';

const input = path.resolve(process.argv[2] ?? path.join(STAGE, 'downloads'));
const out = path.join(STAGE, 'artifacts/aggregate');
const manifest = readJson(path.join(DIR, 'inputs/cells.json'));
const jobs = [ ['anchor', 0], ['a4', 0], ['a6', 0], ...Array.from({ length: 8 }, (_, n) => ['broad', n]),
  ...Array.from({ length: 4 }, (_, n) => ['deep', n]), ...Array.from({ length: 2 }, (_, n) => ['large', n]) ];
const observations = [], jobResults = [], rawFiles = [];
for (const [stage, shard] of jobs) {
  const directory = path.join(input, `saves-${stage}-${shard}`), summaryFile = path.join(directory, 'summary.json');
  if (!fs.existsSync(summaryFile)) { jobResults.push({ stage, shard, status: 'MISSING_OR_NOT_STARTED' }); continue; }
  const summary = readJson(summaryFile); jobResults.push(summary);
  const rawFile = path.join(directory, 'observations.jsonl');
  if (!fs.existsSync(rawFile)) { jobResults.push({ stage, shard, status: 'RAW_MISSING' }); continue; }
  const bytes = fs.readFileSync(rawFile); rawFiles.push({ artifact: `saves-${stage}-${shard}`, bytes: bytes.length, sha256: hash(bytes) });
  for (const line of bytes.toString('utf8').split('\n').filter(Boolean)) {
    try { const row = JSON.parse(line); if (row.kind === 'OBSERVATION') observations.push({ ...row, env: summary.env }); }
    catch { jobResults.push({ stage, shard, status: 'PARTIAL_JSONL' }); }
  }
}
const paired = [], errors = [];
for (const cell of manifest.cells) for (let repetition = 0; repetition < 2; repetition++) {
  const rows = observations.filter(row => row.cell === cell.id && row.repetition === repetition);
  const variants = new Map(rows.map(row => [row.variant, row]));
  if (rows.length !== cell.conditions.length || rows.some(row => row.status !== 'PASS')) {
    errors.push({ cell: cell.id, repetition, status: 'INCOMPLETE', observed: rows.map(row => ({ variant: row.variant, status: row.status })) }); continue;
  }
  if (new Set(rows.map(row => row.result.signature)).size !== 1) { errors.push({ cell: cell.id, repetition, status: 'SIGNATURE_MISMATCH' }); continue; }
  const comparisons = cell.stage === 'anchor' ? [['REF', 'P'], ['P', 'R'], ['R', 'M'], ['REF', 'M']] : [['REF', cell.conditions.at(-1)]];
  for (const [base, candidate] of comparisons) {
    const a = variants.get(base), b = variants.get(candidate);
    assert.equal(a.env.runId, b.env.runId); assert.equal(a.env.job, b.env.job);
    const baselineMs = a.result.wallMs, candidateMs = b.result.wallMs, deltaMs = baselineMs - candidateMs;
    paired.push({ cell: cell.id, stage: cell.stage, group: cell.group, weight: cell.weight, repetition, base, candidate,
      baselineMs, candidateMs, ratio: baselineMs / candidateMs, deltaMs, sameVM: true, cpu: a.env.cpu,
      imageVersion: a.env.imageVersion, screen: deltaMs > Math.max(1, .05 * baselineMs) ? 'IMPROVED' : -deltaMs > Math.max(.5, .05 * baselineMs) ? 'REGRESSED' : 'NEUTRAL' });
  }
}
const decisions = [];
for (const cell of manifest.cells) {
  const rows = paired.filter(row => row.cell === cell.id && row.base === 'REF' && row.candidate === cell.conditions.at(-1));
  decisions.push({ cell: cell.id, stage: cell.stage, verdict: rows.length !== 2 ? 'INCOMPLETE' : rows.every(row => row.screen === 'IMPROVED') ? 'PROVISIONAL_IMPROVEMENT'
    : rows.every(row => row.screen === 'REGRESSED') ? 'PROVISIONAL_REGRESSION' : rows.every(row => row.screen === 'NEUTRAL') ? 'NEUTRAL' : 'UNRESOLVED_TWO_OBSERVATIONS',
    ratios: rows.map(row => row.ratio), deltasMs: rows.map(row => row.deltaMs) });
}
const resource = observations.filter(row => row.stage === 'a4'), resourceMismatches = [];
for (const trace of ['T1', 'T2', 'T3', 'T4']) for (let repetition = 0; repetition < 2; repetition++) {
  const rows = resource.filter(row => row.cell === trace && row.repetition === repetition);
  if (rows.length !== 2 || rows.some(row => row.status !== 'PASS') || new Set(rows.map(row => row.result.signature)).size !== 1) resourceMismatches.push({ trace, repetition });
}
const summary = { status: jobResults.some(row => row.status !== 'COMPLETE') || errors.length || resourceMismatches.length ? 'INCOMPLETE_OR_FAILED' : 'COMPLETE',
  expectedTimedObservations: manifest.cells.reduce((sum, cell) => sum + cell.conditions.length * 2, 0), expectedResourceSessions: 16,
  timedObserved: observations.filter(row => row.stage !== 'a4').length, resourceObserved: resource.length,
  jobs: jobResults, errors, resourceMismatches, rawFiles,
  decisionCounts: Object.fromEntries([...new Set(decisions.map(row => row.verdict))].map(verdict => [verdict, decisions.filter(row => row.verdict === verdict).length])),
  caveats: ['Two retained observations are a provisional screen, not statistical proof.', 'Compare only same-VM paired ratios; never absolute durations from different jobs or historical Windows.',
    'Fresh performance holdout remains unopened. No product promotion or secondary routing change.'] };
writeJson(path.join(out, 'SUMMARY.json'), summary); writeJson(path.join(out, 'PAIRS.json'), paired); writeJson(path.join(out, 'DECISIONS.json'), decisions);
console.log(JSON.stringify(summary, null, 2));
assertArtifactBudget(out);
if (summary.status !== 'COMPLETE') process.exitCode = 1;
