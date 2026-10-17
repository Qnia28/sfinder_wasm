import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { refinePlan } from './plan.mjs';
import { hash } from '../secondary-bench/contracts.mjs';
import { digest } from '../fast-bench/planner.mjs';
import { seal, verifySnapshot } from '../secondary-bench/common/evidence.mjs';
import { isolatedScope } from '../secondary-bench/followup-scope.mjs';

const [mode, ...args] = process.argv.slice(2);
const scopePath = 'tools/fast-refine/SCOPE_20261017.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const scope = read(scopePath);
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 ** 2 });
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const summary = text => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};
const sourceLock = () => Object.fromEntries(git('ls-files', 'src', 'wasm', 'tools/fast-bench', 'tools/fast-triage', 'tools/fast-refine', 'tools/secondary-bench', 'package.json', 'package-lock.json',
  '.github/workflows/fast-refine-comparison.yml').toString().trim().split('\n').map(file => [file, hash(fs.readFileSync(file))]));
function remote() {
  assert.equal(process.platform, 'linux', 'population runs only on Linux Actions');
  assert.equal(process.env.GITHUB_REPOSITORY, scope.repository);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/' + scope.branch);
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'new run required; preserve incomplete attempt');
}

async function prepare(output) {
  if (mode === 'plan') remote();
  fs.mkdirSync(output, { recursive: false });
  const plan = refinePlan(scope, read(scope.historicalScope));
  const reference = git('show', scope.referenceCommit + ':' + scope.referenceModule);
  assert.equal(hash(reference), scope.referenceSha256);
  const originMs = Date.now();
  const lock = { study: scope.study, runId: process.env.GITHUB_RUN_ID ?? null,
    commit: git('rev-parse', 'HEAD').toString().trim(), node: process.version,
    originUtc: new Date(originMs).toISOString(), deadlineMs: originMs + scope.deadlineHours * 3600000,
    scopeSha256: hash(fs.readFileSync(scopePath)), sources: mode === 'plan' ? sourceLock() : null, scheduleHash: plan.scheduleHash,
    referenceCommit: scope.referenceCommit, referenceSha256: scope.referenceSha256,
    candidateSha256: hash(fs.readFileSync(scope.referenceModule)),
    adjudication: scope.adjudication, dry: mode !== 'plan' };
  write(path.join(output, 'PLAN.json'), plan); write(path.join(output, 'LOCK.json'), lock);
  await seal(output, { runId: lock.runId, study: scope.study, phase: 'plan' });
  summary(`Refine comparison plan: ${plan.tasks.length} development commands, ${plan.expectedE2E} E2E calls, <=${plan.maxReplayCalls} fixed-seed replays, ${plan.maxCaptureCalls} captures. Reservation ${plan.totalReservedHours.toFixed(3)} runner-hours (not runtime prediction).`);
}

