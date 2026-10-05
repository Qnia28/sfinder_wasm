// Separate F/A campaigns. Preparation/planning/reporting are offline, not dispatch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ENGINES, readJson, writeJson, hash, identity, validateFixture, verifyResult } from './contracts.mjs';
import { filesUnder } from './plan-wave.mjs';
import { originalStructure } from './export-classifier-raw.mjs';
import { informationSchedule } from './schedule.mjs';
import { isolatedScope } from './followup-scope.mjs';
import { ORTOOLS_PRIMARY_PARAMETERS } from '../../src/ortools-min-cover.mjs';
import { DISK_RESERVE_BYTES, requireDisk, materializeFixture } from './followup-storage.mjs';

export const FOLLOWUP_POLICY = Object.freeze({ F: { maxParallel: 8, overallMs: 36 * 3600000, callMs: 60000, primaryMs: 60000 },
  A: { maxParallel: 12, overallMs: 108 * 3600000, callMs: 300000, primaryMs: 300000 } });
export const SHAPE = Object.freeze({ parts: 3, jobMs: 125 * 60000, reserveMs: 5 * 60000,
  setupMs: 10 * 60000, checkpointMs: 2 * 60000,
  finalTransportMs: 15 * 60000, transportAuditMs: 3 * 60000,
  jobMinutes: 150, taskMinutes: 75, scopeOverheadMs: 20000 });
export const taskCapacityMs = () => SHAPE.jobMs - SHAPE.reserveMs - SHAPE.setupMs - SHAPE.parts * SHAPE.checkpointMs;
const limitsFor = callMs => ({ startupMs: 10000, callMs, reapMs: 5000 });
const worst = limits => limits.startupMs + limits.callMs + 2 * limits.reapMs + SHAPE.scopeOverheadMs;
const jsonLines = file => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const relative = file => path.relative(root, path.resolve(file)).replaceAll('\\', '/');

