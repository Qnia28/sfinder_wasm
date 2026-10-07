import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canonical, digest, sha256, readJson, writeJson, strict, integer, ENGINES, verifySources } from './contracts.mjs';
import { FOLLOWUP_JOB, validateLimits, validateBudget } from './budget.mjs';
import { verifyHistoryIndex } from './evidence.mjs';
import { PROFILE as TRIAGE_PROFILE, profileForTriage, validateManifest as validateTriageManifest, validateLock as validateTriageLock } from './triage/protocol.mjs';
import { fastParent } from './triage/fast-followup.mjs';
import { largeParent } from './triage/large-run.mjs';

export const PROFILE = Object.freeze({ id: 'exact-cold-v1', lifecycle: 'fresh-process-cold', exactHumanQuality: 'true',
  timingContract: 'secondary-response-v1', memoryMaxBytes: 3 * 1024 ** 3, swapMaxBytes: 0,
  threads: { rustPrimary: 1, highsPrimary: 1, cpsatPrimary: 2, rustSecondary: 1, cpsatSecondary: 1 },
  parameters: { stateBudget: null, cpsat: { numWorkers: 1, subsolvers: ['max_lp'], randomSeed: 1 } } });
const top = ['schemaVersion', 'campaignId', 'revision', 'purpose', 'approval', 'profile', 'measurement', 'inputs', 'selection',
  'repeats', 'limits', 'budget', 'sourceFiles', 'provenance', 'evidence', 'continuation', 'analysis'];
