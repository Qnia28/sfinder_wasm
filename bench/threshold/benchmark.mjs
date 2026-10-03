import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { settings, defaults, caseIds } from './profiles.mjs';
import { manifest, manifestPath, loadFixture } from './fixtures.mjs';
import { sha256, validateWitness } from './engine.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const at = args.indexOf(`--${name}`); return at < 0 ? fallback : args[at + 1]; };
const profile = option('profile','smoke'), mask = Number(option('mask','31'));
if (profile === 'confirm-onoff') assert(option('mask', null) !== null,
  'confirm-onoff requires an explicit --mask; do not silently use all-on');
const comparisons = settings(profile, mask), [defaultPairs, defaultTimeout] = defaults(profile);
const pairs = Number(option('pairs',defaultPairs)), timeoutSeconds = Number(option('timeout-seconds',defaultTimeout));
assert(Number.isInteger(pairs) && pairs >= 1 && pairs <= 10);
assert(Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 && timeoutSeconds <= 300);
const build = resolve(option('build','bench/threshold/build'));
const suite = option('suite', profile.startsWith('confirm') ? 'all' : 'development');
const ids = option('case',null) ? [option('case',null)] : caseIds(profile, suite);
const out = resolve(option('out',`bench/threshold/results/${profile}`));
mkdirSync(resolve(out,'witnesses'), { recursive: true });
const rawFile = resolve(out,'samples.jsonl');
writeFileSync(rawFile,'', { flag: 'wx' }); // Never accidentally overwrite an old run.
const rev = spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
const dirty = spawnSync('git',['status','--porcelain'],{encoding:'utf8'}).stdout.trim();
const environment = { profile, suite, mask, pairs, timeoutSeconds, candidate: rev, dirty,
  baseline: manifest.baseline, node: process.version, platform: platform(), arch: arch(),
  cpu: cpus()[0]?.model, cpuCount: cpus().length, runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null, runner: process.env.RUNNER_NAME ?? null,
   manifestHash: sha256(readFileSync(manifestPath)), fixtureSet: manifest.dataset ?? 'legacy-stress',
  build: JSON.parse(readFileSync(resolve(build,'build.json'))) };
writeFileSync(resolve(out,'environment.json'),JSON.stringify(environment,null,2));
writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));

function sample(setting, caseId) {
  return new Promise(resolveSample => {
    const started = performance.now();
    const child = fork(fileURLToPath(new URL('./sample.mjs',import.meta.url)),
      [resolve(build,`${setting.engine}.wasm`),caseId,String(setting.mask)],
      { execArgv: [], silent: true });
    let timer, result, error = null, ready = null, killed = null, stderr = '';
    const deadline = (ms, status) => {
      clearTimeout(timer);
      timer = setTimeout(() => { killed = status; child.kill('SIGKILL'); }, ms);
    };
    deadline(30000,'SETUP_TIMEOUT');
    child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-16384); });
    child.stdout.on('data', () => {});
    child.on('error', e => { error = String(e); });
    child.on('message', message => {
      if (message.type === 'ready') {
        ready = message;
        deadline(timeoutSeconds * 1000,'TIMEOUT');
        child.send({ type: 'solve' });
      } else if (message.type === 'solved') {
        deadline(15000,'VALIDATION_TIMEOUT');
      } else if (message.type === 'result') {
        result = message; deadline(5000,'CLEANUP_TIMEOUT');
      } else if (message.type === 'error') {
        error = message.error; deadline(5000,'CLEANUP_TIMEOUT');
      }
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      const status = killed ?? (error || code !== 0 || !result ? 'ERROR' : 'EXACT');
      resolveSample({ status, ...setting, outerMs: performance.now()-started,
        wasmHash: ready?.wasmHash, traceEnabled: ready?.traceEnabled,
        ...(result ?? {}), ...(error ? { error } : {}), ...(stderr ? { stderr } : {}), code, signal });
    });
  });
}