export function lockedBytes(file) {
  const bytes = fs.readFileSync(file);
  // Product checkouts use platform EOL; experiments froze canonical Git/Linux bytes.
  const text = bytes.toString('utf8');
  return (/^(src|rust|wasm)\//.test(file) || ['package.json', 'package-lock.json'].includes(file))
    && !bytes.includes(0) && Buffer.from(text).equals(bytes) ? Buffer.from(text.replaceAll('\r\n', '\n')) : bytes;
}
export function verifyFollowupFiles(files) {
  for (const [file, sha] of Object.entries(files)) {
    assert(path.resolve(root, file).startsWith(root + path.sep));
    assert.equal(hash(lockedBytes(file)), sha, 'source mismatch: ' + file);
  }
  assert.equal(ORTOOLS_PRIMARY_PARAMETERS.numWorkers, 2, 'primary default must remain two workers');
}
export function commandFor(group, databases, dataset) {
  const entry = databases.get(group.representativeSource + '/' + group.representativeId); assert(entry);
  return group.families.map(family => ({ id: `${entry.id}/${dataset === 'A' ? 'all/' : ''}${family.family}`,
    kind: dataset === 'A' ? 'minimals' : 'per-save', ...(dataset === 'A' ? { wantedSave: 'ALL' } : {}),
    sourceFumen: entry.fumen, clear: 4, pattern: family.pattern, family: family.family,
    mirrorGroup: group.mirrorGroup, useHold: true, exactHumanQuality: 'true', primary: 'auto',
    database: group.representativeSource, expectedCases: family.cases, piecesNeeded: group.geometry.piecesNeeded,
    queueLength: group.geometry.queueLength, savedPieceCount: 1, sourceAliases: group.aliases }));
}
export function prepareFollowup(outputDir, { rawDir = 'benchmark-results/classifier-raw-20261005' } = {}) {
  assert(!fs.existsSync(outputDir), 'prepare into a NEW directory');
  const inventory = readJson('tools/secondary-bench/planning/INPUT_PROPOSAL_2FAMILY.json').inventory;
  const databases = new Map();
  for (const file of filesUnder('tools/secondary-bench/setupdata')) for (const entry of readJson(file)) databases.set(path.basename(file) + '/' + entry.id, entry);
  const metadata = jsonLines(path.join(rawDir, 'fixtures.jsonl')), oldCalls = jsonLines(path.join(rawDir, 'calls.jsonl'));
  const evidence = readJson('tools/secondary-bench/planning/ASTRA_ROUTING_EVIDENCE_20261005.json');
  const supplementIds = new Set([...evidence.coverage.unselectedOutsideMarginalBounds.map(f => f.fixtureId),
    ...metadata.filter(f => f.mirrorGroup === '3c0f03c0f' && !f.trivial && !f.selectedForMeasurement).map(f => f.fixtureId)]);
  const oomIds = new Set(oldCalls.filter(c => c.runId === '37226653891' && c.status === 'OOM').map(c => c.fixtureId));
  const recoveryRows = oldCalls.filter(c => c.runId === '37226653891' && c.phase === 'INITIAL' && !c.executed
    && (c.engine !== 'integrated' || !oomIds.has(c.fixtureId)));
  assert.equal(supplementIds.size, 23); assert.equal(recoveryRows.length, 191);
  const recovery = recoveryRows.map(c => {
    const line = fs.readFileSync(c.rawFile, 'utf8').split(/\r?\n/)[c.rawLine - 1], original = JSON.parse(line);
    assert.equal(original.status, c.status); assert.equal(original.execution, undefined);
    return { inputId: c.fixtureId, engine: c.engine, repeat: c.repeat, originalRunId: c.runId,
      originalSourceLock: c.sourceLock, originalStatus: c.status, rawFile: c.rawFile, rawLine: c.rawLine, rawLineSha256: hash(line) };
  });
  const requiredIds = new Set([...supplementIds, ...recovery.map(c => c.inputId)]);
  const imported = metadata.filter(f => requiredIds.has(f.fixtureId)).map(f => {
    const bytes = fs.readFileSync(f.fixtureFile); assert.equal(hash(bytes), f.fixtureSha256); validateFixture(JSON.parse(bytes));
    return { id: f.fixtureId, sha256: f.fixtureSha256, originalFile: f.fixtureFile, bytesBase64: bytes.toString('base64') };
  });
  assert.equal(imported.length, requiredIds.size); assert.equal(imported.length, 45);
  const first = readJson('benchmark-results/campaign-37222172267/basic-two-plan/campaign.json');
  const sourceFiles = {};
  for (const [file, sha] of Object.entries(first.sourceFiles)) if (/^(src|wasm|rust)\//.test(file) || ['package.json', 'package-lock.json', '.gitattributes'].includes(file)) {
    assert.equal(hash(lockedBytes(file)), sha, 'original solver bytes changed: ' + file); sourceFiles[file] = sha;
  }
  const harness = [...filesUnder('tools/secondary-bench').filter(f => !f.includes('node_modules') && !relative(f).includes('/planning/')
    && !relative(f).includes('/prepared-') && /\.(mjs|sh|yml|json|py)$/.test(f)),
    ...filesUnder('.github/workflows').filter(f => /secondary-bench-(followup-f|all-a)\.yml$/.test(f)),
    ...filesUnder('tests').filter(f => /secondary-bench[^/]*\.mjs$/.test(f)),
    ...filesUnder('tests/helpers').filter(f => /secondary-bench[^/]*\.mjs$/.test(f)),
    ...filesUnder('tools/secondary-bench/setupdata')];
  for (const filename of harness) { const file = relative(filename); sourceFiles[file] = hash(lockedBytes(file)); }
  verifyFollowupFiles(sourceFiles);
  fs.mkdirSync(outputDir, { recursive: false });
  const packed = gzipSync(Buffer.from(JSON.stringify({ schema: 1, originalCaptureSourceLock: identity(first.sourceFiles), imported })), { level: 9 });
  const bundleFile = path.join(outputDir, 'F_ORIGINAL_FIXTURES.json.gz'); fs.writeFileSync(bundleFile, packed, { flag: 'wx' });
  const bundle = { file: relative(bundleFile), sha256: hash(packed), bytes: packed.length,
    fixtures: imported.map(({ bytesBase64, ...f }) => f), originalCaptureSourceLock: identity(first.sourceFiles) };
  const templates = {};
  for (const dataset of ['F', 'A']) {
    const policy = FOLLOWUP_POLICY[dataset];
    const groups = dataset === 'A' ? inventory : inventory.filter(g => g.partition === 'PROPOSED_RESERVE_AUDIT_PENDING');
    const commands = groups.flatMap(g => commandFor(g, databases, dataset)); assert.equal(commands.length, dataset === 'A' ? 550 : 110);
    const captureCallMs = 60000 + (dataset === 'A' ? 1 : 7) * policy.primaryMs + 30000;
    templates[dataset] = { schema: 3, state: 'PREPARED_NOT_DISPATCHED', dataset, purpose: 'information', lifecycle: 'fresh-process-cold',
      exactHumanQuality: 'true', approvalRecord: '2026-10-05 user approves Astra plan; F8VM/A12VM concurrent; prepare only before Actions execution',
      campaignId: `secondary-followup-${dataset}-20261005`, scheduleSeed: `secondary-followup-${dataset}-20261005`,
      policy, shape: SHAPE, solverThreads: { rustPrimary: 1, highsPrimary: 1, cpsatPrimary: 2, rustSecondary: 1, cpsatSecondary: 1 },
      memoryMaxBytes: 3 * 1024 ** 3, swapMaxBytes: 0, sourceFiles, originUtc: null, sourceCommit: null,
      commands, fixtureSelection: dataset === 'A' ? 'ALL_NONTRIVIAL' : 'ONE_PER_COMMAND_HASH_PLUS_FROZEN_SUPPLEMENT',
      limits: limitsFor(policy.callMs), captureLimits: limitsFor(captureCallMs), capturePhaseLimits: { enumeration: 60000, primary: policy.primaryMs },
      initialRepeats: 2, retestRepeats: 2, retestThreshold: 1.10, reusedBundle: dataset === 'F' ? bundle : null,
      supplementIds: dataset === 'F' ? [...supplementIds].sort() : [], recovery: dataset === 'F' ? recovery : [],
      boxPreflight: dataset === 'A' ? commands.filter(c => c.mirrorGroup === '3c0f03c0f') : [],
      allGroupsAreDevelopmentNotFresh: true, originatingMeasurementSourceUnchanged: true };
    writeJson(path.join(outputDir, `${dataset}_TEMPLATE.json`), templates[dataset]);
  }
  const readiness = { schema: 1, state: 'LOCAL_PREPARATION_ONLY', combinedVmCap: 20, datasets: { F: { VMs: 8, captureCommands: 110,
    supplementalFixtures: 23, importedFixtures: 45, recoveryCalls: 191, newBasicMaxCalls: 798, newRetestMaxCalls: 798 },
    A: { VMs: 12, captureCommands: 550, maxBasicCalls: 3300, maxRetestCalls: 3300, boxCommands: 2 } },
    sourceLock: identity(sourceFiles), wasmSha256: sourceFiles['wasm/pc_wasm.wasm'], reusedBundle: bundle,
    oldSolverSourceVerified: true, originalRawModified: false, actionsStarted: false,
    launchRequires: ['commit/publish exact prepared source on experiment branch',
      'after authorization, two explicit workflow_dispatch events OR one marker-only commit containing both validated F_START/A_START files',
      'no legacy measurement workflow runs during the F8VM/A12VM campaigns'] };
  writeJson(path.join(outputDir, 'READINESS.json'), readiness); return readiness;
}

export function validateFollowup(plan, active = false) {
  assert.equal(plan.schema, 3); assert(['F', 'A'].includes(plan.dataset));
  assert.equal(plan.state, active ? 'ACTIVE' : 'PREPARED_NOT_DISPATCHED');
  assert.deepEqual(plan.policy, FOLLOWUP_POLICY[plan.dataset]); assert.deepEqual(plan.shape, SHAPE);
  assert.equal(plan.initialRepeats, 2); assert.equal(plan.retestRepeats, 2); assert.equal(plan.retestThreshold, 1.10);
  assert.deepEqual(plan.solverThreads, { rustPrimary: 1, highsPrimary: 1, cpsatPrimary: 2, rustSecondary: 1, cpsatSecondary: 1 });
  assert(Object.keys(plan.sourceFiles ?? {}).length > 0, 'source lock required');
  assert.equal(plan.memoryMaxBytes, 3 * 1024 ** 3); assert.equal(plan.swapMaxBytes, 0);
  assert.equal(plan.exactHumanQuality, 'true'); assert.equal(plan.limits.callMs, plan.policy.callMs);
  const ids = new Set();
  for (const c of plan.commands) {
    assert(!ids.has(c.id)); ids.add(c.id); assert.equal(c.queueLength, c.piecesNeeded + 1);
    assert.equal(c.clear, 4); assert.equal(c.useHold, true); assert.equal(c.savedPieceCount, 1);
    assert(['bag', 'bag-plus-next-draw', 'restricted-split'].includes(c.family));
    assert.equal(c.kind, plan.dataset === 'A' ? 'minimals' : 'per-save');
    if (plan.dataset === 'A') assert.equal(c.wantedSave, 'ALL');
  }
  if (active) { assert(Number.isFinite(Date.parse(plan.originUtc))); assert(/^[0-9]+$/.test(plan.runId)); }
  return plan;
}
export function activateFollowup(templateFile, originUtc, runId, outputDir) {
  const template = validateFollowup(readJson(templateFile)); verifyFollowupFiles(template.sourceFiles);
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    const marker = readJson(`.github/secondary-followup/${template.dataset}_START.json`);
    assert.equal(marker.confirm, 'RUN_APPROVED_FOLLOWUP'); assert.equal(marker.dataset, template.dataset);
    assert.equal(marker.templateSha256, hash(fs.readFileSync(templateFile)));
    assert.equal(marker.sourceLock, identity(template.sourceFiles));
  }
  assert(Number.isFinite(Date.parse(originUtc))); assert(/^[0-9]+$/.test(runId));
  assert.equal(process.env.GITHUB_RUN_ATTEMPT ?? '1', '1', 'reruns are not new measurement clocks');
  const plan = { ...template, state: 'ACTIVE', campaignId: template.campaignId + '-' + runId, originUtc, runId,
    sourceCommit: process.env.GITHUB_SHA ?? null, templateSha256: hash(fs.readFileSync(templateFile)) };
  fs.mkdirSync(outputDir, { recursive: false }); writeJson(path.join(outputDir, 'campaign.json'), validateFollowup(plan, true));
  return plan;
}
export function followupHistory(directory, plan) {
  const rows = [], keys = new Map(), warnings = [];
  for (const file of filesUnder(directory).filter(f => path.basename(f) === 'raw.jsonl')) {
    const text = fs.readFileSync(file, 'utf8'), lines = text.split(/\r?\n/);
    for (const [i, line] of lines.entries()) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch (error) {
        if (i === lines.length - 1 && !text.endsWith('\n')) { warnings.push({ file, line: i + 1, status: 'TORN_FINAL_APPEND' }); continue; } throw error;
      }
      assert.equal(row.campaignId, plan.campaignId); assert.equal(row.sourceLock, identity(plan.sourceFiles));
      if (keys.has(row.callId)) {
        const previous = keys.get(row.callId), currentSnapshot = path.join(path.dirname(file), 'TRANSPORT_SNAPSHOT.json');
        const previousSnapshot = path.join(path.dirname(previous.file), 'TRANSPORT_SNAPSHOT.json');
        assert(fs.existsSync(currentSnapshot) && fs.existsSync(previousSnapshot), 'duplicate raw call without transport proof');
        const bytes = fs.readFileSync(currentSnapshot);
        assert.equal(hash(bytes), hash(fs.readFileSync(previousSnapshot)), 'different checkpoint snapshots share a call ID');
        const snapshot = JSON.parse(bytes), expectedRaw = snapshot.files.find(f => f.file === 'raw.jsonl')?.sha256;
        assert.equal(hash(text), expectedRaw); assert.equal(hash(fs.readFileSync(previous.file)), expectedRaw);
        assert.equal(line, previous.line, 'different executions share a call ID');
        warnings.push({ status: 'IDENTICAL_TRANSPORT_RETRY', callId: row.callId, canonicalFile: relative(previous.file),
          canonicalLine: previous.lineNumber, aliasFile: relative(file), aliasLine: i + 1, checkpoint: snapshot.checkpoint });
        continue;
      }
      keys.set(row.callId, { file, line, lineNumber: i + 1 });
      rows.push({ ...row, rawFile: relative(file), rawLine: i + 1 });
    }
  }
  return { rows, warnings };
}
function importedFixtures(plan) {
  if (!plan.reusedBundle) return [];
  const bytes = fs.readFileSync(plan.reusedBundle.file); assert.equal(hash(bytes), plan.reusedBundle.sha256);
  const pack = JSON.parse(gunzipSync(bytes)); assert.equal(pack.originalCaptureSourceLock, plan.reusedBundle.originalCaptureSourceLock);
  assert.equal(pack.imported.length, plan.reusedBundle.fixtures.length);
  const expected = new Map(plan.reusedBundle.fixtures.map(f => [f.id, f.sha256]));
  return pack.imported.map(f => {
    const data = Buffer.from(f.bytesBase64, 'base64'); assert.equal(hash(data), expected.get(f.id));
    const fixture = validateFixture(JSON.parse(data)); assert.equal(fixture.id, f.id);
    return { id: f.id, sha256: hash(data), bytes: data, fixture: { id: fixture.id, origin: fixture.origin, trivial: fixture.trivial },
      metadata: fixtureMeta(fixture), originalFile: f.originalFile, acquisition: 'ORIGINAL_FIRST_RUN_CAPTURE_REUSED' };
  });
}
function acquiredFixtures(plan, historyDir) {
  const found = new Map();
  for (const file of filesUnder(historyDir).filter(f => /[\\/]fixtures[\\/][^\\/]+\.json$/.test(f))) {
    const bytes = fs.readFileSync(file), fixture = validateFixture(JSON.parse(bytes)), sha256 = hash(bytes);
    const command = plan.commands.find(c => c.id === fixture.origin.command.id);
    assert(command); assert.deepEqual(command, fixture.origin.command);
    if (found.has(fixture.id)) assert.equal(found.get(fixture.id).sha256, sha256);
    const descriptor = { id: fixture.id, sha256, byteLength: bytes.length, fixture: { id: fixture.id, origin: fixture.origin, trivial: fixture.trivial },
      metadata: fixtureMeta(fixture), originalFile: relative(file), acquisition: 'NEW_CAPTURE' };
    // Large ALL graphs are not retained together in a planner/report process.
    Object.defineProperty(descriptor, 'bytes', { get: () => fs.readFileSync(file) });
    Object.defineProperty(descriptor, 'storagePath', { value: path.resolve(file) });
    found.set(fixture.id, descriptor);
  }
  return [...found.values()];
}
export function selectFollowup(plan, captured, imported) {
  const selected = [], ledger = [];
  for (const command of plan.commands) {
    const candidates = captured.filter(f => f.fixture.origin.command.id === command.id), nontrivial = candidates.filter(f => !f.fixture.trivial);
    nontrivial.sort((a, b) => hash(plan.scheduleSeed + a.id).localeCompare(hash(plan.scheduleSeed + b.id)) || a.id.localeCompare(b.id));
    const take = plan.dataset === 'A' ? nontrivial : nontrivial.slice(0, 1); selected.push(...take);
    ledger.push({ commandId: command.id, captured: candidates.length, nontrivial: nontrivial.length, selected: take.map(f => f.id) });
  }
  for (const id of plan.supplementIds) { const f = imported.find(f => f.id === id); assert(f && !f.fixture.trivial); selected.push(f); }
  assert.equal(new Set(selected.map(f => f.id)).size, selected.length); return { selected, ledger };
}
export function retestDecision(rows, inputId, engine) {
  const rs = rows.filter(r => r.phase === 'INITIAL' && r.inputId === inputId && r.engine === engine);
  if (rs.length !== 2 || rs.some(r => r.status !== 'EXACT' || !Number.isFinite(r.ms) || r.ms <= 0))
    return { eligible: false, reason: rs.some(r => r.status === 'OOM') ? 'OOM_QUARANTINE' : 'INSUFFICIENT_EXACT_REPEATS' };
  const ratio = Math.max(...rs.map(r => r.ms)) / Math.min(...rs.map(r => r.ms));
  return { eligible: ratio >= 1.10, reason: ratio >= 1.10 ? 'WITHIN_ENGINE_VARIABILITY_GE_1_10' : 'NOT_VARIABLE', ratio };
}
function callFor(plan, inputId, engine, repeat, phase, limits, extra = {}) {
  return { callId: hash(`${plan.campaignId}/${phase}/${inputId}/${engine}/${repeat}`).slice(0, 24), inputId, engine, repeat, phase, limits, ...extra };
}
export function makeFollowupTasks(plan, stage, selection, rows) {
  const tasks = [], decisions = [];
  if (stage === 'capture' || stage === 'preflight') {
    const commands = stage === 'preflight' ? plan.boxPreflight : plan.commands;
    for (const command of commands) tasks.push({ id: hash(stage + command.id).slice(0, 20), action: stage === 'preflight' ? 'collector-preflight' : 'capture',
      command, worstMs: stage === 'preflight' ? 150000 : worst(plan.captureLimits) });
  } else {
    assert(['basic', 'retest'].includes(stage));
    const schedule = informationSchedule(selection.selected.map(f => ({ id: f.id })), { repeats: 4, shards: 1, seed: plan.scheduleSeed });
    for (const f of selection.selected) {
      const engines = ENGINES.filter(engine => {
        const d = stage === 'basic' ? { eligible: true, reason: 'BASIC_TWO_ALL_ELIGIBLE_ENGINES' } : retestDecision(rows, f.id, engine);
        decisions.push({ inputId: f.id, engine, stage, ...d }); return d.eligible;
      });
      const calls = schedule.filter(c => c.inputId === f.id && engines.includes(c.engine) && (stage === 'basic' ? c.repeat <= 2 : c.repeat > 2))
        .map(c => callFor(plan, f.id, c.engine, c.repeat, stage === 'basic' ? 'INITIAL' : 'VARIABILITY_RETEST', plan.limits, { position: c.position, blockId: c.blockId }));
      if (calls.length) tasks.push({ id: hash(stage + f.id).slice(0, 20), action: 'secondary', fixture: f, calls, worstMs: calls.reduce((s, c) => s + worst(c.limits), 0) });
    }
    if (stage === 'basic') for (const id of new Set(plan.recovery.map(c => c.inputId))) {
      const f = selection.imported.find(f => f.id === id); assert(f);
      const calls = plan.recovery.filter(c => c.inputId === id).map(c => callFor(plan, id, c.engine, c.repeat, 'RECOVERY', limitsFor(300000), { recoveryOf: c }));
      tasks.push({ id: hash('recovery' + id).slice(0, 20), action: 'secondary', fixture: f, calls, worstMs: calls.reduce((s, c) => s + worst(c.limits), 0) });
    }
  }
  return { tasks, decisions };
}
export function packFollowup(tasks) {
  const chunks = []; let current = [], ms = 0;
  for (const task of tasks) {
    assert(task.worstMs <= taskCapacityMs(), 'task exceeds bounded job including setup/checkpoints');
    if (current.length && (current.length === SHAPE.parts || ms + task.worstMs > taskCapacityMs())) {
      chunks.push({ tasks: current, worstMs: ms }); current = []; ms = 0;
    }
    current.push(task); ms += task.worstMs;
  }
  if (current.length) chunks.push({ tasks: current, worstMs: ms });
  assert(chunks.length <= 256, 'matrix exceeds GitHub limit'); return chunks;
}
export function planFollowup(planFile, historyDir, outputDir, stage) {
  const plan = validateFollowup(readJson(planFile), true); verifyFollowupFiles(plan.sourceFiles);
  const history = followupHistory(historyDir, plan), captured = acquiredFixtures(plan, historyDir);
  const imported = importedFixtures(plan);
  const selection = { ...selectFollowup(plan, captured, imported), imported };
  for (const entry of selection.ledger) {
    const capture = history.rows.find(r => r.action === 'capture' && r.inputId === entry.commandId);
    entry.captureStatus = capture?.status ?? 'MISSING_CAPTURE_RAW';
    entry.captureComplete = capture?.status === 'CAPTURED';
    entry.noFixtureReason = entry.captured ? null : entry.captureComplete ? 'EMPTY_COMPLETE_CAPTURE' : 'CAPTURE_INCOMPLETE_OR_PRIMARY_UNPROVEN';
  }
  if (plan.dataset === 'A' && stage !== 'preflight') {
    const preflight = history.rows.filter(r => r.action === 'collector-preflight');
    assert.equal(preflight.length, 2, 'BOX collector preflight missing'); assert(preflight.every(r => r.status === 'COLLECTOR_MATCH'), 'BOX collector preflight failed');
  }
  const { tasks, decisions } = makeFollowupTasks(plan, stage, selection, history.rows);
  fs.mkdirSync(outputDir, { recursive: false });
  const chunks = packFollowup(tasks);
  const metadataPerChunk = Buffer.byteLength(JSON.stringify(plan, null, 2)) + 256 * 1024;
  const metadataBytes = chunks.length * metadataPerChunk;
  let remainingMetadataBytes = metadataBytes;
  const storage = { kind: 'CHECKED_DISK_AND_HARDLINK_PAYLOADS', reserveBytes: DISK_RESERVE_BYTES,
    admission: requireDisk(outputDir, metadataBytes), fixturesLinked: 0, fixturesCopied: 0, copiedBytes: 0 };
  writeJson(path.join(outputDir, 'STORAGE_ADMISSION.json'), storage);
  for (const [i, chunk] of chunks.entries()) {
    const dir = path.join(outputDir, 'chunks', String(i)); fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
    const descriptors = chunk.tasks.map(t => {
      if (!t.fixture) return t;
      const f = t.fixture, filename = `fixtures/${f.sha256}.json`;
      if (!fs.existsSync(path.join(dir, filename))) {
        const size = f.byteLength ?? f.bytes.length;
        const placed = materializeFixture(f.storagePath, path.join(dir, filename), { bytes: () => f.bytes, size,
          storage: (directory, bytes) => requireDisk(directory, bytes + remainingMetadataBytes) });
        if (placed.kind === 'HARDLINK') storage.fixturesLinked++; else storage.fixturesCopied++;
        storage.copiedBytes += placed.allocatedBytes;
      }
      const { fixture, ...descriptor } = f;
      delete descriptor.bytes;
      return { ...t, fixture: { ...descriptor, path: filename, metadata: f.metadata ?? fixtureMeta(fixture) } };
    });
    writeJson(path.join(dir, 'campaign.json'), plan);
    writeJson(path.join(dir, 'chunk.json'), { id: i, stage, sourceLock: identity(plan.sourceFiles), tasks: descriptors, worstMs: chunk.worstMs });
    remainingMetadataBytes -= metadataPerChunk;
  }
  writeJson(path.join(outputDir, 'STORAGE_COMPLETE.json'), storage);
  const summary = { campaignId: plan.campaignId, dataset: plan.dataset, stage, plannedUtc: new Date().toISOString(),
    sourceLock: identity(plan.sourceFiles), chunks: chunks.length, tasks: tasks.length, calls: tasks.reduce((s, t) => s + (t.calls?.length ?? 1), 0),
    maxParallel: plan.policy.maxParallel, selection: selection.ledger, decisions,
    selectedFixtures: selection.selected.map(f => ({ id: f.id, sha256: f.sha256 })),
    expectedCalls: tasks.flatMap(t => t.calls ?? [{ callId: hash(plan.campaignId + stage + t.command.id).slice(0, 24), inputId: t.command.id, action: t.action }]),
    historyWarnings: history.warnings, originUtc: plan.originUtc, endUtc: new Date(Date.parse(plan.originUtc) + plan.policy.overallMs).toISOString() };
  writeJson(path.join(outputDir, 'WAVE_PLAN.json'), summary); return summary;
}
export function fixtureMeta(fixture) {
  const c = fixture.origin.command;
  return { fumen: c.sourceFumen, pattern: c.pattern, family: c.family, mirrorGroup: c.mirrorGroup, commandId: c.id,
    commandKind: c.kind, wantedSave: c.wantedSave ?? null, save: fixture.origin.filter,
    filterSemantics: c.kind === 'per-save' ? 'QUEUE_REMAINDER_ONE_PIECE' : 'LAST_BAG_EXACT_MULTIPLICITY_EXPRESSION',
    primaryHard: fixture.primaryHard, primaryBackend: fixture.cardinalityProof.backend, primaryKernelStats: fixture.cardinalityProof.kernelStats,
    primaryThreads: fixture.cardinalityProof.backend === 'ortools' ? 2 : fixture.cardinalityProof.backend === 'kernel' ? 0 : 1,
    tinyEligible: fixture.keys.length <= 48,
    ...originalStructure(fixture) };
}
export async function runFollowupPart(bundleDir, outputDir, part, jobStartedMs, { scope = isolatedScope, now = Date.now } = {}) {
  const plan = validateFollowup(readJson(path.join(bundleDir, 'campaign.json')), true); verifyFollowupFiles(plan.sourceFiles);
  const chunk = readJson(path.join(bundleDir, 'chunk.json')); assert.equal(chunk.sourceLock, identity(plan.sourceFiles));
  assert(Number.isInteger(part) && part >= 0 && part < SHAPE.parts); assert(Number.isFinite(jobStartedMs));
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  fs.mkdirSync(outputDir, { recursive: false }); fs.mkdirSync(path.join(outputDir, 'fixtures'));
  writeJson(path.join(outputDir, 'RUN_LOCK.json'), { sourceLock: chunk.sourceLock, campaignId: plan.campaignId,
    originUtc: plan.originUtc, startedUtc: new Date(now()).toISOString(), jobStartedMs, chunkId: chunk.id, part,
    github: { run: plan.runId, job: process.env.GITHUB_JOB ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null },
    environment: { node: process.version, cpuModels: [...new Set(os.cpus().map(c => c.model))], kernel: os.release() },
    threads: plan.solverThreads, memoryScope: 'ONE_INDEPENDENT_3G_PROCESS_TREE_PER_CALL' });
  const raw = fs.openSync(path.join(outputDir, 'raw.jsonl'), 'wx');
  const stateFile = path.join(path.dirname(outputDir), 'CALL_QUARANTINE.json');
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { oom: [], fatal: null };
  const persistState = () => fs.writeFileSync(stateFile, JSON.stringify(state) + '\n');
  const append = row => { fs.writeSync(raw, JSON.stringify(row) + '\n'); fs.fsyncSync(raw); };
  const end = Math.min(Date.parse(plan.originUtc) + plan.policy.overallMs, jobStartedMs + SHAPE.jobMs) - SHAPE.reserveMs;
  let attempts = 0;
  try {
    const task = chunk.tasks[part]; if (!task) return;
    const admission = now() + task.worstMs > end ? 'BUDGET' : null;
    const calls = task.calls ?? [{ callId: hash(plan.campaignId + chunk.stage + task.command.id).slice(0, 24), inputId: task.command.id,
      phase: task.action === 'collector-preflight' ? 'DIAGNOSTIC' : 'CAPTURE' }];
    for (const call of calls) {
      const key = call.inputId + '/' + call.engine;
      const base = { campaignId: plan.campaignId, dataset: plan.dataset, sourceLock: chunk.sourceLock, stage: chunk.stage,
        chunkId: chunk.id, part, runnerId: `${plan.runId}/${chunk.stage}/${chunk.id}`, action: task.action, ...call,
        fixtureSha256: task.fixture?.sha256 ?? null, metadata: task.fixture?.metadata ?? null };
      const reason = state.fatal ?? admission ?? (state.oom.includes(key) ? 'AFTER_OOM' : null);
      if (reason) { append({ ...base, status: 'NOT_RUN_' + reason, ms: null }); continue; }
      const limits = task.action === 'capture' ? plan.captureLimits : task.action === 'collector-preflight' ? limitsFor(120000) : call.limits;
      const job = task.action === 'secondary' ? { action: 'secondary', engine: call.engine,
        fixturePath: path.resolve(bundleDir, task.fixture.path), fixtureSha256: task.fixture.sha256, cpLimitMs: limits.callMs, exactHumanQuality: 'true' }
        : { action: task.action, command: task.command, outputDir: path.resolve(outputDir, 'fixtures'), fixturePrefix: call.callId + '-', exactHumanQuality: 'true' };
      if (task.fixture) assert.equal(hash(fs.readFileSync(job.fixturePath)), task.fixture.sha256);
      let execution;
      try { execution = await scope({ callId: call.callId, job, limits,
        phaseLimits: task.action === 'capture' ? plan.capturePhaseLimits : task.action === 'collector-preflight' ? { enumeration: 110000 } : {} }, path.join(outputDir, call.callId)); }
      catch (error) { execution = { status: 'ERROR_SCOPE', reaped: false, error: error.message, result: null }; }
      attempts++;
      append({ ...base, status: execution.status, ms: execution.status === 'EXACT' ? execution.result.responseMs : null,
        condition: { lifecycle: plan.lifecycle, limits, cpLimitMs: call.engine === 'cpsat' ? limits.callMs : null,
          primaryCpsatWorkers: 2, secondaryCpsatWorkers: 1, stateBudget: null, exactHumanQuality: 'true' }, execution });
      if (execution.status === 'CANCELLED') { state.fatal = 'CANCELLED'; persistState(); }
      else if (execution.status === 'OOM' && execution.reaped) { state.oom.push(key); persistState(); }
      else if (!execution.reaped || !['EXACT', 'INCOMPLETE', 'CAPTURED', 'COLLECTOR_MATCH'].includes(execution.status) && !execution.status.startsWith('TIMEOUT_')) {
        state.fatal = 'UNSAFE_OR_INVALID_RESULT'; persistState();
      }
    }
    verifyFollowupFiles(plan.sourceFiles);
  } finally { writeJson(path.join(outputDir, 'COMPLETE.json'), { attempts, finishedUtc: new Date(now()).toISOString(),
    quarantine: state, actionsSuccessIsNotMeasurementPass: true }); fs.closeSync(raw); }
}

