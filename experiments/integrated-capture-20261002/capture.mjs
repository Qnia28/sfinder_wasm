import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { HERE, ROOT, read, write, sha, jsonSha, filesUnder } from './common.mjs';

const shard = Number(process.argv[2]);
const manifest = read(path.join(HERE, 'selection.json'));
if (!Number.isInteger(shard) || shard < 0 || shard >= manifest.shardCount) throw new Error('Invalid shard');
const output = path.join(ROOT, '.capture', `shard-${String(shard).padStart(2, '0')}`);
if (fs.existsSync(output)) throw new Error('Refusing to overwrite an existing capture shard');
fs.mkdirSync(output, { recursive: true });
for (const row of manifest.sources) {
  if (row.file === 'wasm/pc_wasm.wasm') continue;
  if (sha(fs.readFileSync(path.join(ROOT, row.file))) !== row.sha256) throw new Error(`Source drift: ${row.file}`);
}
const build = read(path.join(ROOT, '.capture', 'build', 'BUILD.json'));
if (sha(fs.readFileSync(path.join(ROOT, 'wasm/pc_wasm.wasm'))) !== build.wasmSha256) throw new Error('WASM artifact drift');
const append = value => {
  const fd = fs.openSync(path.join(output, 'events.jsonl'), 'a');
  try { fs.writeSync(fd, JSON.stringify({ utc: new Date().toISOString(), ...value }) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
};
async function child(script, args, id, timeoutMs) {
  const log = path.join(output, 'logs', `${id}.stdout.log`), err = path.join(output, 'logs', `${id}.stderr.log`);
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.openSync(log, 'wx'), stderr = fs.openSync(err, 'wx');
  append({ type: 'start', id, script, timeoutMs });
  return await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--max-old-space-size=4096', path.join(HERE, script), ...args], {
      cwd: ROOT, stdio: ['ignore', out, stderr], detached: process.platform !== 'win32',
    });
    fs.closeSync(out); fs.closeSync(stderr);
    let timedOut = false, cleanupTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      append({ type: 'timeout', id, partialPrimaryIncumbent: null });
      try { process.platform === 'win32' ? proc.kill('SIGKILL') : process.kill(-proc.pid, 'SIGKILL'); }
      catch (error) { append({ type: 'kill-error', id, error: error.message }); }
      cleanupTimer = setTimeout(() => reject(new Error(`Unreaped child ${id}`)), 5000);
    }, timeoutMs);
    proc.once('error', error => { clearTimeout(timer); clearTimeout(cleanupTimer); reject(error); });
    proc.once('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(cleanupTimer);
      const status = timedOut ? 'TIMEOUT' : code === 0 ? 'COMPLETE' : 'ERROR';
      const result = { id, status, code, signal, stdout: path.relative(output, log), stderr: path.relative(output, err) };
      append({ type: 'terminal', ...result });
      resolve(result);
    });
  });
}
const outcomes = [];
try {
  for (const task of manifest.tasks.filter(row => row.shard === shard)) {
    const enumeration = await child('enumerate.mjs', [task.taskId, output], task.taskId, manifest.enumerationTimeoutMs);
    if (enumeration.status !== 'COMPLETE') {
      outcomes.push({ taskId: task.taskId, status: `ENUMERATION_${enumeration.status}`, enumeration });
      continue;
    }
    const index = read(path.join(output, 'enumeration', `${task.taskId}.json`));
    if (index.audit.forbiddenCalls !== 0 || index.audit.cardinalityCalls !== 0 || index.audit.kernelCalls !== 0) throw new Error('Unexpected search during enumeration');
    for (const record of index.records) {
      if (record.status === 'INACTIVE_NO_COVERAGE') { outcomes.push(record); continue; }
      if (sha(fs.readFileSync(path.join(output, record.file))) !== record.sha256) throw new Error('Raw matrix drift');
      const result = await child('primary.mjs', [record.file, output], record.id, manifest.primaryTimeoutMs);
      if (result.status === 'COMPLETE') {
        const primary = read(path.join(output, 'primary', `${record.id}.json`));
        if (primary.audit.forbiddenCalls !== 0 || primary.audit.kernelCalls !== 1) throw new Error('Primary-only guard violation');
        outcomes.push({ ...primary, rawFile: record.file, rawSha256: record.sha256 });
      } else {
        const stderrText = fs.readFileSync(path.join(output, result.stderr), 'utf8');
        outcomes.push({ ...record, status: result.status === 'TIMEOUT' ? 'PRIMARY_TIMEOUT'
          : stderrText.includes('HiGHS cardinality status:') ? 'PRIMARY_UNPROVEN' : 'PRIMARY_ERROR', execution: result });
      }
    }
    append({ type: 'board-complete', taskId: task.taskId });
  }
  write(path.join(output, 'SHARD.json'), { schema: 'integrated-capture-shard-v1', shard,
    status: outcomes.some(row => /ERROR/.test(row.status)) ? 'COMPLETE_WITH_ERRORS' : 'COMPLETE',
    selectionSha256: jsonSha(manifest), build, outcomes,
    tasks: manifest.tasks.filter(row => row.shard === shard).map(row => row.taskId),
    runtime: { node: process.version, v8: process.versions.v8, cpu: os.cpus()[0]?.model, cpus: os.cpus().length, platform: process.platform },
    secondaryExecuted: false, performanceMeasurements: false });
} catch (error) {
  write(path.join(output, 'FAILURE.json'), { status: 'FAILED', shard, message: error.stack, outcomes });
  process.exitCode = 1;
} finally {
  const files = filesUnder(output).map(file => ({ file: path.relative(output, file).replaceAll('\\', '/'),
    bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
  write(path.join(output, 'FILES.json'), { files, bytes: files.reduce((n, row) => n + row.bytes, 0) });
  console.log(JSON.stringify({ shard, outcomes: outcomes.length, statuses: outcomes.reduce((r, v) => ({ ...r, [v.status]: (r[v.status] ?? 0) + 1 }), {}), secondaryCalls: 0 }));
}
