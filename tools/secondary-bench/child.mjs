// One disposable OS process per exact call; the parent owns all deadlines.
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { ENGINES, assertExact, positiveMs, readJson, hash, validateFixture,
  packedView, verifyResult, fixtureIdentity, writeJson } from './contracts.mjs';

const send = message => new Promise((resolve, reject) => process.send(message, error => error ? reject(error) : resolve()));
const phase = (name, details = {}) => { process.send({ event: 'phase', name, ...details, at: performance.now() }); };
async function execute(job) {
  assertExact(job.exactHumanQuality);
  let solver, api;
  const started = performance.now(), cpuStart = process.cpuUsage(), timings = {};
  try {
    if (job.action === 'collector-preflight') {
      phase('init');
      const { createWasmSolver } = await import('../../src/wasm-backend.mjs');
      const { auditAllCollector } = await import('./collector-contract.mjs');
      solver = await createWasmSolver(job.command.clear);
      phase('enumeration');
      return auditAllCollector(job.command, solver);
    }
    if (job.action === 'capture') {
      phase('init');
      const { createWasmSolver } = await import('../../src/wasm-backend.mjs');
      const { extractCommand } = await import('./extract.mjs');
      solver = await createWasmSolver(job.command.clear);
      timings.initMs = performance.now() - started;
      fs.mkdirSync(job.outputDir, { recursive: true });
      const fixtures = [];
      const capture = await extractCommand({ ...job.command, exactHumanQuality: job.exactHumanQuality }, solver, {
        onPhase: phase,
        async onFixture(fixture, index) {
          const filename = path.join(job.outputDir, `${job.fixturePrefix ?? ''}${index}.json`);
          // OOM/cancellation can leave a partial write. Only complete, fsynced
          // fixtures receive the final .json name; retain .partial as evidence.
          const partial = filename + '.partial';
          writeJson(partial, fixture);
          fs.renameSync(partial, filename);
          const record = { id: fixture.id, path: filename, sha256: hash(fs.readFileSync(filename)), identity: fixture.contentIdentity };
          fixtures.push(record);
          await send({ event: 'fixture-saved', ...record });
        },
      });
      return { status: 'CAPTURED', ...capture, fixtures, timings, captureOnly: true };
    }
    if (job.action !== 'secondary' || !ENGINES.includes(job.engine)) throw new Error('invalid benchmark action/engine');
    phase('fixture');
    const fixtureBytes = fs.readFileSync(job.fixturePath);
    if (job.fixtureSha256 !== hash(fixtureBytes)) throw new Error('fixture hash mismatch');
    const fixture = validateFixture(readJson(job.fixturePath));
    timings.fixtureMs = performance.now() - started;
    let result;
    phase('init');
    const init = performance.now();
    if (job.engine === 'cpsat') {
      positiveMs(job.cpLimitMs, 'cpLimitMs');
      const { assertORToolsSupported } = await import('../../src/ortools-min-cover.mjs');
      assertORToolsSupported(); // Never silently measure a Rust fallback as CP.
      api = await import('../../src/vendor/ortools/node/cp-sat.js');
      const { solveCpSecondaryModel } = await import('../../src/cpsat-secondary-model.mjs');
      timings.initMs = performance.now() - init;
      phase('search');
      const search = performance.now();
      result = await solveCpSecondaryModel({ keys: fixture.keys, rows: fixture.rows, count: fixture.K, seed: fixture.seed }, api, { limitMs: job.cpLimitMs });
      timings.modelAndSearchMs = performance.now() - search;
    } else {
      const { createWasmSolver } = await import('../../src/wasm-backend.mjs');
      solver = await createWasmSolver(4, { legal: false });
      timings.initMs = performance.now() - init;
      phase('packing');
      const packing = performance.now(), view = packedView(fixture);
      timings.packingMs = performance.now() - packing;
      phase('search');
      const search = performance.now();
      result = solver.minimumCoverAtCount(view.coverage, fixture.K, { qualityFor: view.qualityFor,
        seedKeys: fixture.seed.map(id => fixture.keys[id]), integrated: job.engine === 'integrated', stateBudget: null });
      timings.wrapperNativeAndSearchMs = performance.now() - search;
    }
    const responseMs = performance.now() - started;
    phase('audit');
    const auditStart = performance.now(), verified = verifyResult(fixture, result, { engine: job.engine });
    timings.auditMs = performance.now() - auditStart;
    const cpu = process.cpuUsage(cpuStart);
    return { status: verified.completed ? 'EXACT' : 'INCOMPLETE', engine: job.engine,
      qualityRequested: job.exactHumanQuality, qualityResolved: 'true', stateBudget: null,
      result, verified, fixtureSha256: hash(fixtureBytes), fixtureIdentity: fixtureIdentity(fixture),
      responseMs, timings, proof: { engineCompleted: verified.completed,
        witnessAudit: 'PASS', independentOptimality: 'PENDING_CROSS_ENGINE_OR_ORACLE' },
      cpuUs: cpu, maxRssKiB: process.resourceUsage().maxRSS,
      runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
      unobserved: ['nativePreparationSeparate', 'searchSeparate', 'callingThreadCpu', 'processTreePeakMemory'] };
  } finally {
    phase('cleanup');
    const cleanup = performance.now();
    solver?.close();
    await api?.terminateLoadedRuntimeThreads();
    timings.cleanupMs = performance.now() - cleanup;
  }
}
process.once('message', async ({ job }) => {
  let record;
  try { record = await execute(job); }
  catch (error) { record = { status: error.code === 'ERR_ASSERTION' ? 'MISMATCH' : 'ERROR', error: { name: error.name, message: error.message, stack: error.stack } }; }
  await send({ event: 'result', record });
  process.disconnect();
});
await send({ event: 'ready' });
