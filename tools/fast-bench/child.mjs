import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createWasmSolver } from '../../src/wasm-backend.mjs';
import { capture } from './capture.mjs';
import { prepareFastFixture, runFastFixedK, ARMS } from './adapter.mjs';
import { hash, selectedVector } from '../secondary-bench/contracts.mjs';
import { ARM_OPTIONS } from '../fast-triage/planner.mjs';
import { verifyTelemetry } from '../fast-triage/verify.mjs';
import { STUDY as ROUTING_STUDY, ARM_OPTIONS as ROUTING_OPTIONS } from '../fast-routing/policies.mjs';
import { verifyRoutingTelemetry } from '../fast-routing/verify.mjs';

const send = m => new Promise((resolve, reject) => process.send(m, e => e ? reject(e) : resolve()));
const phase = name => process.send({ event: 'phase', name });
function readFixture(ref, root) {
  const bytes = fs.readFileSync(path.join(root, ref.member));
  assert.equal(hash(bytes), ref.sha256, 'fixture compressed hash mismatch');
  return JSON.parse(gunzipSync(bytes));
}
async function execute(job) {
  let solver;
  const started = performance.now();
  try {
    solver = await createWasmSolver(4, { legal: job.mode !== 'matrix' });
    const initialized = performance.now();
    if (job.mode === 'capture') {
      fs.mkdirSync(job.fixtureDir, { recursive: true });
      return await capture(job.command, solver, phase, async fixture => {
        const member = hash(fixture.id) + '.json.gz';
        const bytes = gzipSync(JSON.stringify(fixture), { level: 1 });
        const file = path.join(job.fixtureDir, member);
        const fd = fs.openSync(file + '.partial', 'wx');
        try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        fs.renameSync(file + '.partial', file);
        const ref = { member, sha256: hash(bytes), bytes: bytes.length, contentIdentity: fixture.contentIdentity };
        await send({ event: 'fixture-saved', ...ref, id: fixture.id });
        return ref;
      });
    }
    if (job.mode === 'matrix') {
      const fixture = readFixture(job.fixture, job.inputRoot);
      const begin = performance.now(), context = prepareFastFixture(fixture, solver);
      const prepareMs = performance.now() - begin;
      return { ...runFastFixedK(context, solver, job.arm, { trace: job.trace }),
        fixtureId: fixture.id, contentIdentity: fixture.contentIdentity,
        initMs: initialized - started, prepareMs,
        representation: fixture.representation };
    }
    assert.equal(job.mode, 'e2e');
    const routing = job.study === ROUTING_STUDY;
    const c = job.command, secondary = job.arm === 'DIRECT' && !routing ? '2x2' : 'auto';
    const triage = job.study === 'fast-triage-e2e-20261017';
    if (triage) assert(Object.hasOwn(ARM_OPTIONS, job.arm));
    if (routing) assert(Object.hasOwn(ROUTING_OPTIONS, job.arm));
    const budgetOptions = routing ? { ...ROUTING_OPTIONS[job.arm], fastDiagnostics: job.diagnostics }
      : triage ? { ...ARM_OPTIONS[job.arm], fastDiagnostics: job.diagnostics }
      : { fastStateBudget: ARMS[job.arm][0] || undefined };
    const apiStart = performance.now();
    let result, encoded, empty = false;
    try {
      if (c.kind === 'minimals') {
        const api = await import('../../src/minimals-feature.mjs');
        result = await api.calculateSaveMinimals({ sourceFumen: c.sourceFumen, analysisPattern: c.pattern,
          wantedSave: c.wantedSave, solver, useHold: true, height: 4, primary: 'auto', secondary,
          ...budgetOptions });
        encoded = api.encodeSaveMinimalFumen(result);
      } else {
        const api = await import('../../src/per-save-minimals.mjs');
        result = await api.calculatePerSaveMinimalsAsync({ sourceFumen: c.sourceFumen, pattern: c.pattern,
          solver, useHold: true, targetLines: 4, primary: 'auto', secondary,
          ...budgetOptions, secondaryWorkers: 0, filterWorkers: 0, includeCoverage: false });
        encoded = api.encodePerSaveMinimals({ sourceFumen: c.sourceFumen, calculation: result });
      }
    } catch (error) {
      if (error.message === 'no minimal' && job.filters.every(f => f.status === 'EMPTY')) empty = true;
      else throw error;
    }
    const policyMs = performance.now() - started;
    const apiMs = performance.now() - apiStart;
    const groups = empty ? {} : c.kind === 'minimals' ? { [c.wantedSave]: result } : result.results;
    const outcomes = {};
    for (const f of job.filters) {
      const r = groups[f.filter];
      if (f.status === 'EMPTY') {
        assert(!r?.keys?.length, 'empty capture has returned solutions');
        outcomes[f.filter] = { status: 'EMPTY' }; continue;
      }
      assert(r, 'missing product save group');
      const fixture = readFixture(f, job.inputRoot), indices = new Map(fixture.keys.map((k, i) => [k, i]));
      assert.equal(r.minimalCount, fixture.K);
      const selected = r.keys.map(k => indices.get(k));
      assert.deepEqual(r.humanQualityVector, selectedVector(fixture, selected));
      if (triage) verifyTelemetry(fixture, r, job.arm, job.diagnostics);
      if (routing) verifyRoutingTelemetry(fixture, r, job.arm, job.diagnostics);
      outcomes[f.filter] = { keys: r.keys, selected, qualityVector: r.humanQualityVector,
        qualityExact: r.humanQualityExact, K: r.minimalCount, cardinalityBackend: r.cardinalityBackend,
        qualityBackend: r.qualityBackend, primaryResolved: r.primaryResolved,
        fastDecision: r.fastDecision ?? null, fastProbeStates: r.fastProbeStates ?? null,
        qualityRefinementPasses: r.qualityRefinementPasses ?? r.fastTelemetry?.stages.find(s => s.name === 'refine')?.passes ?? null,
        fastTelemetry: r.fastTelemetry ?? null,
        fastBypass: ['rust-legacy-exact', 'direct-exact'].includes(r.qualityBackend) ? r.qualityBackend : null,
        captureIdentity: fixture.contentIdentity,
        primarySeedIdentity: r.fastTelemetry?.stages.find(s => s.name === 'primary')?.keys
          ? hash(JSON.stringify(r.fastTelemetry.stages.find(s => s.name === 'primary').keys)) : 'UNOBSERVED_PRODUCT_API',
        sameCaptureK: true, witnessAudit: 'PASS' };
    }
    assert(Object.keys(groups).every(f => job.filters.some(x => x.filter === f)), 'unexpected product filter');
    return { status: empty ? 'RETURNED_EMPTY' : Object.values(outcomes).every(r => r.status === 'EMPTY' || r.qualityExact)
      ? 'RETURNED_EXACT' : 'RETURNED_APPROX', policyMs, apiMs, initMs: initialized - started,
      outcomes, encoded, primary: 'auto', secondaryWorkers: 0, filterWorkers: 0,
      phaseBreakdown: triage || routing ? 'PER_FILTER_FAST_TELEMETRY; API includes enumeration and encoding' : 'UNOBSERVED_TRACE_OFF_PUBLIC_API',
      command: c, arm: job.arm, diagnostics: job.diagnostics ?? false };
  } finally { solver?.close(); }
}
process.once('message', async ({ job }) => {
  try { await send({ event: 'result', record: await execute(job) }); }
  catch (error) { await send({ event: 'result', record: { status: 'ERROR', error: error.stack } }); }
  finally { process.disconnect(); }
});
await send({ event: 'ready' });
