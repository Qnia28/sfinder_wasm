import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encoder, Field } from 'tetris-fumen';
import { validateFixture, packedView, fixtureIdentity, verifyResult, assertExact, validateLimits, hash, writeJson } from '../tools/secondary-bench/contracts.mjs';
import { mirrorBoard, groupFor, auditDatabases, applyExposure } from '../tools/secondary-bench/catalog.mjs';
import { informationSchedule, validateManifest } from '../tools/secondary-bench/schedule.mjs';
import { selectInformationRetests, selectABRetests } from '../tools/secondary-bench/select-retests.mjs';
import { runIsolated } from '../tools/secondary-bench/isolation.mjs';
import { extractCommand, collectCommand } from '../tools/secondary-bench/extract.mjs';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { calculatePerSaveMinimalsFromBoardAsync } from '../src/per-save-minimals-core.mjs';
import { calculateSaveMinimals } from '../src/minimals-feature.mjs';
import { numericPrepared } from '../src/numeric-cover-data.mjs';
import { exactMinimumCover } from '../src/min-cover.mjs';
import { inspectTrivialSecondary } from '../src/min-cover-components.mjs';
import { isORToolsSupported } from '../src/ortools-min-cover.mjs';
import { auditRecords } from '../tools/secondary-bench/audit.mjs';

const fixture = () => ({ schema: 1, id: 'synthetic-weighted', keys: ['000', '001', '002'], K: 2, seed: [0, 2],
  rows: [[[0, 1], [1, 3]], [[1, 1], [2, 4]], [[0, 5], [2, 1]], [[0, 5], [2, 1]]],
  cardinalityProof: { status: 'PROVEN', backend: 'synthetic-independent-js' } });
const limits = { startupMs: 3000, callMs: 10000, reapMs: 3000 };
const realChild = new URL('../tools/secondary-bench/child.mjs', import.meta.url);
const stall = new URL('./helpers/secondary-bench-stall.mjs', import.meta.url);
const isAlive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
function oracle(f) {
  const coverage = new Map(f.rows.map((row, i) => [i, new Set(row.map(([id]) => f.keys[id]))]));
  const qualityFor = (key, ci) => f.rows[ci].find(([id]) => f.keys[id] === key)[1];
  return { ...exactMinimumCover(coverage, { qualityFor }), completed: true };
}

