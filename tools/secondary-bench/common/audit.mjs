import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { digest, readJson, writeJson, filesUnder, STAGES } from './contracts.mjs';
import { validateLock } from './manifest.mjs';
import { loadHistory, verifyHistoryIndex, mergeContinuationHistory } from './evidence.mjs';
import { fixtureIndex } from './planner.mjs';
import { verifyExecution } from './adapters.mjs';

export function audit(lock, historyDir, outputDir) {
  validateLock(lock); mergeContinuationHistory(lock, historyDir);
  const history = loadHistory(historyDir, lock.manifest.campaignId), errors = [];
  const plans = filesUnder(historyDir).filter(f => path.basename(f) === 'STAGE_PLAN.json').map(readJson);
  const expected = new Map();
  const allowedLocks = [{ manifestHash: lock.manifestHash, harnessHash: lock.harnessHash, invocationId: lock.invocationId }, ...(lock.ancestorLocks ?? [])];
  for (const plan of plans) {
    const { stagePlanId, ...content } = plan;
    assert.equal(stagePlanId, digest(content), 'stage plan hash mismatch');
    assert.equal(plan.campaignId, lock.manifest.campaignId); assert(STAGES.includes(plan.stage));
    assert(allowedLocks.some(l => l.manifestHash === plan.manifestHash && l.invocationId === plan.invocationId), 'foreign stage lock');
    assert.equal(plan.originUtc, lock.originUtc); assert.equal(plan.endUtc, lock.endUtc);
    for (const c of plan.expectedCalls) {
      if (expected.has(c.logicalCallId)) {
        const previous = expected.get(c.logicalCallId); assert.equal(digest(previous.call), digest(c), 'conflicting plans'); previous.stagePlanIds.push(stagePlanId);
      } else expected.set(c.logicalCallId, { call: c, stagePlanIds: [stagePlanId] });
    }
  }
  const missingStages = STAGES.filter(s => !plans.some(p => p.stage === s));
  const index = fixtureIndex(lock, historyDir), fixtures = new Map([...index.imported, ...index.captured].map(f => [f.id, f]));
  const consensus = new Map(), groups = new Map(), statuses = {};
  for (const row of history.rows) {
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    const old = groups.get(row.logicalCallId) ?? []; old.push(row); groups.set(row.logicalCallId, old);
    try {
      const planned = expected.get(row.logicalCallId); assert(planned, 'unplanned call');
      assert(planned.stagePlanIds.includes(row.stagePlanId)); assert.equal(row.conditionHash, lock.conditionHash);
      assert.equal(row.productHash, lock.productHash);
      assert(allowedLocks.some(l => l.manifestHash === row.manifestHash && l.harnessHash === row.harnessHash && l.invocationId === row.invocationId), 'foreign execution lock');
      for (const k of ['inputId', 'inputHash', 'variant', 'repeat', 'phase', 'adapter']) assert.equal(row[k], planned.call[k], 'call.' + k);
      assert.deepEqual(row.limits, planned.call.limits);
      assert(row.executionAttemptId === null ? row.status.startsWith('NOT_RUN_') : history.starts.some(s => s.executionAttemptId === row.executionAttemptId), 'execution start missing');
      const witness = verifyExecution(row, fixtures.get(row.inputId)?.file);
      if (witness) {
        assert.equal(digest(row.metadata), digest(fixtures.get(row.inputId).metadata));
        if (consensus.has(row.inputId)) assert.equal(witness, consensus.get(row.inputId), 'engine/repeat witness mismatch');
        consensus.set(row.inputId, witness);
      }
    } catch (error) { errors.push({ logicalCallId: row.logicalCallId, executionAttemptId: row.executionAttemptId, error: error.message }); }
  }
  const multipleExecutions = [...groups].filter(([, rs]) => rs.filter(r => r.executionAttemptId !== null).length > 1).map(([id]) => id);
  const missingCalls = [...expected.keys()].filter(id => !groups.has(id));
  const receipts = filesUnder(historyDir).filter(f => path.basename(f) === 'TRANSPORT_COMPLETE.json').map(readJson);
  const missingReceipts = plans.flatMap(p => Array.from({ length: p.chunks }, (_, chunk) => ({ stagePlanId: p.stagePlanId, chunk })))
    .filter(c => !receipts.some(r => r.stagePlanId === c.stagePlanId && r.chunk === c.chunk));
  const inventories = filesUnder(historyDir).filter(f => path.basename(f) === 'DOWNLOAD_INDEX.json').flatMap(f => readJson(f).artifacts);
  const transportErrors = [];
  for (const report of receipts) {
    try {
      assert.equal(report.campaignId, lock.manifest.campaignId);
      assert.equal(report.status, 'ALL_DURABLE'); assert.equal(report.solverCallsInTransport, 0);
      assert(Array.isArray(report.receipts) && report.receipts.length, 'empty transport report');
      for (const receipt of report.receipts) {
        assert.equal(receipt.status, 'UPLOADED');
        const checkpoint = history.checkpoints.find(c => c.checkpointId === receipt.checkpointId); assert(checkpoint, 'receipt checkpoint not downloaded');
        assert.deepEqual(checkpoint.identity, receipt.identity);
        assert.equal(checkpoint.identity.stagePlanId, report.stagePlanId); assert.equal(checkpoint.identity.chunk, report.chunk);
        const uploaded = receipt.attempts.filter(a => a.status === 'UPLOADED'); assert(uploaded.length);
        for (const a of uploaded) {
          assert(Number.isSafeInteger(a.artifactId) && /^sha256:[a-f0-9]{64}$/.test(a.digest));
          if (inventories.length) assert(inventories.some(i => i.id === a.artifactId && i.digest === a.digest), 'receipt/inventory mismatch');
        }
      }
    } catch (error) { transportErrors.push({ stagePlanId: report.stagePlanId, chunk: report.chunk, error: error.message }); }
  }
  const notRun = history.rows.filter(r => r.executionAttemptId === null).map(r => r.logicalCallId);
  const missingCapture = lock.manifest.inputs.commands.filter(c => !history.rows.some(r => r.stage === 'acquire' && r.inputId === c.id)).map(c => c.id);
  const harnessErrors = filesUnder(historyDir).filter(f => path.basename(f) === 'FAILURE.json').map(readJson);
  const incomplete = missingStages.length || missingCalls.length || missingReceipts.length || history.unknown.length || history.warnings.length || missingCapture.length;
  const failed = errors.length || multipleExecutions.length || transportErrors.length || harnessErrors.length
    || history.rows.some(r => ['MISMATCH', 'ERROR_SCOPE', 'ERROR_SCOPE_EXIT', 'ERROR', 'CANCELLED'].includes(r.status));
  const result = { schemaVersion: 1, campaignId: lock.manifest.campaignId, manifestHash: lock.manifestHash,
    originUtc: lock.originUtc, endUtc: lock.endUtc, expectedCalls: expected.size, recordedCalls: history.rows.length, statuses,
    orchestration: failed ? 'FAIL' : incomplete ? 'INCOMPLETE' : 'PASS',
    executionCompleteness: incomplete || notRun.length ? 'INCOMPLETE' : 'COMPLETE',
    evidenceCompleteness: incomplete || transportErrors.length ? 'INCOMPLETE' : 'REMOTE_RECEIPT_VERIFIED',
    correctness: errors.length ? 'FAIL' : 'WITNESS_CHECKED_NOT_INDEPENDENT_OPTIMALITY',
    performance: 'NOT_APPLICABLE', validity: failed || incomplete ? 'FAIL' : 'PASS',
    missingStages, missingCalls, missingCapture, missingReceipts, notRun, multipleExecutions,
    unknownExecutions: history.unknown, errors, transportErrors, harnessErrors, warnings: history.warnings, aliases: history.aliases,
    freshValidation: false, originalRawModified: false, actionsSuccessIsNotPerformancePass: true };
  writeJson(path.join(outputDir, 'AUDIT.json'), result); return result;
}
export function verifyArchive(directory, expectedHash, campaignId, outputDir) {
  const index = verifyHistoryIndex(directory, expectedHash, campaignId);
  const history = loadHistory(directory, campaignId);
  const r = { schemaVersion: 1, state: 'ARCHIVE_VERIFIED', archive: path.resolve(directory), historyIndexSha256: expectedHash,
    campaignId, objects: index.members.length, rows: history.rows.length, unknownExecutions: history.unknown.length,
    verifiedUtc: new Date().toISOString(), completenessClaim: 'INDEXED_OBJECTS_ONLY_REQUIRES_CAMPAIGN_AUDIT' };
  writeJson(path.join(outputDir, 'ARCHIVE.json'), r); return r;
}