export const isTriage = m => m.profile === TRIAGE_PROFILE.id;
export const profileFor = m => isTriage(m) ? profileForTriage(m) : PROFILE;
function validateContinuation(m) {
  if (!m.continuation) return;
  strict(m.continuation, ['parentLock', 'parentLockSha256', 'history', 'historyIndexSha256'], 'continuation');
  for (const k of ['parentLockSha256', 'historyIndexSha256']) assert(/^[a-f0-9]{64}$/.test(m.continuation[k]));
}
export function resolveManifest(authored) {
  if (isTriage(authored)) { const m = JSON.parse(canonical(authored)); validateManifest(m); return m; }
  strict(authored, top, 'manifest'); assert.equal(authored.schemaVersion, 1);
  assert.equal(authored.profile, PROFILE.id, 'unsupported profile/lifecycle');
  const manifest = JSON.parse(canonical(authored));
  manifest.measurement ??= { adapter: 'secondary-fixture', variants: [...ENGINES] };
  manifest.budget.job ??= { ...FOLLOWUP_JOB };
  manifest.evidence ??= { schemaVersion: 1, retentionDays: 30, retries: 2, diskReserveBytes: 4 * 1024 ** 3 };
  manifest.continuation ??= null;
  validateManifest(manifest); return manifest;
}
export function validateManifest(m) {
  if (isTriage(m)) { validateTriageManifest(m); validateContinuation(m); return m; }
  strict(m, top, 'manifest'); assert.equal(m.schemaVersion, 1); assert.equal(m.profile, PROFILE.id);
  assert(/^[a-zA-Z0-9_-]{1,80}$/.test(m.campaignId), 'safe stable campaign ID required'); integer(m.revision);
  assert.equal(m.purpose, 'information', 'performance protocols not implemented in v1');
  assert.equal(m.analysis, 'INFORMATION_ONLY', 'no implicit performance PASS');
  strict(m.measurement, ['adapter', 'variants'], 'measurement');
  assert.equal(m.measurement.adapter, 'secondary-fixture', 'triage/e2e adapter is not yet supported');
  assert(Array.isArray(m.measurement.variants) && m.measurement.variants.length);
  assert(new Set(m.measurement.variants).size === m.measurement.variants.length && m.measurement.variants.every(v => ENGINES.includes(v)), 'unregistered variant');
  assert(m.approval === null || typeof m.approval === 'string' && m.approval.length > 0);
  strict(m.sourceFiles, ['product', 'harness'], 'sourceFiles');
  for (const g of ['product', 'harness']) {
    assert(Object.keys(m.sourceFiles[g]).length);
    for (const sha of Object.values(m.sourceFiles[g])) assert(/^[a-f0-9]{64}$/.test(sha));
  }
  strict(m.inputs, ['commands', 'fixtures', 'diagnostics', 'recovery'], 'inputs');
  for (const k of ['commands', 'fixtures', 'diagnostics', 'recovery']) assert(Array.isArray(m.inputs[k]));
  const ids = new Set();
  for (const c of m.inputs.commands) {
    assert(!ids.has(c.id)); ids.add(c.id);
    assert(['per-save', 'minimals'].includes(c.kind));
    assert.equal(c.clear, 4); assert.equal(c.useHold, true); assert.equal(c.exactHumanQuality, 'true');
    assert.equal(c.queueLength, c.piecesNeeded + 1); assert.equal(c.savedPieceCount, 1);
    assert(['bag', 'bag-plus-next-draw', 'restricted-split'].includes(c.family));
    if (c.kind === 'minimals') assert.equal(c.wantedSave, 'ALL', 'capture-minimals v1 supports ALL');
  }
  for (const f of m.inputs.fixtures) {
    strict(f, ['id', 'file', 'sha256', 'acquisition', 'provenance'], 'fixture reference');
    assert(typeof f.file === 'string' && f.file.length); assert(/^[a-f0-9]{64}$/.test(f.sha256));
    assert(!ids.has('fixture/' + f.id)); ids.add('fixture/' + f.id);
    assert(typeof f.acquisition === 'string'); assert(f.provenance);
  }
  assert(m.inputs.commands.length || m.inputs.fixtures.length, 'empty population is not an experiment');
  for (const c of m.inputs.diagnostics) assert(m.inputs.commands.some(x => digest(x) === digest(c)), 'foreign diagnostic command');
  strict(m.selection, ['id', 'supplementIds'], 'selection');
  assert(['all-nontrivial-v1', 'hash-one-per-command-v1'].includes(m.selection.id));
  assert(Array.isArray(m.selection.supplementIds));
  assert(new Set(m.selection.supplementIds).size === m.selection.supplementIds.length);
  strict(m.repeats, ['initial', 'additional', 'threshold', 'seed', 'order'], 'repeats');
  integer(m.repeats.initial, 2, 20); integer(m.repeats.additional, 0, 20);
  assert(Number.isFinite(m.repeats.threshold) && m.repeats.threshold >= 1);
  assert(typeof m.repeats.seed === 'string' && m.repeats.seed.length);
  assert.equal(m.repeats.order, 'six-engine-orders-v1');
  strict(m.limits, ['secondary', 'capture', 'phases', 'diagnostic'], 'limits');
  for (const k of ['secondary', 'capture', 'diagnostic']) validateLimits(m.limits[k]);
  strict(m.limits.phases, ['enumeration', 'primary'], 'phase limits');
  for (const v of Object.values(m.limits.phases)) integer(v, 1, 2147483647);
  assert(m.limits.diagnostic.callMs > 10000, 'diagnostic phase needs startup headroom');
  assert(Object.values(m.limits.phases).every(v => v <= m.limits.capture.callMs), 'phase exceeds whole capture deadline');
  const recoveryIds = new Set();
  for (const r of m.inputs.recovery) {
    strict(r, ['inputId', 'engine', 'repeat', 'limits', 'proof'], 'recovery');
    assert(ENGINES.includes(r.engine)); integer(r.repeat); validateLimits(r.limits);
    assert(m.inputs.fixtures.some(f => f.id === r.inputId));
    assert(r.proof && /^NOT_RUN/.test(r.proof.originalStatus) && /^[a-f0-9]{64}$/.test(r.proof.rawLineSha256), 'proven NOT_RUN reference required');
    const id = `${r.inputId}/${r.engine}/${r.repeat}`; assert(!recoveryIds.has(id), 'duplicate recovery call'); recoveryIds.add(id);
  }
  validateBudget(m.budget);
  strict(m.evidence, ['schemaVersion', 'retentionDays', 'retries', 'diskReserveBytes'], 'evidence');
  assert.equal(m.evidence.schemaVersion, 1); integer(m.evidence.retentionDays, 1, 90);
  integer(m.evidence.retries, 0, 2); integer(m.evidence.diskReserveBytes, 4 * 1024 ** 3);
  assert(m.provenance && m.provenance.role === 'development' && Array.isArray(m.provenance.exposures), 'v1 does not certify fresh validation');
  if (m.continuation) {
    strict(m.continuation, ['parentLock', 'parentLockSha256', 'history', 'historyIndexSha256'], 'continuation');
    for (const k of ['parentLockSha256', 'historyIndexSha256']) assert(/^[a-f0-9]{64}$/.test(m.continuation[k]));
  }
  return m;
}
export const conditionHash = m => isTriage(m)
  ? digest({ profile: profileForTriage(m), tasksHash: m.tasksHash, job: m.job, baselineFiles: m.baselineFiles })
  : digest({ profile: PROFILE, measurement: m.measurement, limits: m.limits, repeats: m.repeats, selection: m.selection });
export const inputHash = m => isTriage(m)
  ? digest(m.inputs.map(({ expectedWitness, ...f }) => ({ ...f, witnessSha256: expectedWitness?.sha256 ?? null })))
  : digest(m.inputs);
