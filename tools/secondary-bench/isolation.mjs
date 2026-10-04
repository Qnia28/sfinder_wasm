import { fork, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { validateLimits } from './contracts.mjs';

function killOwnedTree(child, limitMs) {
  if (!child.pid) return Promise.resolve();
  if (process.platform !== 'win32') {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: limitMs });
    killer.once('error', reject);
    killer.once('close', () => resolve());
  });
}

// Parent remains responsive while the child is inside synchronous WASM.
// Child workers/CP threads live inside this disposable process, not the parent.
export function runIsolated({ childFile, job, limits, phaseLimits = {}, signal = null, onEvent = () => {}, onOutput = () => {} }) {
  validateLimits(limits);
  for (const ms of Object.values(phaseLimits)) validateLimits({ startupMs: ms, callMs: ms, reapMs: ms });
  const started = performance.now();
  if (signal?.aborted) return Promise.resolve({ status: 'CANCELLED', reaped: true, result: null, wallMs: 0 });
  return new Promise(resolve => {
    let ready = false, result = null, status = null, callStarted = null, returnMs = null;
    let spawnError = null, timer, phaseTimer, reapTimer, killError = null, stopping = false, settled = false;
    const child = fork(childFile, [], { execArgv: ['--experimental-wasm-stack-switching'],
      serialization: 'advanced', detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const arm = (ms, reason) => { clearTimeout(timer); timer = setTimeout(() => stop(reason), ms); };
    const finish = (code, exitSignal, reaped) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(phaseTimer); clearTimeout(reapTimer); signal?.removeEventListener('abort', abort);
      if (!reaped) { child.unref(); if (child.connected) child.disconnect(); child.stdout.destroy(); child.stderr.destroy(); }
      resolve({ status: !reaped ? 'ERROR_REAP' : status ?? (spawnError ? 'ERROR_SPAWN' : !result ? 'ERROR_PROTOCOL' : code !== 0 ? 'ERROR_EXIT' : result.status),
        reaped, pid: child.pid ?? null, code, exitSignal, spawnError, killError,
        result, wallMs: performance.now() - started, callWallMs: returnMs,
        startupMs: callStarted === null ? null : callStarted - started,
        processReapMs: returnMs === null ? null : performance.now() - callStarted - returnMs });
    };
    const armReap = () => {
      if (reapTimer) return;
      reapTimer = setTimeout(() => {
        reapTimer = null;
        if (stopping) finish(null, null, false);
        else stop('ERROR_REAP'); // Cleanup deadline reached: kill, then join.
      }, limits.reapMs);
    };
    const stop = reason => {
      if (stopping || settled) return;
      stopping = true; status = reason; clearTimeout(timer); clearTimeout(phaseTimer); armReap();
      void killOwnedTree(child, limits.reapMs).catch(error => { killError = error.message; });
    };
    const abort = () => stop('CANCELLED');
    signal?.addEventListener('abort', abort, { once: true });
    for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', bytes => {
      try { onOutput(name, bytes); } catch (error) { status = 'ERROR_STORAGE'; stop('ERROR_STORAGE'); }
    });
    child.once('error', error => { spawnError = error.message; stop('ERROR_SPAWN'); });
    child.on('message', message => {
      if (settled || stopping) return;
      try {
        try { onEvent(message); } catch (error) { spawnError = error.message; stop('ERROR_STORAGE'); return; }
        if (message?.event === 'ready') {
          if (ready) throw new Error('duplicate ready');
          ready = true; callStarted = performance.now(); arm(limits.callMs, 'TIMEOUT_CALL');
          child.send({ job }, error => { if (error) stop('ERROR_PROTOCOL'); });
        } else if (message?.event === 'result') {
          if (!ready || result) throw new Error('unexpected result');
          if (!message.record || typeof message.record.status !== 'string') throw new Error('invalid result record');
          result = message.record; returnMs = performance.now() - callStarted;
          clearTimeout(timer); clearTimeout(phaseTimer); armReap();
        } else if (message?.event === 'phase') {
          clearTimeout(phaseTimer);
          if (phaseLimits[message.name]) phaseTimer = setTimeout(() => stop('TIMEOUT_PHASE_' + message.name.toUpperCase()), phaseLimits[message.name]);
        }
      } catch (error) { spawnError = error.message; stop('ERROR_PROTOCOL'); }
    });
    child.once('close', (code, exitSignal) => finish(code, exitSignal, true));
    arm(limits.startupMs, 'TIMEOUT_STARTUP');
    if (signal?.aborted) abort();
  });
}
