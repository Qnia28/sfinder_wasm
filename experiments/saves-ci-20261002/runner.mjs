import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fork, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DIR, STAGE, ROOT, config, hash, readJson, writeJson, filesUnder, assertArtifactBudget, signature, activeDesignFile, activeCellsFile } from './common.mjs';

export function verifyDesign() {
  const seal = readJson(path.join(DIR, activeDesignFile));
  for (const [file, expected] of Object.entries(seal.files)) assert.equal(hash(fs.readFileSync(path.join(DIR, file))), expected, `Design drift: ${file}`);
  return seal;
}
export function runnerSignature() {
  return signature(Object.fromEntries(filesUnder(DIR).filter(file => file.endsWith('.mjs')).map(file => [path.relative(DIR, file).replaceAll('\\', '/'), hash(fs.readFileSync(file))])));
}
export function verifyGate() {
  verifyDesign();
  const gate = readJson(path.join(STAGE, 'GATE_SEAL.json'));
  assert.equal(gate.status, 'PASS'); assert.equal(gate.runner, runnerSignature());
  assert.equal(gate.config, hash(fs.readFileSync(path.join(DIR, 'config.json'))));
  assert.equal(gate.build, hash(fs.readFileSync(path.join(STAGE, 'BUILD_SEAL.json'))));
  assert.equal(gate.design, hash(fs.readFileSync(path.join(DIR, activeDesignFile))));
  assert.deepEqual(gate.variants, readJson(path.join(STAGE, 'variants-attached.json')));
  return gate;
}
export function environment() {
  return { node: process.version, os: `${process.platform} ${process.arch} ${os.release()}`, cpu: os.cpus()[0]?.model,
    logicalCPUs: os.cpus().length, availableParallelism: os.availableParallelism(), memory: os.totalmem(),
    imageOS: process.env.ImageOS ?? null, imageVersion: process.env.ImageVersion ?? null, runId: process.env.GITHUB_RUN_ID ?? 'local',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? 'local', job: process.env.GITHUB_JOB ?? 'local', priority: 'normal' };
}
function killOwnedChild(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 }); } catch { child.kill('SIGKILL'); }
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}
export function runUnit({ variant, cell, trace, stats = false, deadline = Infinity, onProgress = () => {} }) {
  return new Promise(resolve => {
    const child = fork(fileURLToPath(new URL('./child.mjs', import.meta.url)), [], {
      cwd: ROOT, execArgv: trace ? ['--expose-gc'] : [], detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let timer, phase = 'init', status, result, metrics, error, closed = false, stdout = '', stderr = '', timedOut = false, done = false;
    const started = performance.now();
    const arm = (next, ms) => {
      clearTimeout(timer); phase = next;
      const remaining = deadline - performance.now();
      timer = setTimeout(() => {
        timedOut = true; status = remaining < ms ? 'BUDGET_ABORT' : 'TIMEOUT';
        onProgress({ event: status, phase }); killOwnedChild(child);
      }, Math.max(1, Math.min(ms, remaining)));
    };
    const finish = code => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ status: status ?? (result && closed && code === 0 ? 'PASS' : 'CLEANUP_FAILURE'), phase,
        initializationWarmupCleanupMs: performance.now() - started - (metrics?.wallMs ?? 0),
        result, metrics, error, closed, exitCode: code, stdout: stdout || undefined, stderr: stderr || undefined });
    };
    for (const [stream, key] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', bytes => {
      if (key === 'stdout') stdout += bytes.toString(); else stderr += bytes.toString();
      if (stdout.length + stderr.length > 1024 * 1024 && !timedOut) {
        status = 'OUTPUT_LIMIT'; timedOut = true; onProgress({ event: status, phase }); killOwnedChild(child);
      }
    });
    child.on('error', value => { error = { name: value.name, message: value.message }; status = 'SPAWN_FAILURE'; killOwnedChild(child); finish(null); });
    child.on('exit', finish);
    child.on('message', message => {
      if (timedOut) return;
      if (message.kind === 'READY') {
        onProgress({ event: 'READY' });
        if (cell?.temperature === 'warm') { arm('warmup', config.warmupMs); child.send({ kind: 'WARM' }); }
        else { arm('run', trace ? config.resourceMs : config.requestMs); child.send({ kind: 'RUN' }); }
      } else if (message.kind === 'WARMED') {
        onProgress({ event: 'WARMED' }); arm('run', config.requestMs); child.send({ kind: 'RUN' });
      } else if (message.kind === 'DONE') {
        metrics = message.metrics; onProgress({ event: 'CALCULATION_DONE', metrics }); arm('serialization', config.initMs);
      } else if (message.kind === 'RESULT') { result = message.result; arm('cleanup', 5000); }
      else if (message.kind === 'CLEAN') { closed = message.closed; }
      else if (message.kind === 'ERROR') { status = 'ERROR'; error = message.error; phase = message.phase; arm('cleanup', 5000); }
    });
    arm('init', config.initMs); child.send({ kind: 'INIT', variant, cell, trace, stats });
  });
}
export function journal(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'ax');
  return { append(row) { fs.writeSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); }, close() { fs.closeSync(fd); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [stage, shardString = '0'] = process.argv.slice(2), shard = Number(shardString);
  const gate = verifyGate();
  const out = path.join(STAGE, 'artifacts', `${stage}-${shard}`), log = journal(path.join(out, 'observations.jsonl'));
  const started = performance.now(), budgetMs = stage === 'anchor' ? 9 * 60000 : stage === 'diagnostic' ? 5 * 60000 : ['a4', 'a6'].includes(stage) ? 7 * 60000 : 14 * 60000;
  const deadline = started + budgetMs;
  const env = environment(), manifest = readJson(path.join(DIR, activeCellsFile));
  const selected = stage === 'a4' ? ['T1', 'T2', 'T3', 'T4'].map(id => ({ id, conditions: ['A4_REF', 'A4'] }))
    : manifest.cells.filter(cell => cell.stage === stage && cell.shard === shard);
  if (!selected.length) throw new Error(`No units: ${stage}-${shard}`);
  log.append({ kind: 'ENVIRONMENT', env, runner: gate.runner, build: gate.build, source: gate.variants, design: hash(fs.readFileSync(path.join(DIR, activeDesignFile))) });
  const failures = [], differences = [], observations = [];
  let stop = false;
  for (const [index, cell] of selected.entries()) {
    for (let repetition = 0; repetition < 2; repetition++) {
      const order = (index + repetition) % 2 ? [...cell.conditions].reverse() : cell.conditions;
      const rows = [];
      for (const variant of order) {
        const identity = { cell: cell.id, stage, shard, variant, repetition, order };
        let observation;
        if (stop || performance.now() >= deadline - 5000) observation = { status: 'NOT_STARTED', reason: stop ? 'earlier-correctness-or-resource-failure' : 'job-internal-budget' };
        else {
          log.append({ kind: 'START', ...identity });
          observation = await runUnit({ variant, cell: stage === 'a4' ? undefined : cell, trace: stage === 'a4' ? cell.id : undefined, deadline,
            onProgress: progress => log.append({ kind: 'PROGRESS', ...identity, ...progress }) });
        }
        const row = { kind: 'OBSERVATION', ...identity, ...observation };
        log.append(row); rows.push(row); observations.push(row);
        if (observation.status !== 'PASS') failures.push({ ...identity, status: observation.status });
      }
      const successful = rows.filter(row => row.status === 'PASS');
      if (successful.length === rows.length && new Set(successful.map(row => row.result.signature)).size !== 1) {
        differences.push({ cell: cell.id, repetition, signatures: successful.map(row => ({ variant: row.variant, hash: row.result.signature })) });
        log.append({ kind: 'MISMATCH', ...differences.at(-1) }); stop = true;
      }
      if (stage === 'a4') for (const row of successful.filter(row => row.variant === 'A4')) {
        for (const snap of row.result.snapshots) {
          for (const name of ['expressionTables', 'exactExpressionPredicates', 'bagInfoCache']) if (snap.cache[name].entries > 512 || snap.cache[name].maxKeyChars > 4096) stop = true;
          if (snap.cache.memo && (snap.cache.memo.entries > 256 || snap.cache.memo.maxKeyChars > 4096)) stop = true;
        }
        if (stop) { failures.push({ cell: cell.id, status: 'RESOURCE_CONTRACT_FAILURE' }); log.append({ kind: 'RESOURCE_CONTRACT_FAILURE', cell: cell.id }); }
      }
    }
  }
  const summary = { stage, shard, env, status: failures.length || differences.length ? 'INCOMPLETE_OR_FAILED' : 'COMPLETE',
    plannedObservations: selected.reduce((sum, cell) => sum + cell.conditions.length * 2, 0), completed: observations.filter(row => row.status === 'PASS').length,
    failures, differences, elapsedMs: performance.now() - started, gate: hash(fs.readFileSync(path.join(STAGE, 'GATE_SEAL.json'))) };
  writeJson(path.join(out, 'summary.json'), summary); log.close();
  assertArtifactBudget(out);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== 'COMPLETE') process.exitCode = 1;
}
