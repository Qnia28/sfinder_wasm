// Independent OFFLINE re-read: never trusts the child's cached witness audit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, hash, verifyResult, validateFixture } from './contracts.mjs';
import { validateManifest, informationSchedule } from './schedule.mjs';
import { verifyFiles } from './run.mjs';

export function auditRecords(plan, records, loadFixture) {
  const calls = informationSchedule(plan.fixtures, { repeats: plan.repeats, shards: plan.shards, seed: plan.scheduleSeed });
  const scheduled = new Map(calls.map(c => [c.callId, c])), seen = new Set(), witnesses = new Map();
  const statuses = {}, issues = [];
  for (const record of records) {
    try {
      const call = scheduled.get(record.callId);
      assert(call, 'unplanned call'); assert(!seen.has(record.callId), 'duplicate raw call'); seen.add(record.callId);
      for (const key of ['inputId', 'engine', 'repeat', 'shard']) assert.equal(record[key], call[key], key);
      statuses[record.status] = (statuses[record.status] ?? 0) + 1;
      if (record.status !== 'EXACT') { assert.equal(record.ms ?? null, null, 'incomplete time treated as exact'); continue; }
      const execution = record.execution;
      assert(execution?.reaped && execution.code === 0 && execution.status === 'EXACT', 'unreaped/failed exact call');
      assert.equal(execution.result.status, 'EXACT');
      assert.equal(record.ms, execution.result.responseMs);
      assert(Number.isFinite(record.ms) && record.ms > 0);
      const bytes = loadFixture(call.fixture);
      assert.equal(hash(bytes), call.fixture.sha256, 'fixture byte hash');
      const fixture = validateFixture(JSON.parse(bytes.toString('utf8')));
      const verified = verifyResult(fixture, execution.result.result, { engine: call.engine });
      assert.equal(verified.completed, true);
      assert.deepEqual(execution.result.verified, verified);
      assert.equal(record.condition.fixtureSha256, call.fixture.sha256);
      assert.equal(record.condition.sourceLock, hash(JSON.stringify(plan.sourceFiles)));
      assert.equal(record.condition.exactHumanQuality, 'true');
      assert.equal(execution.result.qualityResolved, 'true');
      assert.equal(execution.result.stateBudget, null);
      const witness = JSON.stringify(verified);
      if (witnesses.has(call.inputId)) assert.equal(witness, witnesses.get(call.inputId), 'exact cross-engine/repeat mismatch');
      else witnesses.set(call.inputId, witness);
    } catch (error) { issues.push({ callId: record.callId, error: error.message }); }
  }
  const missing = calls.filter(call => !seen.has(call.callId)).map(call => call.callId);
  return { schema: 1, harnessAudit: issues.length || missing.length ? 'FAIL' : 'PASS', issues, missing,
    statuses, plannedCalls: calls.length, rawCalls: records.length,
    allExact: !issues.length && !missing.length && records.every(r => r.status === 'EXACT'),
    independentWitnessAudit: issues.length ? 'FAIL' : 'PASS_FOR_RECORDED_EXACT_RESULTS',
    optimalityAudit: 'ENGINE_PROOFS_PLUS_AGREEMENT_NOT_GENERAL_INDEPENDENT_ORACLE',
    performancePass: 'NOT_APPLICABLE_INFORMATION_COLLECTION' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, outputFile, ...rawFiles] = process.argv.slice(2);
  assert(planFile && outputFile && rawFiles.length, 'usage: audit.mjs <approved-plan> <new-output> <raw.jsonl> [...]');
  const plan = validateManifest(readJson(planFile)); verifyFiles(plan.sourceFiles);
  const records = rawFiles.flatMap(file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)));
  const audit = auditRecords(plan, records, fixture => fs.readFileSync(path.resolve(path.dirname(planFile), fixture.path)));
  writeJson(outputFile, audit); console.log(JSON.stringify(audit));
  if (audit.harnessAudit !== 'PASS') process.exitCode = 1;
}