export function reportFollowup(planFile, historyDir, plansDir, outputDir) {
  const plan = validateFollowup(readJson(planFile), true), history = followupHistory(historyDir, plan);
  const fixtures = new Map([...acquiredFixtures(plan, historyDir), ...importedFixtures(plan)].map(f => [f.id, f]));
  const waves = filesUnder(plansDir).filter(f => path.basename(f) === 'WAVE_PLAN.json').map(readJson);
  assert(waves.every(w => w.campaignId === plan.campaignId && w.sourceLock === identity(plan.sourceFiles)));
  const expected = waves.flatMap(w => w.expectedCalls), actual = new Map(history.rows.map(r => [r.callId, r]));
  assert.equal(new Set(expected.map(c => c.callId)).size, expected.length);
  const schedule = new Map(expected.map(c => [c.callId, c]));
  const errors = [], consensus = new Map();
  for (const row of history.rows) {
    try {
      const call = schedule.get(row.callId); assert(call, 'raw call absent from frozen stage plan');
      assert.equal(row.action, call.action ?? 'secondary');
      for (const key of ['inputId', 'engine', 'repeat', 'phase']) if (call[key] !== undefined) assert.equal(row[key], call[key], 'schedule.' + key);
      if (row.status === 'EXACT') { assert(Number.isFinite(row.ms) && row.ms > 0); assert.equal(row.ms, row.execution.result.responseMs); }
      else assert(row.ms == null, 'censored call was imputed as exact time');
      if (row.action === 'secondary') {
        const f = fixtures.get(row.inputId); assert(f); assert.equal(row.fixtureSha256, f.sha256);
        assert.deepEqual(row.metadata, JSON.parse(JSON.stringify(f.metadata ?? fixtureMeta(f.fixture))));
        if (row.execution) { assert.deepEqual(row.condition.limits, call.limits); assert.equal(row.condition.primaryCpsatWorkers, 2); assert.equal(row.condition.secondaryCpsatWorkers, 1); }
      }
    } catch (error) { errors.push({ callId: row.callId, error: error.message }); }
  }
  for (const row of history.rows.filter(r => r.status === 'EXACT')) {
    try {
      const f = fixtures.get(row.inputId); assert(f); assert.equal(f.sha256, row.fixtureSha256);
      const fixture = validateFixture(JSON.parse(f.bytes));
      const verified = verifyResult(fixture, row.execution.result.result, { engine: row.engine }); assert(verified.completed);
      assert.deepEqual(row.execution.result.verified.selected, verified.selected);
      const value = identity({ selected: verified.selected, quality: verified.qualityVector });
      if (consensus.has(row.inputId)) assert.equal(value, consensus.get(row.inputId), 'engine/repeat witness mismatch'); consensus.set(row.inputId, value);
    } catch (error) { errors.push({ callId: row.callId, error: error.message }); }
  }
  const statuses = {}; for (const row of history.rows) statuses[row.status] = (statuses[row.status] ?? 0) + 1;
  const harnessErrors = filesUnder(historyDir).filter(f => path.basename(f) === 'HARNESS_ERROR.json').map(file => ({ file: relative(file), ...readJson(file) }));
  const captureRows = history.rows.filter(r => r.action === 'capture');
  const missingStagePlans = (plan.dataset === 'A' ? ['preflight', 'capture', 'basic', 'retest'] : ['capture', 'basic', 'retest']).filter(s => !waves.some(w => w.stage === s));
  const transport = filesUnder(historyDir).filter(f => path.basename(f) === 'TRANSPORT_COMPLETE.json').map(readJson);
  const transportErrors = transport.filter(r => r.status !== 'ALL_DURABLE');
  const transportReceiptsMissing = waves.flatMap(w => Array.from({ length: w.chunks ?? 0 }, (_, chunk) => ({ stage: w.stage, chunk })))
    .filter(c => !transport.some(r => r.stage === c.stage && r.chunk === c.chunk));
  const report = { schema: 1, dataset: plan.dataset, campaignId: plan.campaignId, sourceCommit: plan.sourceCommit,
    originUtc: plan.originUtc, expectedCalls: expected.length, recordedCalls: history.rows.length, statuses,
    plannedMissing: expected.filter(c => !actual.has(c.callId)), foreignCalls: history.rows.filter(c => !expected.some(e => e.callId === c.callId)).map(c => c.callId),
    captureCommands: plan.commands.length, captureRecorded: captureRows.length,
    captureMissing: plan.commands.filter(c => !captureRows.some(r => r.inputId === c.id)).map(c => c.id),
    provenFixtures: [...fixtures.values()].filter(f => f.acquisition === 'NEW_CAPTURE').length,
    primaryUnprovenCommands: captureRows.filter(r => r.status.startsWith('TIMEOUT_PHASE_PRIMARY')).map(r => r.inputId),
    witnessErrors: errors, harnessErrors, ledgerWarnings: history.warnings, missingStagePlans,
    transport, transportErrors, transportReceiptsMissing,
    rawDurabilityVerified: transportErrors.length === 0 && transportReceiptsMissing.length === 0 && missingStagePlans.length === 0,
    allScheduledCallsExecuted: missingStagePlans.length === 0 && expected.every(c => actual.get(c.callId)?.execution !== undefined),
    auditStatus: errors.length || harnessErrors.length || statuses.MISMATCH || transportErrors.length ? 'FAIL' : 'WITNESS_CHECKED_NOT_PERFORMANCE_PASS',
    originalRawModified: false, freshValidation: false, performancePass: 'NOT_APPLICABLE_INFORMATION_COLLECTION',
    actionsSuccessIsNotMeasurementPass: true };
  fs.mkdirSync(outputDir, { recursive: false }); writeJson(path.join(outputDir, 'REPORT.json'), report);
  fs.writeFileSync(path.join(outputDir, 'calls.jsonl'), history.rows.filter(r => r.action === 'secondary').map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(outputDir, 'fixtures.jsonl'), [...fixtures.values()].map(f => JSON.stringify({ id: f.id, sha256: f.sha256,
    originalFile: f.originalFile, acquisition: f.acquisition, ...(f.metadata ?? fixtureMeta(f.fixture)) })).join('\n') + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  try {
  if (mode === 'prepare') console.log(JSON.stringify(prepareFollowup(args[0])));
  else if (mode === 'activate') activateFollowup(...args);
  else if (mode === 'plan') console.log(JSON.stringify(planFollowup(...args)));
  else if (mode === 'run-part') {
    try { await runFollowupPart(args[0], args[1], Number(args[2]), Number(args[3])); }
    catch (error) { fs.mkdirSync(args[1], { recursive: true }); writeJson(path.join(args[1], 'HARNESS_ERROR.json'), { error: error.message, stack: error.stack }); console.error(error); }
  } else if (mode === 'report') console.log(JSON.stringify(reportFollowup(...args)));
  else throw new Error('unknown followup operation');
  } catch (error) {
    if (['plan', 'report'].includes(mode)) {
      const directory = mode === 'plan' ? args[2] : args[3];
      fs.mkdirSync(directory, { recursive: true });
      writeJson(path.join(directory, 'FOLLOWUP_FAILURE.json'), { mode, error: error.message, stack: error.stack,
        finishedUtc: new Date().toISOString(), actionsSuccessIsNotMeasurementPass: true });
    }
    throw error;
  }
}
