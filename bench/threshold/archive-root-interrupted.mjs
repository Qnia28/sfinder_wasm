// Preserve actual outcomes from the user-cancelled run without presenting a
// missing/partial campaign as successful, or filling missing calls with TIMEOUT.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { sha256, validateWitness } from './engine.mjs';
import { settings } from './profiles.mjs';
const runId = '37113754448';
const root = resolve('bench/threshold/results/remote-root-screen-interrupted-raw');
const aggregate = JSON.parse(readFileSync(`bench/threshold/results/remote-root-screen-interrupted-summary/threshold-summary-${runId}-1/results.json`));
assert.equal(aggregate.invalid, true);
const snapshot = JSON.parse(readFileSync('bench/threshold/results/root-screen-cancellation-snapshot.json'));
assert.equal(snapshot.status, 'completed'); assert.equal(snapshot.conclusion, 'cancelled');
assert(snapshot.jobs.every(j => j.status === 'completed'));
const manifestBytes = readFileSync(new URL('./cycle1-100/manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const initial = JSON.parse(readFileSync(new URL('./reports/expanded100.json', import.meta.url)));
const reference = aggregate.reports[0].environment;
assert.equal(reference.profile, 'root-screen'); assert.equal(reference.pairs, 1);
assert.equal(reference.runId, runId); assert.equal(reference.manifestHash, sha256(manifestBytes));
const comparisons = settings('root-screen', 4), samples = [], witnesses = new Map(), seen = new Set(), environments = [];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(resolve(dir, e.name))
    : e.name === 'samples.jsonl' ? [resolve(dir, e.name)] : []);
}
for (const file of walk(root)) {
  const env = JSON.parse(readFileSync(resolve(dirname(file), 'environment.json')));
  for (const k of ['profile', 'pairs', 'timeoutSeconds', 'candidate', 'runId', 'runAttempt', 'manifestHash', 'dirty']) {
    assert.deepEqual(env[k], reference[k]);
  }
  assert.deepEqual(env.build, reference.build);
  const raw = readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  const caseId = raw[0].caseId, entry = manifest.cases.find(c => c.id === caseId); assert(entry);
  const gzip = readFileSync(new URL(`./cycle1-100/${entry.file}`, import.meta.url));
  assert.equal(sha256(gzip), entry.compressedSha256);
  const bytes = gunzipSync(gzip); assert.equal(sha256(bytes), entry.sha256);
  const matrix = JSON.parse(bytes);
  environments.push({ caseId, runner: env.runner, cpu: env.cpu });
  for (const r of raw) {
    assert.equal(r.caseId, caseId); assert.equal(r.inputHash, entry.sha256); assert.equal(r.pair, 0);
    assert(['EXACT', 'TIMEOUT'].includes(r.status)); assert(['left', 'right'].includes(r.side));
    const comparison = comparisons[r.comparisonIndex]; assert(comparison);
    assert.equal(r.mask, comparison[r.side].mask); assert.equal(r.engine, 'experiment');
    assert.equal(r.wasmHash, reference.build.hashes.experiment); assert.equal(r.traceEnabled, false);
    const key = `${caseId}/${r.comparisonIndex}/${r.side}`; assert(!seen.has(key)); seen.add(key);
    if (r.status === 'EXACT') {
      const witness = JSON.parse(gunzipSync(readFileSync(resolve(dirname(file), r.witness))));
      assert(witness.completed);
      const hash = validateWitness(matrix, witness); assert.equal(hash, r.witnessHash);
      if (initial.witnessHashes[caseId]) assert.equal(hash, initial.witnessHashes[caseId]);
      if (witnesses.has(caseId)) assert.equal(hash, witnesses.get(caseId)); else witnesses.set(caseId, hash);
    } else assert.equal(r.nativeMs, undefined);
    const { pair, comparisonIndex, side, mask, status, nativeMs, searchedStates, witnessHash } = r;
    samples.push({ caseId, pair, comparisonIndex, side, mask, status, nativeMs, searchedStates, witnessHash });
  }
}
const perCase = manifest.cases.map(c => {
  const raw = samples.filter(s => s.caseId === c.id);
  return { caseId: c.id, recordedCalls: raw.length, unrecordedCalls: 12 - raw.length,
    exact: raw.filter(s => s.status === 'EXACT').length, timeout: raw.filter(s => s.status === 'TIMEOUT').length,
    status: raw.length === 12 ? 'complete-screening-data' : raw.length ? 'cancelled-partial-data' : 'no-artifact',
    jobConclusion: snapshot.jobs.find(j => j.name === `benchmark (${c.id})`)?.conclusion };
});
const stats = { cases: 100, artifactCases: environments.length, recordedCalls: samples.length,
  exact: samples.filter(s => s.status === 'EXACT').length, timeout: samples.filter(s => s.status === 'TIMEOUT').length,
  completeDataCases: perCase.filter(c => c.recordedCalls === 12).length,
  partialDataCases: perCase.filter(c => c.recordedCalls > 0 && c.recordedCalls < 12).length,
  noArtifactCases: perCase.filter(c => c.recordedCalls === 0).length,
  noExactWithTimeout: perCase.filter(c => c.exact === 0 && c.timeout > 0).map(c => c.caseId),
  partialWithExact: perCase.filter(c => c.exact > 0 && c.recordedCalls < 12).map(c => ({ caseId: c.caseId, exact: c.exact, timeout: c.timeout })) };
writeFileSync(new URL('./reports/root-screen-interrupted.json', import.meta.url), JSON.stringify({
  runId, url: `https://github.com/Qnia28/sfinder_wasm/actions/runs/${runId}`, conclusion: 'cancelled', campaignComplete: false,
  cancellationReason: 'User requested immediate release of long-running VMs and maximum parallelism16.',
  activeJobsAfterCancellation: 0, candidate: reference.candidate, manifestHash: reference.manifestHash,
  wasmHashes: reference.build.hashes, sourceDigest: reference.build.sourceDigest,
  note: 'No unrecorded call is counted as TIMEOUT. Some unrecorded calls may have started before cancellation. Do not pool this partial campaign with a new run or claim a full100 screening.',
  stats, perCase, environments, witnessHashes: Object.fromEntries(witnesses), samples,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(stats, null, 2));