test('bench refuses Fast/quality auto and all missing/unbounded/zero deadlines', () => {
  for (const value of ['true', 'exact', true]) assertExact(value);
  for (const value of ['auto', 'Fast', false, null, undefined]) assert.throws(() => assertExact(value));
  for (const value of [0, -1, Infinity, null, undefined, 2 ** 32]) assert.throws(() => validateLimits({ ...limits, callMs: value }));
  assert.throws(() => validateManifest({ schema: 1, state: 'DRAFT' }), /draft/);
});
test('fixture identity preserves seed, weighted rows, stable IDs and minimal-K provenance', () => {
  const f = validateFixture(fixture());
  assert.notEqual(fixtureIdentity(f), fixtureIdentity({ ...f, seed: [0, 1] }));
  assert.notEqual(fixtureIdentity(f), fixtureIdentity({ ...f, rows: f.rows.slice(0, 3) }));
  assert.throws(() => validateFixture({ ...f, cardinalityProof: { status: 'FEASIBLE' } }));
  assert.throws(() => validateFixture({ ...f, rows: [[[0, 1], [0, 2]]] }));
  const view = packedView({ ...f, keys: [...f.keys, 'unused'] });
  assert.equal(numericPrepared(view.coverage).keys.length, 4);
  const inspected = inspectTrivialSecondary(view.coverage, f.K, view.qualityFor);
  assert.equal(inspected.structure.rowCount, 4);
  const exact = oracle(f);
  verifyResult(f, exact, { engine: 'integrated' });
  assert.throws(() => verifyResult(f, { ...exact, qualityVector: exact.qualityVector.slice(1) }, { engine: 'threshold' }));
  assert.throws(() => verifyResult(f, exact, { engine: 'cpsat' }), /proof/);
});
test('all-candidates structure keeps unknown F/d/u', () => {
  const f = { schema: 1, id: 'all', keys: ['a'], rows: [[[0, 1]]], K: 1, seed: [0], cardinalityProof: { status: 'PROVEN', backend: 'singleton' } };
  const view = packedView(f), inspected = inspectTrivialSecondary(view.coverage, 1, view.qualityFor);
  assert.equal(inspected.structure.forcedCount, null);
  assert.equal(inspected.structure.unforcedSlots, null);
});
test('catalog audits all supplied DBs without asserting unexposed holdout', () => {
  const catalog = auditDatabases(new URL('../tools/secondary-bench/setupdata/', import.meta.url));
  assert.equal(catalog.summary.records, 449);
  assert.equal(catalog.summary.fumenStrings, 411);
  assert(catalog.entries.every(e => e.exposure === 'UNKNOWN'));
  const board = 0x1234567n;
  assert.equal(mirrorBoard(mirrorBoard(board)), board);
  assert.equal(groupFor(board), groupFor(mirrorBoard(board)));
  applyExposure(catalog, { evidence: [{ id: catalog.entries[0].id, source: 'test' }], complete: false, scanCoverage: ['test'] });
  assert.equal(catalog.entries[0].exposure, 'EXPOSED');
  assert(catalog.entries.some(e => e.exposure === 'UNKNOWN'));
});
test('schedule keeps three engines and all repetitions of each matrix on one shard', () => {
  const fixtures = Array.from({ length: 41 }, (_, i) => ({ id: String(i) }));
  const schedule = informationSchedule(fixtures, { repeats: 3, shards: 16, seed: 'frozen' });
  assert.equal(schedule.length, 41 * 3 * 3);
  assert.equal(new Set(schedule.map(c => c.callId)).size, schedule.length);
  for (const f of fixtures) {
    const calls = schedule.filter(c => c.inputId === f.id);
    assert.equal(new Set(calls.map(c => c.shard)).size, 1);
    for (const r of [1, 2, 3]) assert.equal(new Set(calls.filter(c => c.repeat === r).map(c => c.engine)).size, 3);
  }
  assert.deepEqual(schedule, informationSchedule(fixtures, { repeats: 3, shards: 16, seed: 'frozen' }));
  for (const f of fixtures) for (const engine of ['integrated', 'threshold', 'cpsat']) {
    assert.equal(new Set(schedule.filter(c => c.inputId === f.id && c.engine === engine).map(c => c.position)).size, 3);
  }
});
test('information retests select only within-engine variability and do not turn timeout into time', () => {
  const condition = { binary: 'same', lifecycle: 'cold', limits };
  const rows = [['integrated', [1, 1.11]], ['threshold', [10, 10]], ['cpsat', [100, 100]]].flatMap(([engine, times]) => times.map((ms, i) => ({ inputId: 'x', engine, ms, status: 'EXACT', repeat: i + 1, runnerId: 'host', condition })));
  rows.push({ inputId: 'timeout', engine: 'cpsat', status: 'TIMEOUT_CALL', ms: null, repeat: 1, condition });
  const selected = selectInformationRetests(rows, { expectedRepeats: 2 });
  assert.deepEqual(selected.selected.map(r => r.engine), ['integrated']);
  assert.equal(selected.blocked.length, 1);
});
test('A/B retests union both tails, variability and gate impact with all reasons retained', () => {
  const inputs = Array.from({ length: 20 }, (_, i) => ({ inputId: String(i), pairs: [0, 1].map(j => ({ pairId: `${i}/${j}`,
    a: { ms: 10, status: 'EXACT', runnerId: 'vm', condition: { lifecycle: 'same' } },
    b: { ms: i < 10 ? 5 + i * 0.1 : 11 + i * 0.1, status: 'EXACT', runnerId: 'vm', condition: { lifecycle: 'same' } } })) }));
  inputs[0].pairs[1].a.ms = 11.1;
  const selection = selectABRetests(inputs, { gateImpactIds: ['0', '5'], gateContract: 'frozen gate algorithm v1' });
  assert.deepEqual(new Set(selection.selected.map(r => r.inputId)), new Set(['0', '19', '5']));
  assert.equal(selection.selected.find(r => r.inputId === '0').reasons.length, 3);
  assert.throws(() => selectABRetests(inputs, {}));
});
test('parent timeout kills synchronous search and its nested Worker, then next request works', async () => {
  const run = await runIsolated({ childFile: stall, job: { mode: 'busy' }, limits: { ...limits, callMs: 100 } });
  assert.equal(run.status, 'TIMEOUT_CALL'); assert.equal(run.reaped, true); assert.equal(isAlive(run.pid), false);
  const next = await runIsolated({ childFile: stall, job: { mode: 'done' }, limits });
  assert.equal(next.status, 'EXACT'); assert.equal(next.reaped, true);
});
test('startup, cleanup and cancellation have independent finite limits', async () => {
  const start = await runIsolated({ childFile: new URL('./helpers/secondary-bench-startup-stall.mjs', import.meta.url), job: {}, limits: { ...limits, startupMs: 100 } });
  assert.equal(start.status, 'TIMEOUT_STARTUP'); assert(start.reaped);
  const cleanup = await runIsolated({ childFile: stall, job: { mode: 'cleanup-stall' }, limits: { ...limits, reapMs: 500 } });
  assert.equal(cleanup.status, 'ERROR_REAP'); assert.equal(cleanup.reaped, true); assert.equal(isAlive(cleanup.pid), false);
  const controller = new AbortController(); controller.abort();
  const cancelled = await runIsolated({ childFile: stall, job: {}, limits, signal: controller.signal });
  assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.pid, undefined);
});
test('capture phase watchdog cannot be displaced by the full command deadline', async () => {
  const run = await runIsolated({ childFile: stall, job: { mode: 'phase-stall' }, limits,
    phaseLimits: { enumeration: 100, primary: 100 } });
  assert.equal(run.status, 'TIMEOUT_PHASE_ENUMERATION'); assert.equal(run.reaped, true);
});
test('in-flight cancellation reclaims an owned child and its nested Worker', async () => {
  const controller = new AbortController();
  const run = await runIsolated({ childFile: stall, job: { mode: 'busy' }, limits, signal: controller.signal,
    onEvent: message => { if (message.event === 'nested-worker') controller.abort(); } });
  assert.equal(run.status, 'CANCELLED'); assert.equal(run.reaped, true); assert.equal(isAlive(run.pid), false);
});
test('real three engines agree with independent JS oracle on tiny weighted fixture', async () => {
  const temporaryRoot = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'secondary-bench-contract-'));
  const filename = path.join(directory, 'fixture.json'), f = fixture(); writeJson(filename, f);
  const expected = oracle(f), bytes = fs.readFileSync(filename);
  for (const engine of ['integrated', 'threshold', 'cpsat']) {
    if (engine === 'cpsat' && !isORToolsSupported()) throw new Error('run tests with --experimental-wasm-stack-switching; CP must not be skipped');
    const run = await runIsolated({ childFile: realChild, limits,
      job: { action: 'secondary', engine, fixturePath: filename, fixtureSha256: hash(bytes), exactHumanQuality: 'true', cpLimitMs: 5000 } });
    assert.equal(run.status, 'EXACT', JSON.stringify(run)); assert(run.reaped);
    assert.deepEqual(run.result.result.keys, expected.keys); assert.deepEqual(run.result.result.qualityVector, expected.qualityVector);
    assert.equal(run.result.stateBudget, null); assert.equal(run.result.qualityResolved, 'true');
  }
  fs.unlinkSync(filename); fs.rmdirSync(directory);
});
test('offline audit rejects forged exact witness, duplicate calls and missing scheduled calls', () => {
  const f = fixture(), bytes = Buffer.from(JSON.stringify(f)), sourceFiles = { 'fake-source-for-contract-only': 'locked' };
  const plan = { fixtures: [{ id: f.id, path: 'fixture', sha256: hash(bytes) }], repeats: 2, shards: 1, scheduleSeed: 'audit-test', sourceFiles };
  const records = informationSchedule(plan.fixtures, { repeats: 2, shards: 1, seed: plan.scheduleSeed }).map(call => {
    const result = { ...oracle(f), qualityComplete: true, tieComplete: true };
    return { callId: call.callId, inputId: call.inputId, engine: call.engine, repeat: call.repeat, shard: call.shard,
      status: 'EXACT', ms: 1, condition: { fixtureSha256: hash(bytes), sourceLock: hash(JSON.stringify(sourceFiles)), exactHumanQuality: 'true' },
      execution: { reaped: true, code: 0, status: 'EXACT', result: { status: 'EXACT', responseMs: 1, result,
        verified: verifyResult(f, result, { engine: call.engine }), qualityResolved: 'true', stateBudget: null } } };
  });
  assert.equal(auditRecords(plan, records, () => bytes).harnessAudit, 'PASS');
  assert.equal(auditRecords(plan, records.slice(1), () => bytes).harnessAudit, 'FAIL');
  assert.equal(auditRecords(plan, [...records, records[0]], () => bytes).harnessAudit, 'FAIL');
  const forged = structuredClone(records);
  forged[0].execution.result.result.qualityVector = [999];
  assert.equal(auditRecords(plan, forged, () => bytes).harnessAudit, 'FAIL');
});
test('capture collector and exact-primary interception agree with product per-save and minimals', async () => {
  const field = Field.create('__________XXXXXX____');
  const sourceFumen = encoder.encode([{ field }]);
  // 14 empty cells is not a PC: use an 8-cell gap in two rows.
  const valid = encoder.encode([{ field: Field.create('XXXXXXXX__XXXX______') }]);
  const command = { id: 'synthetic-board', kind: 'per-save', sourceFumen: valid, clear: 2, pattern: '*p3', useHold: true, exactHumanQuality: 'true', primary: 'rust' };
  const solver = await createWasmSolver(2);
  const compact = solver.enumeratePcPatternCompact, numeric = solver.enumeratePcPattern;
  try {
    assert.throws(() => collectCommand({ ...command, sourceFumen }, solver));
    const collected = collectCommand(command, solver);
    const product = await calculatePerSaveMinimalsFromBoardAsync({ board: collected.board, queues: collected.cases, solver, exactHumanQuality: 'true', primary: 'rust', secondary: 'rust', secondaryWorkers: 0, includeCoverage: true });
    for (const [piece, group] of collected.groups) assert.deepEqual([...(group.coverage.toMap?.() ?? group.coverage)], [...product.results[piece].coverage]);
    const captured = await extractCommand(command, solver);
    assert(captured.fixtures.length > 0); assert.equal(captured.captureOnly, true);
    for (const f of captured.fixtures) assert.equal(f.K, product.results[f.origin.filter].minimalCount);
    const ordinary = { ...command, kind: 'minimals', wantedSave: 'T' };
    const collectedOrdinary = collectCommand(ordinary, solver);
    if (collectedOrdinary.groups.get('T').coverage.size) {
      const result = await calculateSaveMinimals({ sourceFumen: valid, analysisPattern: '*p3', wantedSave: 'T', solver, height: 2, exactHumanQuality: 'true', primary: 'rust', secondary: 'rust' });
      const coverage = collectedOrdinary.groups.get('T').coverage;
      assert.deepEqual([...(coverage.toMap?.() ?? coverage)], [...result.coverage]);
    }
    for (const route of ['numeric', 'general']) {
      solver.enumeratePcPatternCompact = () => null;
      if (route === 'general') solver.enumeratePcPattern = undefined;
      const alternate = collectCommand(command, solver);
      for (const [piece, group] of alternate.groups) assert.deepEqual([...(group.coverage.toMap?.() ?? group.coverage)], [...product.results[piece].coverage]);
      const alternateCapture = await extractCommand(command, solver);
      assert.deepEqual(alternateCapture.fixtures.map(f => f.contentIdentity), captured.fixtures.map(f => f.contentIdentity));
    }
  } finally { solver.enumeratePcPatternCompact = compact; solver.enumeratePcPattern = numeric; solver.close(); }
});
