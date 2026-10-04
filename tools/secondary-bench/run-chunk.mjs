import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, hash, identity } from './contracts.mjs';
import { validateCampaign, campaignTimes, POLICY, unsafeStatus } from './campaign.mjs';
import { verifyFiles, requireLinuxMemoryScope } from './run.mjs';
import { runIsolated } from './isolation.mjs';

function oomKills(scope) {
  if (!scope.memoryEventsPath) return null;
  const entries = fs.readFileSync(scope.memoryEventsPath, 'utf8').trim().split('\n').map(line => line.split(/\s+/));
  return Number(Object.fromEntries(entries).oom_kill ?? 0);
}

export async function runChunk(bundleDir, chunkId, outputDir, { now = Date.now, isolate = runIsolated, memoryCheck = requireLinuxMemoryScope,
  part = null, haltFile = null } = {}) {
  const plan = validateCampaign(readJson(path.join(bundleDir, 'campaign.json')));
  const chunk = readJson(path.join(bundleDir, `chunk-${chunkId}.json`));
  if (part !== null) {
    assert(Number.isInteger(part) && part >= 0 && part < 4);
    chunk.tasks = chunk.tasks[part] ? [chunk.tasks[part]] : [];
  }
  assert.equal(chunk.campaignId, plan.campaignId); assert.equal(chunk.sourceLock, identity(plan.sourceFiles));
  verifyFiles(plan.sourceFiles);
  const memoryScope = memoryCheck(), started = now(), end = Math.min(started + POLICY.jobSoftMs - POLICY.finishReserveMs, campaignTimes(plan, started).end - POLICY.finishReserveMs);
  fs.mkdirSync(outputDir, { recursive: false }); fs.mkdirSync(path.join(outputDir, 'fixtures'));
  writeJson(path.join(outputDir, 'RUN_LOCK.json'), { campaignId: plan.campaignId, chunkId, stage: chunk.stage,
    part, startedUtc: new Date(started).toISOString(), originUtc: plan.originUtc, sourceLock: chunk.sourceLock, memoryScope,
    github: { runId: process.env.GITHUB_RUN_ID ?? null, job: process.env.GITHUB_JOB ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null },
    environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch } });
  const fd = fs.openSync(path.join(outputDir, 'raw.jsonl'), 'wx'), controller = new AbortController();
  const cancel = () => controller.abort(); process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const deadlineTimer = setTimeout(cancel, Math.max(1, end - now()));
  const append = object => { fs.writeSync(fd, JSON.stringify(object) + '\n'); fs.fsyncSync(fd); };
  const base = { campaignId: plan.campaignId, sourceLock: chunk.sourceLock, chunkId, stage: chunk.stage,
    runnerId: `${process.env.GITHUB_RUN_ID ?? 'contract'}/${chunk.stage}/${chunkId}/${process.env.GITHUB_RUN_ATTEMPT ?? 1}` };
  let halted = haltFile && fs.existsSync(haltFile) ? 'EARLIER_CHUNK_PART_ERROR' : null, attempts = 0, exact = 0;
  try {
    for (const task of chunk.tasks) {
      let reason = halted;
      if (!reason && controller.signal.aborted) reason = 'CANCELLED';
      if (!reason && task.action === 'secondary' && task.round > 2 && now() >= campaignTimes(plan, now()).extraEnd) reason = 'EXTRA_ADMISSION_6H';
      if (!reason && now() + task.worstMs > end) reason = 'BUDGET';
      if (reason) {
        for (const call of task.calls ?? [{ callId: task.id, inputId: task.command.id }]) append({ ...base, action: task.action,
          callId: call.callId, inputId: call.inputId, engine: call.engine, repeat: call.repeat, ms: null, status: 'NOT_RUN_' + reason });
        continue;
      }
      // Admission reserves BOTH repeats and all eligible engines as one block.
      const calls = task.calls ?? [{ callId: task.id, inputId: task.command.id }];
      for (const call of calls) {
        if (halted || controller.signal.aborted) {
          append({ ...base, action: task.action, callId: call.callId, inputId: call.inputId, engine: call.engine,
            repeat: call.repeat, ms: null, status: 'NOT_RUN_' + (halted ?? 'CANCELLED') }); continue;
        }
        const limits = task.action === 'capture' ? plan.captureLimits : plan.limits[call.engine];
        const events = fs.openSync(path.join(outputDir, call.callId + '.events.jsonl'), 'wx');
        const stdout = fs.openSync(path.join(outputDir, call.callId + '.stdout.log'), 'wx');
        const stderr = fs.openSync(path.join(outputDir, call.callId + '.stderr.log'), 'wx');
        const job = task.action === 'capture' ? { action: 'capture', command: task.command,
          outputDir: path.join(path.resolve(outputDir), 'fixtures'), fixturePrefix: task.id + '-', exactHumanQuality: 'true' }
          : { action: 'secondary', engine: call.engine, fixturePath: path.resolve(bundleDir, task.fixture.path),
            fixtureSha256: task.fixture.sha256, exactHumanQuality: 'true', cpLimitMs: plan.cpLimitMs };
        if (task.action === 'secondary') assert.equal(hash(fs.readFileSync(job.fixturePath)), task.fixture.sha256);
        let execution;
        const beforeOom = oomKills(memoryScope);
        try {
          execution = await isolate({ childFile: new URL('./child.mjs', import.meta.url), job, limits,
            phaseLimits: task.action === 'capture' ? plan.capturePhaseLimits : {}, signal: controller.signal,
            onEvent: event => { fs.writeSync(events, JSON.stringify(event) + '\n'); fs.fsyncSync(events); },
            onOutput: (name, bytes) => fs.writeSync(name === 'stdout' ? stdout : stderr, bytes) });
        } finally { for (const handle of [events, stdout, stderr]) { fs.fsyncSync(handle); fs.closeSync(handle); } }
        const afterOom = oomKills(memoryScope);
        if (beforeOom !== null && afterOom > beforeOom) execution = { ...execution, status: 'OOM',
          originalStatus: execution.status, memoryEvents: { beforeOom, afterOom, scope: memoryScope.scope } };
        attempts++; if (execution.status === 'EXACT') exact++;
        append({ ...base, action: task.action, callId: call.callId, inputId: call.inputId,
          engine: call.engine, repeat: call.repeat, blockId: call.blockId, position: call.position, shard: call.shard,
          status: execution.status, ms: execution.status === 'EXACT' ? execution.result.responseMs : null,
          condition: task.action === 'capture' ? null : { lifecycle: plan.lifecycle, boundary: 'child-call-entry-to-engine-result',
            sourceLock: chunk.sourceLock, fixtureSha256: task.fixture.sha256, limits, exactHumanQuality: 'true',
            cpLimitMs: call.engine === 'cpsat' ? plan.cpLimitMs : null }, execution });
        if (!execution.reaped || unsafeStatus(execution.status)) halted = 'UNSAFE_OR_INVALID_RESULT';
      }
    }
    verifyFiles(plan.sourceFiles);
    if (halted && haltFile && !fs.existsSync(haltFile)) writeJson(haltFile, { campaignId: plan.campaignId, chunkId, part, halted });
    writeJson(path.join(outputDir, 'COMPLETE.json'), { campaignId: plan.campaignId, stage: chunk.stage,
      chunkId, attempts, exact, halted, status: halted ? 'STOPPED_FOR_REVIEW' : 'CHUNK_FINISHED',
      finishedUtc: new Date(now()).toISOString(), actionsSuccessIsNotCorrectnessPass: true });
  } finally {
    clearTimeout(deadlineTimer); fs.closeSync(fd); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [bundleDir, chunkId, outputDir, partText, haltFile] = process.argv.slice(2);
  try { await runChunk(bundleDir, Number(chunkId), outputDir, { part: partText === undefined ? null : Number(partText), haltFile }); }
  catch (error) {
    // Quarantine rather than claim PASS. Workflow stays green, data retained.
    fs.mkdirSync(outputDir, { recursive: true });
    writeJson(path.join(outputDir, 'HARNESS_ERROR.json'), { name: error.name, message: error.message, stack: error.stack });
    if (haltFile && !fs.existsSync(haltFile)) writeJson(haltFile, { error: error.message, chunkId });
    console.error(error);
  }
}
