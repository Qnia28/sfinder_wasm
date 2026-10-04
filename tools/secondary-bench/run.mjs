import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, readJson, writeJson } from './contracts.mjs';
import { informationSchedule, validateManifest } from './schedule.mjs';
import { runIsolated } from './isolation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const childFile = new URL('./child.mjs', import.meta.url);
export function verifyFiles(files) {
  for (const [relative, expected] of Object.entries(files)) {
    const filename = path.resolve(root, relative);
    assert(filename.startsWith(root + path.sep), 'source lock escapes repository');
    assert.equal(hash(fs.readFileSync(filename)), expected, relative);
  }
}
function durableAppend(fd, object) { fs.writeSync(fd, JSON.stringify(object) + '\n'); fs.fsyncSync(fd); }
export function requireLinuxMemoryScope() {
  // The whole shard scope is limited: parent + one child + nested CP threads.
  // This is stricter than an unbounded parent with a 3GiB child. Scope is explicit.
  assert.equal(process.platform, 'linux', 'real benchmark runs on public Linux Actions, not local timing');
  const relative = fs.readFileSync('/proc/self/cgroup', 'utf8').trim().split('\n').find(s => s.startsWith('0::'))?.slice(3);
  assert(relative, 'cgroup v2 required');
  const directory = path.join('/sys/fs/cgroup', relative);
  const memory = fs.readFileSync(path.join(directory, 'memory.max'), 'utf8').trim();
  const swap = fs.readFileSync(path.join(directory, 'memory.swap.max'), 'utf8').trim();
  assert(memory !== 'max' && Number(memory) > 0 && Number(memory) <= 3 * 1024 ** 3 && swap === '0', 'run shard in MemoryMax=3G / MemorySwapMax=0 scope');
  return { scope: 'shard-process-tree', memoryMax: Number(memory), swapMax: 0, cgroup: relative,
    memoryEventsPath: path.join(directory, 'memory.events') };
}
export async function runInformation(planFile, outputDir, shard) {
  const planBytes = fs.readFileSync(planFile), plan = validateManifest(readJson(planFile));
  assert(Number.isInteger(shard) && shard >= 0 && shard < plan.shards);
  verifyFiles(plan.sourceFiles);
  const memoryScope = requireLinuxMemoryScope();
  const schedule = informationSchedule(plan.fixtures, { repeats: plan.repeats, shards: plan.shards, seed: plan.scheduleSeed }).filter(call => call.shard === shard);
  fs.mkdirSync(outputDir, { recursive: false }); // Never append to an old run.
  writeJson(path.join(outputDir, 'RUN_LOCK.json'), { pid: process.pid, shard, campaignId: plan.campaignId, manifestSha256: hash(planBytes), started: new Date().toISOString(), memoryScope,
    github: { runId: process.env.GITHUB_RUN_ID ?? null, job: process.env.GITHUB_JOB ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, commit: process.env.GITHUB_SHA ?? null } });
  writeJson(path.join(outputDir, 'SCHEDULE.json'), schedule);
  const raw = fs.openSync(path.join(outputDir, 'raw.jsonl'), 'wx'), outcomes = [];
  const started = Date.now(), overallEnd = Date.parse(plan.budget.originUtc) + plan.budget.overallMs;
  const deadline = Math.min(started + plan.budget.jobMs, overallEnd);
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('run cancelled'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    for (const call of schedule) {
      const limits = plan.limits[call.engine], worstMs = limits.startupMs + limits.callMs + 2 * limits.reapMs;
      if (Date.now() + worstMs > deadline || controller.signal.aborted) {
        const record = { callId: call.callId, inputId: call.inputId, engine: call.engine, repeat: call.repeat,
          shard, status: controller.signal.aborted ? 'NOT_RUN_CANCELLED' : 'NOT_RUN_BUDGET' };
        durableAppend(raw, record); outcomes.push(record); continue;
      }
      const fixturePath = path.resolve(path.dirname(planFile), call.fixture.path);
      assert.equal(hash(fs.readFileSync(fixturePath)), call.fixture.sha256, 'fixture bytes changed');
      const eventFd = fs.openSync(path.join(outputDir, call.callId + '.events.jsonl'), 'wx');
      const stdout = fs.openSync(path.join(outputDir, call.callId + '.stdout.log'), 'wx');
      const stderr = fs.openSync(path.join(outputDir, call.callId + '.stderr.log'), 'wx');
      let execution;
      try {
        execution = await runIsolated({ childFile, limits, signal: controller.signal,
          job: { action: 'secondary', engine: call.engine, fixturePath, fixtureSha256: call.fixture.sha256,
            cpLimitMs: plan.cpLimitMs, exactHumanQuality: 'true' },
          onEvent: event => durableAppend(eventFd, event),
          onOutput: (name, bytes) => fs.writeSync(name === 'stdout' ? stdout : stderr, bytes) });
      } finally { for (const fd of [eventFd, stdout, stderr]) { fs.fsyncSync(fd); fs.closeSync(fd); } }
      const record = { callId: call.callId, inputId: call.inputId, engine: call.engine, repeat: call.repeat,
        blockId: call.blockId, shard, runnerId: `${process.env.GITHUB_RUN_ID ?? 'unknown'}/${shard}`,
        status: execution.status, ms: execution.status === 'EXACT' ? execution.result.responseMs : null,
        condition: { lifecycle: plan.lifecycle, boundary: 'child-call-entry-to-engine-result',
          sourceLock: hash(JSON.stringify(plan.sourceFiles)), fixtureSha256: call.fixture.sha256,
          limits, exactHumanQuality: 'true', cpLimitMs: call.engine === 'cpsat' ? plan.cpLimitMs : null }, execution };
      // Persist/fsync before starting another engine; timeout records included.
      durableAppend(raw, record); outcomes.push(record);
      console.log(JSON.stringify({ callId: call.callId, status: record.status, ms: record.ms }));
      if (!execution.reaped || !['EXACT', 'INCOMPLETE', 'TIMEOUT_CALL', 'TIMEOUT_STARTUP', 'CANCELLED'].includes(record.status)) throw new Error('unsafe/invalid call; run stopped: ' + call.callId);
    }
    verifyFiles(plan.sourceFiles);
    writeJson(path.join(outputDir, 'COMPLETE.json'), { campaignId: plan.campaignId, outcomes: outcomes.length,
      exact: outcomes.filter(r => r.status === 'EXACT').length, allExact: outcomes.every(r => r.status === 'EXACT'),
      finished: new Date().toISOString(), performancePass: 'NOT_APPLICABLE_INFORMATION_COLLECTION' });
  } finally { fs.closeSync(raw); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, outputDir, shardText] = process.argv.slice(2);
  if (!planFile || !outputDir || shardText === undefined) throw new Error('usage: run.mjs <approved-manifest.json> <new-output-dir> <shard>');
  await runInformation(path.resolve(planFile), path.resolve(outputDir), Number(shardText));
}