const rows = [], knownWitness = new Map();
let invalid = false;
for (const caseId of ids) {
  const { entry, matrix } = loadFixture(caseId);
  for (let pair = 0; pair < pairs; pair++) {
    // Rotate comparison order, and alternate AB/BA independently of settings.
    const order = comparisons.map((_, i) => (i + pair) % comparisons.length);
    for (const comparisonIndex of order) {
      const comparison = comparisons[comparisonIndex];
      for (const side of (pair + comparisonIndex) % 2 ? ['right','left'] : ['left','right']) {
        const run = await sample(comparison[side], caseId);
        if (run.status === 'EXACT') {
          try {
            assert.equal(run.inputHash, entry.sha256);
            assert.equal(run.wasmHash, environment.build.hashes[run.engine]);
            assert.equal(run.traceEnabled, profile === 'diagnostic');
            assert.equal(validateWitness(matrix, run.result), run.witnessHash);
            const known = knownWitness.get(caseId);
            if (known) assert.equal(run.witnessHash, known, 'exact quality/stable-ID mismatch');
            else knownWitness.set(caseId, run.witnessHash);
          } catch (error) { run.status = 'INVALID'; run.error = String(error.stack || error); }
        }
        const record = { caseId, suite: entry.suite, inputHash: entry.sha256, pair,
          comparisonIndex, side, ...(comparison.removedBit ? { removedBit: comparison.removedBit } : {}), ...run };
        if (record.result) {
          const witness = `witnesses/${caseId}-${comparisonIndex}-${pair}-${side}.json.gz`;
          writeFileSync(resolve(out,witness), gzipSync(JSON.stringify(record.result)));
          record.searchedStates = record.result.searchedStates;
          record.diagnostics = record.result.diagnostics;
          record.witness = witness;
          delete record.result;
        }
        rows.push(record); appendFileSync(rawFile,JSON.stringify(record)+'\n');
        console.log(`${caseId} pair=${pair} ${side} ${record.engine}/${record.mask} ${record.status} ${record.solverMs?.toFixed(3) ?? '-'}ms`);
        if (!['EXACT','TIMEOUT'].includes(record.status)) invalid = true;
      }
    }
  }
}
const median = values => {
  if (!values.length) return null;
  const v = [...values].sort((a,b)=>a-b), at = Math.floor(v.length/2);
  return v.length % 2 ? v[at] : (v[at-1]+v[at])/2;
};
const summary = [];
for (const caseId of ids) for (let comparisonIndex=0; comparisonIndex<comparisons.length; comparisonIndex++) {
  const local = rows.filter(r=>r.caseId===caseId && r.comparisonIndex===comparisonIndex);
  const paired = Array.from({length:pairs},(_,pair)=>local.filter(r=>r.pair===pair));
  const complete = paired.filter(p=>p.length===2 && p.every(r=>r.status==='EXACT'));
  summary.push({ caseId, suite: manifest.cases.find(x=>x.id===caseId).suite, comparisonIndex,
    ...comparisons[comparisonIndex], leftExact: local.filter(r=>r.side==='left'&&r.status==='EXACT').length,
    rightExact: local.filter(r=>r.side==='right'&&r.status==='EXACT').length,
    pairedComplete: complete.length,
    pairedSpeedupMedian: median(complete.map(p=>p.find(r=>r.side==='left').nativeMs / p.find(r=>r.side==='right').nativeMs)),
    solverSpeedupMedian: median(complete.map(p=>p.find(r=>r.side==='left').solverMs / p.find(r=>r.side==='right').solverMs)),
    leftMedianMs: median(complete.map(p=>p.find(r=>r.side==='left').nativeMs)),
    rightMedianMs: median(complete.map(p=>p.find(r=>r.side==='right').nativeMs)),
    leftPeakRssMedianKiB: median(complete.map(p=>p.find(r=>r.side==='left').processPeakRssKiB)),
    rightPeakRssMedianKiB: median(complete.map(p=>p.find(r=>r.side==='right').processPeakRssKiB)),
    leftWasmMemoryMedianBytes: median(complete.map(p=>p.find(r=>r.side==='left').wasmMemoryBytes)),
    rightWasmMemoryMedianBytes: median(complete.map(p=>p.find(r=>r.side==='right').wasmMemoryBytes)),
    leftOnlyExact: paired.filter(p=>p.find(r=>r.side==='left')?.status==='EXACT'&&p.find(r=>r.side==='right')?.status==='TIMEOUT').length,
    rightOnlyExact: paired.filter(p=>p.find(r=>r.side==='right')?.status==='EXACT'&&p.find(r=>r.side==='left')?.status==='TIMEOUT').length,
  });
}
writeFileSync(resolve(out,'summary.json'),JSON.stringify({environment,comparisons,rows:summary,invalid},null,2));
const markdown = [
  `# Threshold ${profile}: ${rev}`,
  'Sequential paired fresh processes on the SAME runner. Primary metric nativeMs includes the Rust ABI conversion, normalization/preparation/search; solverMs also includes JS validation/packing/copy/getters. Fixture IO and returned-witness checking are outside both. TIMEOUTs are censored, not times. Diagnostic runs are not performance evidence.',
  '| Case | Left engine/mask | Right engine/mask | Exact L/R | Complete pairs | Median paired speedup |',
  '|---|---|---|---|---|---|',
  ...summary.map(r=>`| ${r.caseId} | ${r.left.engine}/${r.left.mask} | ${r.right.engine}/${r.right.mask} | ${r.leftExact}/${r.rightExact} | ${r.pairedComplete} | ${r.pairedSpeedupMedian?.toFixed(3) ?? '-'} |`),
  `\nInvalid run: ${invalid}. A right-only completion has a checked witness but no baseline optimum cross-check in that pair.`,
].join('\n');
writeFileSync(resolve(out,'summary.md'),markdown+'\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown+'\n');
if (invalid) process.exitCode=1;
