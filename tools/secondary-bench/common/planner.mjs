import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { digest, readJson, writeJson, filesUnder, logicalCallId, STAGES, verifySources, sha256 } from './contracts.mjs';
import { validateLock } from './manifest.mjs';
import { describeFixture, captureAdapter } from './adapters.mjs';
import { selection, engineSchedule, eligibleVariants } from './policies.mjs';
import { worstCall, packTasks } from './budget.mjs';
import { loadHistory, verifyHistoryIndex, mergeContinuationHistory } from './evidence.mjs';
import { requireDisk, materializeFixture } from '../followup-storage.mjs';

export function fixtureIndex(lock, historyDir) {
  const m = lock.manifest, imported = m.inputs.fixtures.map(f => describeFixture(f.file, f)), captured = [], seen = new Map();
  for (const file of filesUnder(historyDir).filter(f => /[\\/]fixtures[\\/][^\\/]+\.json$/.test(f))) {
    const f = describeFixture(file), command = m.inputs.commands.find(c => c.id === f.commandId);
    assert(command && digest(command) === f.commandHash, 'fixture command changed');
    if (seen.has(f.id)) { assert.equal(seen.get(f.id), f.sha256); continue; }
    seen.set(f.id, f.sha256); captured.push(f);
  }
  return { imported, captured };
}
function makeCall(lock, stage, inputId, inputHash, variant, repeat, phase, limits, extra = {}) {
  return { logicalCallId: logicalCallId(lock, stage, inputId, inputHash, variant, repeat, phase, limits),
    inputId, inputHash, variant, repeat, phase, limits, ...extra };
}
export function buildTasks(lock, stage, index, history) {
  const m = lock.manifest, tasks = [], decisions = [], chosen = selection(m, index.captured, index.imported);
  if (stage === 'preflight' || stage === 'acquire') {
    for (const command of stage === 'preflight' ? m.inputs.diagnostics : m.inputs.commands) {
      const limits = stage === 'preflight' ? m.limits.diagnostic : m.limits.capture;
      const adapter = stage === 'preflight' ? 'collector-diagnostic' : captureAdapter(command);
      const call = makeCall(lock, stage, command.id, digest(command), adapter, 1, stage.toUpperCase(), limits);
      tasks.push({ id: digest({ stage, command }), adapter, command, calls: [call],
        worstMs: stage === 'preflight' ? worstCall(limits, m.budget.job) : worstCall(limits, m.budget.job) });
    }
  } else {
    const schedule = engineSchedule(chosen.selected, m.repeats.initial + m.repeats.additional, m.repeats.seed);
    for (const f of chosen.selected) {
      const variants = eligibleVariants(stage, m, history.rows, f.id, decisions);
      const calls = schedule.filter(c => c.inputId === f.id && variants.includes(c.engine)
        && (stage === 'initial' ? c.repeat <= m.repeats.initial : c.repeat > m.repeats.initial))
        .map(c => makeCall(lock, stage, f.id, f.sha256, c.engine, c.repeat, stage === 'initial' ? 'INITIAL' : 'VARIABILITY_RETEST', m.limits.secondary,
          { position: c.position, blockId: c.blockId }));
      if (calls.length) tasks.push({ id: digest({ stage, id: f.id }), adapter: m.measurement.adapter, fixture: f,
        calls, worstMs: calls.reduce((s, c) => s + worstCall(c.limits, m.budget.job), 0) });
    }
    if (stage === 'initial') for (const id of new Set(m.inputs.recovery.map(c => c.inputId))) {
      const f = index.imported.find(f => f.id === id); assert(f);
      const calls = m.inputs.recovery.filter(c => c.inputId === id).map(c => makeCall(lock, stage, id, f.sha256, c.engine, c.repeat,
        'RECOVERY', c.limits, { recoveryOf: c.proof }));
      tasks.push({ id: digest({ stage, recovery: id }), adapter: 'secondary-fixture', fixture: f,
        calls, worstMs: calls.reduce((s, c) => s + worstCall(c.limits, m.budget.job), 0) });
    }
  }
  return { tasks, decisions, selection: chosen.ledger };
}
function reconcileContinuation(lock, stage, tasks) {
  const c = lock.manifest.continuation; if (!c) return tasks;
  verifyHistoryIndex(c.history, c.historyIndexSha256, lock.manifest.campaignId);
  const history = loadHistory(c.history, lock.manifest.campaignId);
  assert(!history.unknown.length && !history.warnings.length, 'unknown parent execution cannot be replayed');
  const parentPlans = filesUnder(c.history).filter(f => path.basename(f) === 'STAGE_PLAN.json').map(readJson).filter(p => p.stage === stage);
  const scheduled = new Set(parentPlans.flatMap(p => p.expectedCalls.map(c => c.logicalCallId)));
  return tasks.map(task => {
    const calls = task.calls.filter(call => {
      const old = history.rows.filter(r => r.logicalCallId === call.logicalCallId);
      if (!old.length) { assert(!scheduled.has(call.logicalCallId), 'missing parent raw is not proof of NOT_RUN'); return true; }
      return old.every(r => r.executionAttemptId === null && r.status.startsWith('NOT_RUN_'));
    });
    return { ...task, calls, worstMs: calls.reduce((s, c) => s + worstCall(c.limits, lock.manifest.budget.job), 0) };
  }).filter(t => t.calls.length);
}
export function planStage(lock, historyDir, outputDir, stage) {
  validateLock(lock); verifySources(lock.manifest.sourceFiles); assert(STAGES.includes(stage));
  assert(!fs.existsSync(outputDir), 'new plan directory required');
  mergeContinuationHistory(lock, historyDir);
  const history = loadHistory(historyDir, lock.manifest.campaignId), index = fixtureIndex(lock, historyDir);
  assert(!history.unknown.length && !history.warnings.length, 'incomplete history cannot drive selection');
  for (const row of history.rows) {
    assert.equal(row.conditionHash, lock.conditionHash, 'history measurement condition changed');
    assert.equal(row.productHash, lock.productHash, 'history product changed');
  }
  if (stage !== 'preflight' && lock.manifest.inputs.diagnostics.length) {
    for (const c of lock.manifest.inputs.diagnostics) assert(history.rows.some(r => r.inputId === c.id
      && r.adapter === 'collector-diagnostic' && r.status === 'COLLECTOR_MATCH'), 'adapter diagnostic missing/failed');
  }
  const built = buildTasks(lock, stage, index, history), tasks = reconcileContinuation(lock, stage, built.tasks);
  const chunks = packTasks(tasks, lock.manifest.budget.job);
  const expectedCalls = tasks.flatMap(t => t.calls.map(c => ({ ...c, adapter: t.adapter })));
  assert.equal(new Set(expectedCalls.map(c => c.logicalCallId)).size, expectedCalls.length);
  const prior = filesUnder(historyDir).filter(f => path.basename(f) === 'STAGE_PLAN.json').map(readJson).filter(p => p.stage !== stage);
  assert(new Set([...prior.flatMap(p => p.expectedCalls), ...expectedCalls].map(c => c.logicalCallId)).size <= lock.manifest.budget.maxCalls, 'campaign maxCalls exceeded');
  const plan = { schemaVersion: 1, campaignId: lock.manifest.campaignId, invocationId: lock.invocationId,
    manifestHash: lock.manifestHash, stage, status: chunks.length ? 'PLANNED' : 'EMPTY_COMPLETE', chunks: chunks.length,
    expectedCalls, decisions: built.decisions, selection: built.selection, population: lock.manifest.inputs.commands.map(c => c.id),
    inputFixtures: [...index.captured, ...index.imported], originUtc: lock.originUtc, endUtc: lock.endUtc };
  plan.stagePlanId = digest(plan);
  fs.mkdirSync(outputDir, { recursive: false });
  const metadataBytes = chunks.length * (Buffer.byteLength(JSON.stringify(lock)) + 256 * 1024);
  requireDisk(outputDir, metadataBytes, { reserveBytes: lock.manifest.evidence.diskReserveBytes });
  for (const [i, chunk] of chunks.entries()) {
    const dir = path.join(outputDir, 'chunks', String(i)); fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
    const descriptors = chunk.tasks.map(task => {
      if (!task.fixture) return task;
      const f = task.fixture, member = `fixtures/${f.sha256}.json`, destination = path.join(dir, member);
      if (!fs.existsSync(destination)) materializeFixture(f.file, destination, { size: f.byteLength, bytes: () => fs.readFileSync(f.file),
        storage: (directory, bytes) => requireDisk(directory, bytes + metadataBytes, { reserveBytes: lock.manifest.evidence.diskReserveBytes }) });
      return { ...task, fixture: { id: f.id, sha256: f.sha256, path: member, metadata: f.metadata } };
    });
    writeJson(path.join(dir, 'LOCK.json'), lock);
    writeJson(path.join(dir, 'CHUNK.json'), { schemaVersion: 1, stagePlanId: plan.stagePlanId, stage,
      chunk: i, tasks: descriptors, callsHash: digest(descriptors.flatMap(t => t.calls)), manifestHash: lock.manifestHash });
  }
  writeJson(path.join(outputDir, 'STAGE_PLAN.json'), plan); return plan;
}
