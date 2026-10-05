// Offline provenance/schedule/runner audit; never launches a solver or replaces raw.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hash, identity, readJson, writeJson } from './contracts.mjs';
import { loadHistory, filesUnder } from './plan-wave.mjs';
import { validateCampaign, roundTasks, jobShape, worstCallMs, campaignTimes } from './campaign.mjs';

export function auditExecution(plan, historyDir, waveDir, { sourceCommit = null } = {}) {
  validateCampaign(plan);
  const history = loadHistory(historyDir, plan), issues = [], eligibilityDifferences = [], planned = new Map();
  const check = (label, fn) => { try { fn(); } catch (error) { issues.push({ label, error: error.message }); } };
  const sourceAudit = [];
  if (sourceCommit) for (const [filename, expected] of Object.entries(plan.sourceFiles)) check('source:' + filename, () => {
    const actual = hash(execFileSync('git', ['show', `${sourceCommit}:${filename}`], { maxBuffer: 128 * 1024 * 1024 }));
    assert.equal(actual, expected); sourceAudit.push({ filename, sha256: actual });
  });
  const waves = filesUnder(waveDir).filter(filename => path.basename(filename) === 'WAVE_PLAN.json').map(filename => ({ filename, ...readJson(filename) }))
    .sort((a, b) => Date.parse(a.plannedUtc) - Date.parse(b.plannedUtc));
  assert(waves.length, 'wave plans are required');
  const waveSummaries = [], seenPrior = [], shape = jobShape(plan);
  for (const wave of waves) {
    const directory = path.dirname(wave.filename), chunks = filesUnder(directory).filter(f => /[\\/]chunk-\d+\.json$/.test(f)).map(readJson);
    check('wave:' + wave.stage, () => {
      assert.equal(wave.campaignId, plan.campaignId); assert.equal(chunks.length, wave.chunks);
      assert.equal(wave.elapsedMs, Date.parse(wave.plannedUtc) - Date.parse(plan.originUtc));
      assert.equal(wave.maxParallel, 16);
      let calls = 0, tasks = 0;
      for (const chunk of chunks) {
        assert.equal(chunk.sourceLock, identity(plan.sourceFiles)); assert.equal(chunk.campaignId, plan.campaignId);
        assert(chunk.tasks.length <= shape.maximumTasks);
        assert(chunk.worstMs <= plan.policy.jobSoftMs - plan.policy.finishReserveMs);
        tasks += chunk.tasks.length;
        for (const task of chunk.tasks) {
          const entries = task.calls ?? [{ inputId: task.command.id, callId: task.id }]; calls += entries.length;
          const expectedWorst = task.action === 'capture' ? worstCallMs(plan.captureLimits)
            : entries.reduce((sum, call) => sum + worstCallMs(plan.limits[call.engine]), 0);
          assert.equal(task.worstMs, expectedWorst);
          for (const call of entries) {
            const key = `${wave.stage}/${call.callId}`; assert(!planned.has(key), 'duplicate planned call');
            planned.set(key, { ...call, action: task.action, chunkId: chunk.id });
          }
        }
      }
      assert.equal(tasks, wave.tasks); assert.equal(calls, wave.calls);
    });
    if (wave.stage !== 'capture') {
      const descriptors = new Map(chunks.flatMap(c => c.tasks).map(t => [t.inputId, t.fixture]));
      // Decisions include excluded fixtures even when a wave has no tasks.
      const fixtures = [...new Set(wave.decisions.map(d => d.inputId))].map(id => descriptors.get(id) ?? { id });
      const rebuilt = roundTasks(plan, fixtures, seenPrior.filter(r => r.action === 'secondary'), Number(wave.stage), Date.parse(wave.plannedUtc));
      const recorded = new Map(wave.decisions.map(d => [`${d.inputId}/${d.engine}`, d]));
      for (const decision of rebuilt.decisions) {
        const actual = recorded.get(`${decision.inputId}/${decision.engine}`);
        if (!actual || actual.eligible !== decision.eligible || actual.reason !== decision.reason)
          eligibilityDifferences.push({ stage: wave.stage, inputId: decision.inputId, engine: decision.engine, recorded: actual, fullHistoryDecision: decision });
      }
    }
    seenPrior.push(...history.rows.filter(row => String(row.stage) === String(wave.stage)));
    waveSummaries.push({ stage: wave.stage, plannedUtc: wave.plannedUtc, elapsedMinutes: wave.elapsedMs / 60000,
      tasks: wave.tasks, jobs: wave.chunks, calls: wave.calls, historyRowsSeenByPlanner: wave.historyRows });
  }
  const actual = new Set();
  for (const row of history.rows) check('raw:' + row.callId, () => {
    const key = `${row.stage}/${row.callId}`, expected = planned.get(key);
    assert(expected, 'raw call absent from durable wave plan'); assert(!actual.has(key), 'duplicate raw including NOT_RUN'); actual.add(key);
    assert.equal(row.inputId, expected.inputId); assert.equal(row.chunkId, expected.chunkId);
    if (row.action === 'secondary' && row.execution) {
      for (const name of ['engine', 'repeat', 'position', 'shard']) assert.equal(row[name], expected[name]);
      assert.equal(row.condition.sourceLock, identity(plan.sourceFiles)); assert.equal(row.condition.exactHumanQuality, 'true');
      assert.deepEqual(row.condition.limits, plan.limits[row.engine]);
      assert.equal(row.condition.fixtureSha256, expected.fixture.sha256);
      assert.equal(row.condition.cpLimitMs, row.engine === 'cpsat' ? plan.cpLimitMs : null);
    }
    if (row.status !== 'EXACT') assert.equal(row.ms, null);
    if (row.status === 'OOM') assert(row.execution.memoryEvents.afterOom > row.execution.memoryEvents.beforeOom);
  });
  const locks = history.files.filter(f => path.basename(f) === 'RUN_LOCK.json').map(filename => ({ filename, ...readJson(filename) }));
  const intervals = [], runnerEnvironments = [];
  for (const lock of locks) check('runner:' + lock.filename, () => {
    assert.equal(lock.sourceLock, identity(plan.sourceFiles)); assert.equal(lock.originUtc, plan.originUtc);
    assert(lock.memoryScope.memoryMax > 0 && lock.memoryScope.memoryMax <= 3 * 1024 ** 3); assert.equal(lock.memoryScope.swapMax, 0);
    assert.equal(lock.environment.node, 'v24.13.0'); assert.equal(lock.environment.platform, 'linux');
    const started = Date.parse(lock.startedUtc), times = campaignTimes(plan, started);
    const ownRows = loadHistory(path.dirname(lock.filename), plan).rows;
    if (Number(lock.stage) > plan.policy.initialRepeats && ownRows.some(r => r.execution)) assert(started < times.extraEnd);
    const complete = readJson(path.join(path.dirname(lock.filename), 'COMPLETE.json'));
    const finished = Date.parse(complete.finishedUtc); assert(finished < times.end);
    assert(finished >= started && finished - started <= shape.taskScopeSeconds * 1000, 'scope exceeded its hard runtime');
    intervals.push({ runner: `${lock.stage}/${lock.chunkId}`, started, finished });
    runnerEnvironments.push({ stage: lock.stage, chunkId: lock.chunkId, part: lock.part, startedUtc: lock.startedUtc,
      finishedUtc: complete.finishedUtc, memoryScope: lock.memoryScope, environment: lock.environment });
  });
  // Part intervals are non-overlapping portions of one VM. Upload/setup time is
  // excluded, so this is a solver-scope peak, not a whole-workflow VM proof.
  const events = intervals.flatMap(i => [{ at: i.started, delta: 1 }, { at: i.finished, delta: -1 }]).sort((a, b) => a.at - b.at || a.delta - b.delta);
  let current = 0, peak = 0;
  for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
  check('solver-scope-concurrency', () => assert(peak <= 16));
  return { schema: 1, campaignId: plan.campaignId, originUtc: plan.originUtc, sourceCommit,
    provenanceScheduleSafety: issues.length ? 'REVIEW_REQUIRED' : 'PASS_FOR_RECORDED_FILES', issues,
    sourceFilesVerified: sourceAudit.length, sourceLock: identity(plan.sourceFiles), waves: waveSummaries,
    plannedCalls: planned.size, rawRows: history.rows.length, missingPlannedRaw: [...planned.keys()].filter(k => !actual.has(k)),
    eligibilityAgainstFullDurableHistory: eligibilityDifferences.length ? 'DIFFERENCES_RECORDED_NOT_REPLACED' : 'MATCH',
    eligibilityDifferences, solverScopePeak: peak, runnerEnvironments, ledgerWarnings: history.ledgerWarnings };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, historyDir, waveDir, sourceCommit, outputFile] = process.argv.slice(2);
  const report = auditExecution(readJson(planFile), historyDir, waveDir, { sourceCommit });
  writeJson(outputFile, report);
  console.log(JSON.stringify({ campaignId: report.campaignId, safety: report.provenanceScheduleSafety,
    eligibilityDifferences: report.eligibilityDifferences.length, missingPlannedRaw: report.missingPlannedRaw.length, peak: report.solverScopePeak }));
}
