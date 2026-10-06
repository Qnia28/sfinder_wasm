// A disposable 3GiB process-tree scope per call, never per multi-engine block.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from './contracts.mjs';
import { runIsolated } from './isolation.mjs';
import { requireLinuxMemoryScope } from './run.mjs';

const exec = promisify(execFile);
export async function isolatedScope(request, outputDir) {
  assert.equal(process.platform, 'linux', 'measurement scopes require Linux Actions');
  fs.mkdirSync(outputDir, { recursive: false });
  const requestFile = path.resolve(outputDir, 'REQUEST.json'); writeJson(requestFile, request);
  const unit = `secondary-call-${process.env.GITHUB_RUN_ID}-${request.callId}`;
  assert(/^[a-zA-Z0-9-]+$/.test(unit));
  const seconds = Math.ceil((request.limits.startupMs + request.limits.callMs + 2 * request.limits.reapMs + 10000) / 1000);
  let exitCode = 0, cancelled = false;
  const abort = () => { cancelled = true; void exec('sudo', ['systemctl', 'stop', unit]).catch(() => {}); };
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  try {
    await exec('sudo', ['systemd-run', '--unit=' + unit, '--wait', '--pipe', '--service-type=exec',
      '--property=MemoryMax=3G', '--property=MemorySwapMax=0', '--property=OOMPolicy=stop',
      '--property=RuntimeMaxSec=' + seconds, '--property=KillMode=control-group', '--uid=' + process.getuid(),
      '--working-directory=' + process.cwd(), '/usr/bin/env', 'PATH=' + process.env.PATH,
      'GITHUB_RUN_ID=' + process.env.GITHUB_RUN_ID, 'GITHUB_JOB=' + process.env.GITHUB_JOB,
      process.execPath, fileURLToPath(import.meta.url), 'inner', requestFile, path.resolve(outputDir)],
    { timeout: (seconds + 20) * 1000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    exitCode = error.code ?? 'UNKNOWN';
    fs.writeFileSync(path.join(outputDir, 'scope-stderr.log'), String(error.stderr ?? error));
  } finally {
    process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort);
  }
  let properties, inspectError = null;
  try {
    const args = ['systemctl', 'show', unit, '-p', 'Result', '-p', 'MemoryPeak', '-p', 'CPUUsageNSec', '-p', 'ExecMainStatus', '-p', 'ActiveState', '-p', 'LoadState'];
    let stdout;
    try { ({ stdout } = await exec('sudo', args, { timeout: 10000 })); }
    catch (error) { stdout = error.stdout ?? ''; inspectError = String(error.stderr ?? error); }
    properties = Object.fromEntries(stdout.trim().split('\n').filter(line => line.includes('='))
      .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  } finally {
    // Only our exact unit. Kill/stop finishes before a different engine starts.
    await exec('sudo', ['systemctl', 'stop', unit], { timeout: 10000 }).catch(() => {});
  }
  const executionFile = path.join(outputDir, 'EXECUTION.json');
  const execution = fs.existsSync(executionFile) ? readJson(executionFile) : { status: 'ERROR_SCOPE', reaped: false, result: null };
  const oom = properties.Result === 'oom-kill';
  // Successful transient units may be garbage-collected before show. Accept
  // not-found only with systemd-run success AND a durable, reaped execution.
  const reaped = ['inactive', 'failed'].includes(properties.ActiveState)
    && (properties.LoadState !== 'not-found' || exitCode === 0 && execution.reaped);
  const final = { ...execution, status: cancelled ? 'CANCELLED' : oom ? 'OOM' : exitCode !== 0 ? 'ERROR_SCOPE_EXIT' : execution.status,
    reaped: reaped && (cancelled || oom || execution.reaped),
    memoryScope: { kind: 'CALL_PROCESS_TREE_PARENT_CHILD_AND_NESTED_WORKERS', memoryMax: 3 * 1024 ** 3, swapMax: 0,
      unit, properties, inspectError, peakBytes: /^[0-9]+$/.test(properties.MemoryPeak) ? Number(properties.MemoryPeak)
        : execution.scopePeakBytes ?? null, cpuUsec: /^[0-9]+$/.test(properties.CPUUsageNSec) ? Number(properties.CPUUsageNSec) / 1000
        : execution.scopeCpuUsec ?? null, exitCode } };
  writeJson(path.join(outputDir, 'SCOPE_COMPLETE.json'), final);
  await exec('sudo', ['systemctl', 'reset-failed', unit]).catch(() => {});
  return final;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, filename, directory] = process.argv.slice(2); assert.equal(mode, 'inner');
  const request = readJson(filename), scope = requireLinuxMemoryScope();
  writeJson(path.join(directory, 'CALL_LOCK.json'), { startedUtc: new Date().toISOString(), pid: process.pid,
    node: process.version, memoryScope: scope, request });
  const events = fs.openSync(path.join(directory, 'events.jsonl'), 'wx');
  const policyTrace = [];
  const stdout = fs.openSync(path.join(directory, 'stdout.log'), 'wx'), stderr = fs.openSync(path.join(directory, 'stderr.log'), 'wx');
  try {
    const execution = await runIsolated({ childFile: request.contractChildFile ? path.resolve(request.contractChildFile) : new URL('./child.mjs', import.meta.url), job: request.job,
      limits: request.limits, phaseLimits: request.phaseLimits,
      onEvent: event => { fs.writeSync(events, JSON.stringify(event) + '\n'); fs.fsyncSync(events);
        if (event.event === 'phase' && event.name === 'policy-trace' && policyTrace.length < 64) policyTrace.push(event.trace); },
      onOutput: (name, bytes) => fs.writeSync(name === 'stdout' ? stdout : stderr, bytes) });
    const cgroupDirectory = path.dirname(scope.memoryEventsPath);
    const peak = fs.readFileSync(path.join(cgroupDirectory, 'memory.peak'), 'utf8').trim();
    const cpuStat = fs.readFileSync(path.join(cgroupDirectory, 'cpu.stat'), 'utf8');
    writeJson(path.join(directory, 'EXECUTION.json'), { ...execution,
      ...(request.job.action === 'triage' ? { policyTrace } : {}),
      scopeCpuUsec: Number(cpuStat.match(/^usage_usec (\d+)$/m)?.[1]) || null,
      scopeCpuStat: cpuStat,
      scopePeakBytes: /^[0-9]+$/.test(peak) ? Number(peak) : null,
      scopeMemoryEvents: fs.readFileSync(scope.memoryEventsPath, 'utf8') });
  } finally { for (const fd of [events, stdout, stderr]) { fs.fsyncSync(fd); fs.closeSync(fd); } }
}
