// Offline final audit. A green Actions run is ONLY transport completion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, verifyResult, identity } from './contracts.mjs';
import { validateCampaign } from './campaign.mjs';
import { ENGINES } from './contracts.mjs';
import { loadHistory, chooseFixtures } from './plan-wave.mjs';
import { informationSchedule } from './schedule.mjs';
import { selectInformationRetests } from './select-retests.mjs';

export function reportCampaign(plan, historyDir) {
  validateCampaign(plan);
  const { files, rows } = loadHistory(historyDir, plan), selection = chooseFixtures(plan, files);
  const fixtures = new Map(selection.selected.map(f => [f.id, readJson(f.filename)]));
  const descriptors = new Map(selection.selected.map(f => [f.id, f]));
  const schedule = informationSchedule(selection.selected, { repeats: 10, shards: 1, seed: plan.scheduleSeed });
  const scheduled = new Map(schedule.map(c => [c.callId, c])), issues = [], witnesses = new Map();
  const secondary = rows.filter(r => r.action === 'secondary'), initial = secondary.filter(r => r.repeat <= 2);
  const missingInitial = schedule.filter(c => c.repeat <= 2 && !initial.some(r => r.callId === c.callId && r.execution)).map(c => c.callId);
  for (const row of secondary) {
    try {
      const call = scheduled.get(row.callId); assert(call, 'unplanned call');
      for (const key of ['inputId', 'engine', 'repeat', 'position', 'shard']) if (row.execution) assert.equal(row[key], call[key]);
      if (row.status !== 'EXACT') { assert.equal(row.ms, null, 'censored call has exact time'); continue; }
      assert(row.execution?.reaped && row.execution.code === 0 && row.execution.status === 'EXACT');
      assert.equal(row.ms, row.execution.result.responseMs); assert(Number.isFinite(row.ms) && row.ms > 0);
      assert.equal(row.condition.fixtureSha256, descriptors.get(row.inputId).sha256);
      assert.equal(row.condition.sourceLock, identity(plan.sourceFiles));
      assert.equal(row.condition.exactHumanQuality, 'true'); assert.equal(row.execution.result.qualityResolved, 'true');
      assert.equal(row.execution.result.stateBudget, null);
      const witness = verifyResult(fixtures.get(row.inputId), row.execution.result.result, { engine: row.engine });
      assert.equal(witness.completed, true); assert.deepEqual(witness, row.execution.result.verified);
      const signature = JSON.stringify(witness);
      if (witnesses.has(row.inputId)) assert.equal(signature, witnesses.get(row.inputId), 'exact engines/repeats disagree');
      else witnesses.set(row.inputId, signature);
    } catch (error) { issues.push({ callId: row.callId, error: error.message }); }
  }
  const repeatLedger = [];
  for (const fixture of selection.selected) for (const engine of ENGINES) {
    const attempts = secondary.filter(r => r.inputId === fixture.id && r.engine === engine && r.execution).sort((a, b) => a.repeat - b.repeat);
    repeatLedger.push({ inputId: fixture.id, engine, attempts: attempts.length, repeats: attempts.map(r => r.repeat), statuses: attempts.map(r => r.status),
      runnerIds: [...new Set(attempts.map(r => r.runnerId))],
      sameRunnerPerPair: [2, 4, 6, 8, 10].filter(n => attempts.some(r => r.repeat === n)).every(n => {
        const pair = attempts.filter(r => r.repeat === n - 1 || r.repeat === n); return pair.length === 2 && pair[0].runnerId === pair[1].runnerId;
      }) });
  }
  const expectedCapture = new Set(plan.commands.map(c => c.id));
  const captureMissing = [...expectedCapture].filter(id => !rows.some(r => r.action === 'capture' && r.inputId === id && r.execution));
  const harnessErrors = files.filter(f => path.basename(f) === 'HARNESS_ERROR.json').map(f => ({ file: f, ...readJson(f) }));
  const incompleteChunks = files.filter(f => path.basename(f) === 'RUN_LOCK.json').filter(f => !fs.existsSync(path.join(path.dirname(f), 'COMPLETE.json')));
  const scopeExits = files.filter(f => path.basename(f) === 'scope-exit-code.txt').map(f => ({ file: f, code: Number(fs.readFileSync(f, 'utf8').trim()) }));
  const failedScopes = scopeExits.filter(e => e.code !== 0);
  const diagnostic = selectInformationRetests(initial.filter(r => r.condition), { expectedRepeats: 2 });
  const captureIncomplete = rows.filter(r => r.action === 'capture' && r.status !== 'CAPTURED').map(r => ({ inputId: r.inputId, status: r.status }));
  return { schema: 2, campaignId: plan.campaignId, originUtc: plan.originUtc, policy: plan.policy,
    actionsSuccessIsNotCorrectnessPass: true, performancePass: 'NOT_APPLICABLE_INFORMATION_COLLECTION',
    witnessAudit: issues.length ? 'FAIL' : 'PASS_FOR_RECORDED_EXACT_RESULTS',
    optimalityAudit: 'ENGINE_PROOFS_AND_AGREEMENT_WITH_SHARED_PRODUCT_PRIMITIVES',
    issues, harnessErrors, incompleteChunks, failedScopes, missingInitial, captureMissing, captureIncomplete,
    collectionState: issues.length || harnessErrors.length || incompleteChunks.length || failedScopes.length || missingInitial.length || captureMissing.length || captureIncomplete.length ? 'PARTIAL_OR_REVIEW_REQUIRED' : 'BASE_SCHEDULE_RECORDED',
    expectedCommands: plan.commands.length, selectedFixtures: selection.selected.length, maximumCalls: selection.selected.length * 30,
    statuses: Object.fromEntries([...new Set(rows.map(r => r.status))].map(status => [status, rows.filter(r => r.status === status).length])),
    selectionLedger: selection.ledger, repeatLedger, initialVariabilityDiagnostic: diagnostic,
    note: 'Additional rounds are USER_ADAPTIVE_PAIR collection, not variance-selected retests. Initial samples remain separate.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, historyDir, outputFile] = process.argv.slice(2);
  let report;
  try { report = reportCampaign(readJson(planFile), historyDir); }
  catch (error) { report = { schema: 2, collectionState: 'AUDIT_ERROR', witnessAudit: 'NOT_COMPLETED', error: { message: error.message, stack: error.stack }, actionsSuccessIsNotCorrectnessPass: true }; }
  writeJson(outputFile, report);
  console.log(JSON.stringify({ collectionState: report.collectionState, witnessAudit: report.witnessAudit, selectedFixtures: report.selectedFixtures }));
}
