// Injectable worker orchestration: can be tested with fake workers, no WASM needed.
export async function collectWorker(worker, { maxWallMs, onProbe = () => {}, interrupted = () => false }) {
  const start = performance.now();
  let probeAttempted = false;
  let outcome;
  let timer;
  let resultReceived = false;
  const exited = new Promise(resolve => worker.once('exit', resolve));
  const response = new Promise(resolve => {
    const finish = value => {
      if (outcome) return;
      outcome = value;
      clearTimeout(timer);
      resolve(value);
    };
    timer = setTimeout(() => {
      finish({ status: 'TIMEOUT', partialIncumbent: null,
        partialCapture: 'unavailable-after-hard-worker-termination' });
    }, maxWallMs);
    worker.on('message', message => {
      if (outcome) return;
      if (message.event === 'probe-started') {
        probeAttempted = true;
        try { onProbe(message); } catch (error) { finish({ status: 'ERROR', message: error.message }); }
      } else if (message.event === 'result') {
        resultReceived = true;
        finish(message);
      } else if (message.event === 'error') finish({ ...message, status: 'ERROR' });
    });
    worker.on('error', error => finish({ status: 'ERROR', message: error.message }));
    worker.once('exit', code => {
      finish({ status: interrupted() ? 'ABORTED' : 'ERROR', message: `worker exited without a result (code ${code})` });
    });
  });
  const value = await response;
  const responseWallMs = performance.now() - start;
  // Do not start the next run until the previous isolate has stopped, even after a result.
  await worker.terminate();
  const exitCode = await exited;
  return { ...value, integratedProbeAttempted: probeAttempted, resultReceived,
    workerExitCode: exitCode, wallMs: responseWallMs, workerLifetimeMs: performance.now() - start };
}