async function measure(planRoot, referenceRoot, shardText, output) {
  remote(); verifySnapshot(planRoot);
  const lock = read(path.join(planRoot, 'LOCK.json')), plan = read(path.join(planRoot, 'PLAN.json'));
  assert(!lock.dry); assert.equal(lock.runId, process.env.GITHUB_RUN_ID);
  assert.equal(lock.node, process.version); assert.equal(lock.scopeSha256, hash(fs.readFileSync(scopePath)));
  assert.equal(lock.commit, git('rev-parse', 'HEAD').toString().trim());
  assert.deepEqual(sourceLock(), lock.sources);
  assert.equal(digest(plan.tasks), lock.scheduleHash);
  const shard = Number(shardText); assert(Number.isInteger(shard) && shard >= 0 && shard < scope.shards);
  referenceRoot = path.resolve(referenceRoot); output = path.resolve(output);
  fs.mkdirSync(output, { recursive: false });
  // The reference is the same candidate checkout with ONLY refine replaced.
  // Comparing whole historical commits would mix other product/harness changes.
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), lock.commit);
  for (const [file, expected] of Object.entries(lock.sources)) assert.equal(hash(fs.readFileSync(path.join(referenceRoot, file))), expected);
  fs.writeFileSync(path.join(referenceRoot, scope.referenceModule), git('show', scope.referenceCommit + ':' + scope.referenceModule));
  const verifySources = () => {
    assert.deepEqual(sourceLock(), lock.sources);
    for (const [file, expected] of Object.entries(lock.sources)) {
      assert.equal(hash(fs.readFileSync(path.join(referenceRoot, file))), file === scope.referenceModule ? scope.referenceSha256 : expected, file);
    }
  };
  verifySources();
  write(path.join(output, 'LOCK.json'), lock);
  write(path.join(output, 'ENVIRONMENT.json'), { shard, cpu: os.cpus()[0].model, cores: os.cpus().length,
    node: process.version, release: os.release(), runId: lock.runId, startedUtc: new Date().toISOString() });
  const tasks = plan.tasks.filter(t => t.shard === shard);
  write(path.join(output, 'TASKS.json'), tasks);
  const raw = fs.openSync(path.join(output, 'raw.jsonl'), 'wx');
  const starts = fs.openSync(path.join(output, 'starts.jsonl'), 'wx');
  const completed = [], captures = [], replayChecks = [];
  const roots = { reference: referenceRoot, candidate: process.cwd() };
  let failure = null;
  async function call(metadata, job, child, callMs) {
    const reservationMs = callMs + scope.limits.startupMs + 2 * scope.limits.reapMs + 10000;
    assert(Date.now() + reservationMs < lock.deadlineMs, 'campaign deadline exhausted');
    fs.writeSync(starts, JSON.stringify({ ...metadata, job, startedUtc: new Date().toISOString() }) + '\n'); fs.fsyncSync(starts);
    const execution = await isolatedScope({ callId: metadata.callId, contractChildFile: child, job,
      limits: { ...scope.limits, callMs }, ...(job.mode === 'capture' ? { phaseLimits: { enumeration: 60000 } } : {}) }, path.join(output, metadata.callId));
    fs.writeSync(raw, JSON.stringify({ ...metadata, job, execution }) + '\n'); fs.fsyncSync(raw);
    completed.push({ ...metadata, status: execution.status, reaped: execution.reaped });
    assert(execution.reaped, 'unreclaimed process ' + metadata.callId);
    assert(['CAPTURED', 'RETURNED', 'RETURNED_EMPTY', 'RETURNED_EXACT', 'RETURNED_APPROX', 'TIMEOUT_CALL', 'TIMEOUT_PHASE_ENUMERATION', 'OOM'].includes(execution.status),
      `${metadata.callId}: ${execution.status}; ${execution.result?.error ?? ''}`);
    return execution;
  }
  try {
    for (const task of tasks) {
      verifySources();
      const command = task.command, inputRoot = path.join(output, 'input-' + task.index);
      const captured = await call({ commandId: command.id, phase: 'capture', callId: digest([scope.study, command.id, 'capture']) },
        { mode: 'capture', command, fixtureDir: inputRoot }, path.resolve('tools/fast-bench/child.mjs'), scope.captureMs);
      captures.push({ commandId: command.id, status: captured.status, filters: captured.result?.filters ?? null });
      if (captured.status !== 'CAPTURED') continue; // Keep scheduled E2E as NOT_RUN_CAPTURE_CENSORED.
      assert.equal(captured.result.secondarySolverCalls, 0);
      for (const fixture of captured.result.filters.filter(f => f.status === 'CAPTURED')) {
        const results = {};
        const implementations = task.index % 2 ? [...scope.implementations].reverse() : scope.implementations;
        for (const implementation of implementations) {
          results[implementation] = await call({ commandId: command.id, fixtureId: fixture.id, implementation, phase: 'replay',
            callId: digest([scope.study, fixture.id, 'replay', implementation]) },
          { fixture, fixturePath: path.join(inputRoot, fixture.member), sourceRoot: roots[implementation],
            moduleSha256: implementation === 'reference' ? scope.referenceSha256 : lock.candidateSha256 },
          path.resolve('tools/fast-refine/replay-child.mjs'), scope.replayMs);
        }
        const comparable = scope.implementations.every(i => results[i].status === 'RETURNED');
        const check = { fixtureId: fixture.id, status: comparable ? 'PASS' : 'CENSORED',
          statuses: Object.fromEntries(scope.implementations.map(i => [i, results[i].status])) };
        if (comparable) {
          try { assert.deepEqual(results.candidate.result.result, results.reference.result.result); }
          catch (error) { check.status = 'FAIL'; replayChecks.push(check); throw new Error('same-seed refine divergence: ' + fixture.id, { cause: error }); }
        }
        replayChecks.push(check);
      }
      for (const c of task.calls) {
        await call(c, { mode: 'e2e', study: 'fast-triage-e2e-20261017', command, inputRoot,
          filters: captured.result.filters, arm: c.policy, diagnostics: c.diagnostics },
        path.join(roots[c.implementation], 'tools/fast-bench/child.mjs'), scope.limits.callMs);
      }
    }
    verifySources();
  } catch (error) { failure = error.stack; process.exitCode = 1; }
  finally {
    fs.closeSync(raw); fs.closeSync(starts);
    const missing = tasks.flatMap(t => t.calls).filter(c => !completed.some(r => r.callId === c.callId))
      .map(c => ({ ...c, status: captures.some(r => r.commandId === c.commandId && r.status !== 'CAPTURED') ? 'NOT_RUN_CAPTURE_CENSORED' : 'NOT_RUN' }));
    write(path.join(output, 'SUMMARY.json'), { shard, study: scope.study, runId: lock.runId, scheduleHash: plan.scheduleHash,
      failure, completed, captures, replayChecks, missing });
    await seal(output, { runId: lock.runId, study: scope.study, shard, phase: 'measure' });
    summary(`## Refine shard ${shard}: ${failure ? 'INVALID' : 'COLLECTION_COMPLETE'}\n${completed.length} calls recorded; ${missing.length} scheduled E2E not run; same-seed replay ${replayChecks.filter(c => c.status === 'PASS').length} PASS / ${replayChecks.filter(c => c.status === 'CENSORED').length} censored.\n${failure ?? 'Engine/seed and final-quality differences across E2E calls are observations, not failures.'}`);
  }
}

if (['prepare', 'plan'].includes(mode)) await prepare(...args);
else if (mode === 'measure') await measure(...args);
else throw new Error('usage: run.mjs prepare|plan OUTPUT | measure PLAN_ROOT REFERENCE_ROOT SHARD OUTPUT');