export function verifyRecoveryProof(recovery) {
  const p = recovery.proof;
  assert(typeof p.rawLineBase64 === 'string' && p.rawLineBase64.length, 'recovery requires portable original raw line bytes');
  const bytes = Buffer.from(p.rawLineBase64, 'base64'); assert.equal(sha256(bytes), p.rawLineSha256, 'recovery raw line hash mismatch');
  const row = JSON.parse(bytes);
  assert.equal(row.status, p.originalStatus); assert.equal(row.execution, undefined, 'already executed call cannot be recovered');
  assert.equal(row.inputId, recovery.inputId); assert.equal(row.engine, recovery.engine); assert.equal(row.repeat, recovery.repeat);
  assert.equal(row.sourceLock, p.originalSourceLock); return row;
}
export function validateLock(lock) {
  if (isTriage(lock.manifest)) {
    validateTriageLock(lock); validateManifest(lock.manifest);
    // Read old immutable locks without rewriting their hashes or timestamps.
    if (lock.schemaVersion === undefined) return lock;
    assert.equal(lock.schemaVersion, 1);
    assert.equal(lock.conditionHash, conditionHash(lock.manifest)); assert.equal(lock.inputHash, inputHash(lock.manifest));
    assert.equal(lock.productHash, digest(lock.manifest.sourceFiles.product));
    assert.equal(lock.harnessHash, digest(lock.manifest.sourceFiles.harness));
    assert.equal(Date.parse(lock.originUtc), lock.originMs); assert.equal(Date.parse(lock.endUtc), lock.endMs);
    assert(Date.parse(lock.createdUtc) >= lock.originMs); return lock;
  }
  assert.equal(lock.schemaVersion, 1); validateManifest(lock.manifest);
  assert.equal(lock.manifestHash, digest(lock.manifest)); assert.equal(lock.conditionHash, conditionHash(lock.manifest));
  assert.equal(lock.inputHash, inputHash(lock.manifest));
  assert.equal(lock.productHash, digest(lock.manifest.sourceFiles.product));
  assert.equal(lock.harnessHash, digest(lock.manifest.sourceFiles.harness));
  assert.equal(Date.parse(lock.endUtc), Date.parse(lock.originUtc) + lock.manifest.budget.overallMs);
  assert(Number.isFinite(Date.parse(lock.originUtc)) && Date.parse(lock.createdUtc) >= Date.parse(lock.originUtc));
  assert(/^[a-zA-Z0-9_-]+$/.test(lock.invocationId));
  return lock;
}
export function activate(authored, directory, { createdUtc, invocationId, commit = null, confirm = false } = {}) {
  const m = resolveManifest(authored); assert(confirm && m.approval, 'explicit approval and confirmation required');
  if (!isTriage(m)) for (const recovery of m.inputs.recovery) verifyRecoveryProof(recovery);
  verifySources(m.sourceFiles);
  assert(Number.isFinite(Date.parse(createdUtc)) && /^[a-zA-Z0-9_-]+$/.test(invocationId));
  let originUtc = createdUtc, parentHash = null, ancestorLocks = [];
  if (m.followup || m.largeRun) {
    const parent = validateLock(m.largeRun ? largeParent(m) : fastParent(m));
    originUtc = parent.originUtc; parentHash = (m.largeRun??m.followup).parentLockSha256;
    ancestorLocks = [...parent.ancestorLocks, { manifestHash:parent.manifestHash,
      harnessHash:parent.harnessHash, invocationId:parent.invocationId }];
  }
  if (m.continuation) {
    const c = m.continuation, bytes = fs.readFileSync(c.parentLock); assert.equal(sha256(bytes), c.parentLockSha256);
    const parent = validateLock(JSON.parse(bytes));
    assert.equal(parent.manifest.campaignId, m.campaignId); assert.equal(parent.conditionHash ?? conditionHash(parent.manifest), conditionHash(m));
    assert.equal(parent.inputHash ?? inputHash(parent.manifest), inputHash(m));
    assert.equal(parent.productHash ?? digest(parent.manifest.sourceFiles.product), digest(m.sourceFiles.product));
    assert.equal(parent.manifest.budget?.overallMs ?? parent.manifest.overallMs, m.budget.overallMs);
    assert.equal(parent.manifest.budget?.maxCalls ?? parent.manifest.maxCalls, m.budget.maxCalls);
    verifyHistoryIndex(c.history, c.historyIndexSha256, m.campaignId);
    originUtc = parent.originUtc ?? new Date(parent.originMs).toISOString(); parentHash = sha256(bytes);
    ancestorLocks = [...(parent.ancestorLocks ?? []), { manifestHash: parent.manifestHash,
      harnessHash: parent.harnessHash ?? digest(parent.manifest.sourceFiles.harness), invocationId: parent.invocationId }];
  }
  const lock = validateLock({ schemaVersion: 1, manifest: m, manifestHash: digest(m), conditionHash: conditionHash(m),
    inputHash: inputHash(m), productHash: digest(m.sourceFiles.product), harnessHash: digest(m.sourceFiles.harness),
    invocationId, commit, createdUtc, originUtc, endUtc: new Date(Date.parse(originUtc) + m.budget.overallMs).toISOString(), parentHash, ancestorLocks,
    ...(isTriage(m) ? { originMs: Date.parse(originUtc), endMs: Date.parse(originUtc) + m.budget.overallMs,
      profileHash: digest(profileForTriage(m)), repository: process.env.GITHUB_REPOSITORY ?? null } : {}) });
  assert(!fs.existsSync(directory), 'activation requires new directory'); writeJson(path.join(directory, 'LOCK.json'), lock); return lock;
}
