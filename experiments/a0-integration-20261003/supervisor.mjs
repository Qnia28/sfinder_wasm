import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HERE, ROOT } from './common.mjs';
export async function supervised(args, { script = 'sample.mjs', integratedApiMs = 10000, thresholdApiMs = 30000, startupProcessMs = 30000, thresholdProcessMs = 45000 } = {}) {
  const cg = process.env.A0_CGROUP;
  if (process.platform === 'linux' && !cg) throw Error('Hosted child 3GiB cgroup required');
  const oom = () => cg ? Number(fs.readFileSync(path.join(cg, 'memory.events'), 'utf8').match(/^oom_kill (\d+)/m)?.[1] ?? 0) : 0;
  const previousOom = oom(), start = performance.now();
  let command = process.execPath, argv = ['--max-old-space-size=2048', path.join(HERE, script), ...args];
  if (cg) { command = '/bin/bash'; argv = ['-c', `sudo -n sh -c "echo $$ > '$A0_CGROUP/cgroup.procs'" || exit 99; exec "$@"`, 'a0', process.execPath, ...argv]; }
  return new Promise((resolve, reject) => {
    const proc = spawn(command, argv, { cwd: ROOT, env: process.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stdout = '', stderr = '', terminal, apiTimer, processTimer, reapTimer, active = null;
    const events = [];
    function kill(reason) {
      if (terminal) return; terminal = reason; events.push({ reason, engine: active, elapsedMs: performance.now() - start });
      try { if (process.platform === 'win32') proc.kill('SIGKILL'); else process.kill(-proc.pid, 'SIGKILL'); } catch (error) { reject(error); }
      reapTimer = setTimeout(() => reject(Error('Child not reaped within 2s')), 2000);
    }
    function processLimit(ms) { clearTimeout(processTimer); processTimer = setTimeout(() => kill('TIMEOUT_PROCESS'), ms); }
    processLimit(startupProcessMs);
    proc.on('message', m => {
      if (m.type === 'phase-start') {
        if (active || !['integrated', 'threshold'].includes(m.engine)) { kill('ERROR_PHASE_PROTOCOL'); return; }
        active = m.engine; events.push({ type: m.type, engine: active, elapsedMs: performance.now() - start });
        clearTimeout(apiTimer); apiTimer = setTimeout(() => kill('TIMEOUT_API'), active === 'integrated' ? integratedApiMs : thresholdApiMs);
        processLimit(active === 'integrated' ? startupProcessMs : thresholdProcessMs);
      } else if (m.type === 'phase-done') {
        if (active !== m.engine) { kill('ERROR_PHASE_PROTOCOL'); return; }
        clearTimeout(apiTimer); events.push({ type: m.type, engine: active, elapsedMs: performance.now() - start }); active = null; processLimit(startupProcessMs);
      }
    });
    proc.stdout.on('data', b => { stdout += b; if (stdout.length > 16 * 2 ** 20) kill('ERROR_OUTPUT_LIMIT'); });
    proc.stderr.on('data', b => { stderr += b; if (stderr.length > 2 ** 20) kill('ERROR_LOG_LIMIT'); });
    proc.once('error', error => { clearTimeout(apiTimer); clearTimeout(processTimer); clearTimeout(reapTimer); reject(error); });
    proc.once('close', (code, signal) => {
      clearTimeout(apiTimer); clearTimeout(processTimer); clearTimeout(reapTimer);
      if (cg && Number(fs.readFileSync(path.join(cg, 'memory.current'), 'utf8')) > 64 * 2 ** 20) { reject(Error('Cgroup not reaped')); return; }
      let result;
      if (!terminal && code === 0) { try { result = JSON.parse(stdout.trim()); } catch { terminal = 'ERROR_RESULT_PARSE'; } }
      resolve({ ...(result ?? {}), status: oom() > previousOom ? 'OOM' : terminal ?? result?.status ?? 'ERROR', code, signal, stderr, events, processWallMs: performance.now() - start });
    });
  });
}
