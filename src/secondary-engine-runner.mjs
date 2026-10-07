import { compiledCoverModule } from './exact-secondary-pool.mjs';
import { coverageUniverse, packCoverageRows } from './pc-wasm-cover-matrix.mjs';

export function prepareSecondaryEngineInput(coverage, qualityFor, count, seedKeys) {
  const { keys, keyIndex, rawCases } = coverageUniverse(coverage);
  const packed = packCoverageRows(rawCases, keyIndex, qualityFor);
  return { keys: [...keys], offsets: packed.offsets, ids: packed.ids, qualities: packed.qualities, count, seedKeys: [...seedKeys] };
}

export function startSecondaryEngine(engine, payload, { limitMs = null, signal = null } = {}) {
  if (limitMs !== null && (!Number.isFinite(limitMs) || limitMs <= 0)) throw new Error('invalid secondary time limit');
  let worker, ended = false, rejectPromise, abort, deadline;
  let termination = Promise.resolve();
  const stop = async reason => {
    if (ended) return termination;
    ended = true; clearTimeout(deadline); signal?.removeEventListener('abort', abort);
    rejectPromise?.(reason ?? new Error('secondary engine stopped'));
    termination = worker ? Promise.resolve(worker.terminate()) : Promise.resolve();
    return termination;
  };
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    abort = () => { void stop(signal.reason ?? new Error('secondary cancelled')); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    void (async () => {
      const module = engine === 'cpsat' ? null : await compiledCoverModule();
      const isNode = typeof process !== 'undefined' && !!process.versions?.node;
      const name = 'node:worker_threads', NodeWorker = isNode ? (await import(/* @vite-ignore */ name)).Worker : null;
      if (ended) return;
      worker = isNode ? new NodeWorker(new URL('./secondary-engine.worker.mjs', import.meta.url), { execArgv: [] })
        : new Worker(new URL('./secondary-engine.worker.mjs', import.meta.url), { type: 'module' });
      if (engine === 'cpsat' && limitMs !== null) deadline = setTimeout(() => { void stop(new Error('CP secondary time limit reached')); }, limitMs + 1000);
      const fail = error => { reject(error); void stop(error); };
      const receive = data => {
        if (ended || data.started) return;
        if (data.error) reject(Object.assign(new Error(data.error.message), { name: data.error.name ?? 'Error' }));
        else resolve(data.result);
        // Reclaim a finished/failed CP worker even while Rust keeps searching.
        void stop();
      };
      if (isNode) { worker.on('message', receive); worker.once('error', fail); worker.once('exit', code => { if (!ended) fail(new Error('secondary engine exited: ' + code)); }); }
      else { worker.onmessage = event => receive(event.data); worker.onerror = event => { event.preventDefault?.(); fail(new Error(event.message || 'secondary worker error')); }; worker.onmessageerror = () => fail(new Error('secondary result decode failed')); }
      // Copy only when this engine starts. CP is not initialized or transferred on easy inputs.
      const copy = { ...payload, offsets: payload.offsets.slice(), ids: payload.ids.slice(), qualities: payload.qualities.slice() };
      worker.postMessage({ engine, module, payload: copy, limitMs }, [copy.offsets.buffer, copy.ids.buffer, copy.qualities.buffer]);
    })().catch(error => { reject(error); void stop(error); });
  });
  promise.catch(() => {});
  return { promise, stop };
}

// Continue Rust when late CP times out/errors. Never replace an exact request
// with FEASIBLE or quality-only proof, and never discard ongoing Rust progress.
export async function raceSecondaryEngines({ startRust, startCp, cpAfterMs = 60000, signal = null, validate = value => value, onCpOutcome = null }) {
  let rust, cp, timer, abort, cpStarted = false, cpFailure = null, closing = false;
  let rustFailure = null, cpFinished = false;
  try {
    return await new Promise((resolve, reject) => {
      abort = () => reject(signal.reason ?? new Error('secondary cancelled'));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      const exhausted = () => { if (rustFailure && cpFinished) reject(new AggregateError([rustFailure,cpFailure], 'Both exact secondary engines failed')); };
      const cpFailed = (kind, failure) => { cpFinished=true;cpFailure=failure;onCpOutcome?.({kind,failure});exhausted(); };
      const launchCp = () => {
        if (cpStarted || closing) return;
        clearTimeout(timer); cpStarted=true;
        const failed=error=>{if(closing){onCpOutcome?.({kind:'CANCELLED_AFTER_POLICY_SETTLED'});return;}
          cpFailed(error?.message==='CP secondary time limit reached'?'TIMEOUT':'ERROR',String(error));};
        try { cp=startCp();cp.promise.then(value=>accept(value,'cpsat'),failed); } catch(error) { failed(error); }
      };
      const rustFailed = error => { rustFailure=error;void rust?.stop();launchCp();exhausted(); };
      const accept = (value, engine) => {
        try {
          if (!value?.completed) { if (engine === 'rust') throw new Error('Rust exact secondary did not complete'); cpFailure = value?.status ?? 'incomplete CP proof';
            cpFailed(['TIMEOUT','UNKNOWN','FEASIBLE','incomplete CP proof'].includes(cpFailure) ? 'INCOMPLETE' : 'INVALID',cpFailure); return; }
          if (engine === 'cpsat' && (!value.qualityComplete || !value.tieComplete)) throw new Error('CP result lacks quality/stable-ID proof');
          const result = validate(value);
          if (engine === 'cpsat') onCpOutcome?.({ kind: 'EXACT' });
          resolve({ result, engine, cpStarted, cpFailure, ...(rustFailure?{rustFailure:String(rustFailure)}:{}) });
        } catch (error) { if (engine === 'rust') rustFailed(error); else cpFailed('INVALID',String(error)); }
      };
      try { rust = startRust(); rust.promise.then(value => accept(value, 'rust'), rustFailed); }
      catch(error) { rustFailed(error); }
      if(!cpStarted)timer = setTimeout(launchCp, Math.max(0, cpAfterMs));
    });
  } finally {
    closing = true;
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    await Promise.all([rust?.stop(), cp?.stop()]);
  }
}
