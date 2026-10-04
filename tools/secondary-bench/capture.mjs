import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hash, readJson, writeJson, assertExact, validateLimits, positiveMs } from './contracts.mjs';
import { verifyFiles, requireLinuxMemoryScope } from './run.mjs';
import { runIsolated } from './isolation.mjs';

const [planFile, outputDir, shardText] = process.argv.slice(2);
if (!planFile || !outputDir || shardText === undefined) throw new Error('usage: capture.mjs <approved-capture-plan.json> <new-output-dir> <shard>');
const plan = readJson(planFile), shard = Number(shardText);
assert.equal(plan.state, 'APPROVED', 'capture range/timeouts/budget must be agreed first');
assertExact(plan.exactHumanQuality); validateLimits(plan.limits);
positiveMs(plan.phaseLimits?.enumeration, 'enumeration limit');
positiveMs(plan.phaseLimits?.primary, 'each-filter primary limit');
assert(typeof plan.approvalRecord === 'string' && plan.approvalRecord.length);
assert(Number.isInteger(plan.shards) && plan.shards >= 1 && plan.shards <= 16 && Number.isInteger(shard) && shard >= 0 && shard < plan.shards);
assert(Array.isArray(plan.commands) && plan.commands.length > 0);
positiveMs(plan.jobMs, 'capture job deadline'); positiveMs(plan.overallMs, 'capture overall deadline');
assert(Number.isFinite(Date.parse(plan.originUtc)));
assert(Number.isInteger(plan.maxCalls) && plan.commands.length <= plan.maxCalls);
assert(Object.keys(plan.sourceFiles ?? {}).length > 0); verifyFiles(plan.sourceFiles);
const memoryScope = requireLinuxMemoryScope();
fs.mkdirSync(outputDir, { recursive: false });
writeJson(path.join(outputDir, 'RUN_LOCK.json'), { manifestSha256: hash(fs.readFileSync(planFile)), shard, started: new Date().toISOString(), memoryScope });
const fd = fs.openSync(path.join(outputDir, 'raw.jsonl'), 'wx');
const end = Math.min(Date.now() + plan.jobMs, Date.parse(plan.originUtc) + plan.overallMs);
const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
try {
  for (let index = shard; index < plan.commands.length; index += plan.shards) {
    const command = plan.commands[index]; assertExact(command.exactHumanQuality);
    const worst = plan.limits.startupMs + plan.limits.callMs + 2 * plan.limits.reapMs;
    let record;
    if (Date.now() + worst > end || controller.signal.aborted) record = { inputId: command.id, status: controller.signal.aborted ? 'NOT_RUN_CANCELLED' : 'NOT_RUN_BUDGET' };
    else {
      const events = fs.openSync(path.join(outputDir, `${index}.events.jsonl`), 'wx');
      let execution;
      try {
        execution = await runIsolated({ childFile: new URL('./child.mjs', import.meta.url), limits: plan.limits,
          phaseLimits: plan.phaseLimits, signal: controller.signal,
          onEvent: message => { fs.writeSync(events, JSON.stringify(message) + '\n'); fs.fsyncSync(events); },
          job: { action: 'capture', command, outputDir: path.resolve(outputDir, String(index)), exactHumanQuality: 'true' } });
      } finally { fs.closeSync(events); }
      record = { inputId: command.id, status: execution.status, execution };
    }
    fs.writeSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd);
    console.log(JSON.stringify({ inputId: command.id, status: record.status }));
    if (record.execution && (!record.execution.reaped || !['CAPTURED', 'TIMEOUT_CALL', 'TIMEOUT_STARTUP', 'TIMEOUT_PHASE_ENUMERATION', 'TIMEOUT_PHASE_PRIMARY', 'CANCELLED'].includes(record.status))) throw new Error('capture failed; inspect raw');
  }
  verifyFiles(plan.sourceFiles);
} finally { fs.closeSync(fd); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
