// Disposable policy process. The existing supervisor owns the 300s watchdog.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { hash, validateFixture, packedView, selectedVector, verifyResult } from '../../contracts.mjs';
import { FAST_ARMS } from './fast-followup.mjs';
import { LARGE_ARMS } from './large-run.mjs';
import { PROBE_ARMS } from './probe-followup.mjs';

const send = message => new Promise((resolve, reject) => process.send(message, e => e ? reject(e) : resolve()));
export function historicalWitnessHash(verified, expected) {
  assert(['SORTED_QUALITY_SELECTED', 'INSERTION_SELECTED_QUALITY'].includes(expected.contract), 'unknown historical witness contract');
  const value = expected.contract === 'SORTED_QUALITY_SELECTED'
    ? { quality: verified.qualityVector, selected: verified.selected }
    : { selected: verified.selected, quality: verified.qualityVector };
  return hash(JSON.stringify(value));
}
export async function executeTriage(job) {
  let memoryDiagnostic, memoryTimer;
  if (job.memoryDiagnostic === 'cp-memory-v1') {
    const { installMemoryTrace } = await import('./memory-trace.mjs');
    memoryDiagnostic = installMemoryTrace('policy-parent');
    memoryTimer = setInterval(()=>memoryDiagnostic.trace('sample'),250);
    memoryTimer.unref();
  }
  assert.equal(job.exactHumanQuality, 'true');
  assert(['PRECHANGE_BASELINE','BASELINE','A','B','TRACE_OFF_BASELINE','TRACE_ON_BASELINE',
    'I100K_SEED_CAPTURE','T_PRIMARY_SEED','T_PROBE_SEED', ...Object.keys(FAST_ARMS), ...Object.keys(LARGE_ARMS), ...Object.keys(PROBE_ARMS)].includes(job.variant),'unregistered benchmark variant');
  const start = performance.now();
  const bytes = fs.readFileSync(job.fixturePath); assert.equal(hash(bytes), job.fixtureSha256);
  const fixture = validateFixture(JSON.parse(bytes));
  const old = job.variant === 'PRECHANGE_BASELINE';
  const root = old ? job.baselineRoot : process.cwd();
  const load = name => import(pathToFileURL(path.join(root, 'src', name)));
  const { registerNumericCoverage } = await load('numeric-cover-data.mjs');
  const { createWasmSolver } = await load('wasm-backend.mjs');
  const { solveExactSecondaryAsync } = await load('min-cover-three-engine.mjs');
  const events = [];
  const arm = PROBE_ARMS[job.variant] ?? LARGE_ARMS[job.variant] ?? FAST_ARMS[job.variant];
  const cpLimitMs = LARGE_ARMS[job.variant] || PROBE_ARMS[job.variant] ? arm.cpLimitMs : 120000;
  const traceOn = arm ? arm.trace : !['PRECHANGE_BASELINE', 'TRACE_OFF_BASELINE'].includes(job.variant);
  let solver;
  const cpuStart = process.cpuUsage();
  const entry = performance.now();
  try {
    // Compile/init and JS packing are included in the measured post-primary entry.
    const init = performance.now(); solver = await createWasmSolver(4, { legal: false });
    const initMs = performance.now() - init;
    memoryDiagnostic?.trace('parent-rust-init-end');
    const packing = performance.now(); const view = packedView(fixture, registerNumericCoverage);
    const packingMs = performance.now() - packing;
    memoryDiagnostic?.trace('parent-packed-ready');
    const primaryKeys = fixture.seed.map(id => fixture.keys[id]);
    const { backend, kernelStats = {} } = fixture.cardinalityProof;
    const trace = traceOn ? event => {
      assert(events.length < 64, 'unbounded trace');
      events.push({ ...event, atMs: performance.now() - entry });
      if (process.send) {
        const { seedKeys, ...scalars } = event;
        process.send({ event: 'phase', name: 'policy-trace', trace: { ...scalars,
          seedCount: seedKeys?.length ?? null, atMs: performance.now() - entry } });
      }
    } : undefined;
    const options = { solver, qualityFor: view.qualityFor, secondary: arm?.secondary ?? 'auto', secondaryCpLimitMs:cpLimitMs, decomposition: 'off',
      primary: { count: fixture.K, backend, searchedStates: fixture.cardinalityProof.primarySearchedStates ?? null },
      primaryKeys, primaryHard: fixture.primaryHard, requestedPrimary: 'auto', requested: false, kernelStats,
      experimentalTriagePolicy: arm?.policy ?? (['A', 'B'].includes(job.variant) ? job.variant : 'baseline'), secondaryTrace: trace };
    let result, probeSeed = null;
    if (!['I100K_SEED_CAPTURE', 'T_PRIMARY_SEED', 'T_PROBE_SEED'].includes(job.variant) && process.platform === 'linux') {
      const { assertORToolsSupported } = await load('ortools-min-cover.mjs');
      assertORToolsSupported(); // A fixture policy run must not silently turn into the CP-unsupported profile.
    }
    const diagnostic = ['I100K_SEED_CAPTURE', 'T_PRIMARY_SEED', 'T_PROBE_SEED'].includes(job.variant);
    if (diagnostic) {
      const seed = job.variant === 'T_PROBE_SEED' ? job.probeSeed : fixture.seed;
      assert(Array.isArray(seed), 'missing trial seed'); selectedVector(fixture, seed);
      result = solver.minimumCoverAtCount(view.coverage, fixture.K, { qualityFor: view.qualityFor,
        seedKeys: seed.map(id => fixture.keys[id]), integrated: job.variant === 'I100K_SEED_CAPTURE',
        stateBudget: job.variant === 'I100K_SEED_CAPTURE' ? 100000 : null });
    } else result = await solveExactSecondaryAsync(view.coverage, options);
    const returned = performance.now();
    solver.close(); solver = null;
    const settled = performance.now();
    const cpu = process.cpuUsage(cpuStart);
    // Hash/export/audit happen after the measured policy endpoint.
    const audit = performance.now();
    const verified = verifyResult(fixture, result, { engine: result.secondaryResolved ?? 'rust' });
    let historicalWitness = null;
    if (verified.completed && job.expectedWitness) {
      historicalWitness = historicalWitnessHash(verified, job.expectedWitness);
      assert.equal(historicalWitness,job.expectedWitness.sha256,'historical weighted-quality/stable-ID witness changed');
    }
    if (job.variant === 'I100K_SEED_CAPTURE') probeSeed = verified.selected;
    const finalEvents = events.map(event => {
      if (!event.seedKeys) return event;
      const { seedKeys, ...scalars } = event;
      return { ...scalars, seedHash: hash(JSON.stringify(seedKeys)), seedCount: seedKeys.length };
    });
    const incompleteProbe = job.variant === 'I100K_SEED_CAPTURE' && !verified.completed;
    return { status: incompleteProbe ? 'PROBE_INCOMPLETE' : verified.completed ? 'EXACT' : 'INCOMPLETE',
      variant: job.variant, result, verified, probeSeed, trace: finalEvents,
      ...(arm ? { armContract: arm } : {}),
      fixtureSha256: hash(bytes), primarySeedHash: hash(JSON.stringify(fixture.seed)),
      primarySeedKeysHash: hash(JSON.stringify(primaryKeys)),
      historicalWitness,
      responseMs: settled - entry, policyReturnMs: returned - entry, policySettledMs: settled - entry,
      timings: { fixtureAndImportMs: entry - start, initMs, packingMs, auditMs: performance.now() - audit,
        policyReturnMs: returned - entry, policySettledMs: settled - entry },
      cpuUs: cpu, diagnostic, stateBudget: job.variant === 'I100K_SEED_CAPTURE' ? 100000 : null,
      cpDelayMs: diagnostic ? null : arm?.secondary==='cpsat' ? 0 : 60000, cpLimitMs: diagnostic ? null : cpLimitMs,
      runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
      proof: { witnessAudit: 'PASS', engineCompleted: verified.completed, independentOptimality: 'NOT_CLAIMED_BY_WITNESS_AUDIT' } };
  } finally { solver?.close();clearInterval(memoryTimer);memoryDiagnostic?.close(); }
}
if (process.send) {
  process.once('message', async ({ job }) => {
    let record;
    try { record = await executeTriage(job); }
    catch (error) { record = { status: error.code === 'ERR_ASSERTION' ? 'MISMATCH' : 'ERROR',
      error: { name: error.name, message: error.message, stack: error.stack } }; }
    await send({ event: 'result', record }); process.disconnect();
  });
  await send({ event: 'ready' });
}
