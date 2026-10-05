// Retry immutable bytes only. No solver imports, call planning or clock resets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { filesUnder } from './plan-wave.mjs';
import { readJson, writeJson } from './contracts.mjs';

const digestFile = async filename => {
  const digest = createHash('sha256');
  for await (const bytes of fs.createReadStream(filename)) digest.update(bytes);
  return digest.digest('hex');
};
function persist(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = filename + '.pending-' + randomUUID();
  writeJson(temporary, value); fs.renameSync(temporary, filename);
}
async function snapshot(directory, name) {
  const filename = path.join(directory, 'TRANSPORT_SNAPSHOT.json');
  const files = filesUnder(directory).filter(f => f !== filename).sort();
  const entries = [];
  for (const file of files) entries.push({ file: path.relative(directory, file).replaceAll('\\', '/'),
    bytes: fs.statSync(file).size, sha256: await digestFile(file) });
  if (fs.existsSync(filename)) {
    const previous = readJson(filename); assert.equal(previous.checkpoint, name);
    assert.deepEqual(previous.files, entries, 'checkpoint bytes changed; refusing transport retry');
  } else writeJson(filename, { schema: 1, checkpoint: name, createdUtc: new Date().toISOString(), files: entries });
  return [...files, filename];
}
async function attempt(client, state, receiptFile, artifactName) {
  const files = await snapshot(state.path, state.name);
  const record = { artifactName, status: 'PENDING', startedUtc: new Date().toISOString() };
  state.attempts.push(record); state.status = 'PENDING'; persist(receiptFile, state);
  try {
    const uploaded = await client.uploadArtifact(artifactName, files, path.resolve(state.path), { retentionDays: 30 });
    assert(Number.isSafeInteger(uploaded.id) && uploaded.id > 0 && /^[a-f0-9]{64}$/.test(uploaded.digest));
    Object.assign(record, { status: 'UPLOADED', artifactId: uploaded.id, digest: 'sha256:' + uploaded.digest });
    state.status = 'UPLOADED';
  } catch (error) { record.status = 'FAILED'; record.error = error.message; state.status = 'FAILED'; }
  record.finishedUtc = new Date().toISOString(); persist(receiptFile, state);
  return state;
}
export async function checkpoint(client, directory, name, receiptFile) {
  assert(/^[a-zA-Z0-9-]+$/.test(name)); assert(!fs.existsSync(receiptFile), 'checkpoint already attempted');
  const state = { schema: 1, name, path: directory, status: 'PENDING', attempts: [] };
  persist(receiptFile, state); // Survives action timeout/kill before SDK acknowledgement.
  return attempt(client, state, receiptFile, name);
}
export async function flushCheckpoints(client, results, stateDir, prefix, { stage, chunk, parts = 3, retries = 2 } = {}) {
  const report = { schema: 1, stage, chunk: Number(chunk), status: 'PENDING', parts: [], solverCalls: 0 };
  const reportFile = path.join(stateDir, 'TRANSPORT_COMPLETE.json'); persist(reportFile, report);
  for (let part = 0; part < parts; part++) {
    const directory = path.join(results, 'part-' + part), receiptFile = path.join(stateDir, 'part-' + part + '.json');
    if (!fs.existsSync(directory)) { report.parts.push({ part, status: 'NOT_CREATED' }); persist(reportFile, report); continue; }
    let state = fs.existsSync(receiptFile) ? readJson(receiptFile)
      : { schema: 1, name: `${prefix}-${part}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`, path: directory, status: 'PENDING', attempts: [] };
    assert.equal(path.resolve(state.path), path.resolve(directory));
    for (let retry = 1; state.status !== 'UPLOADED' && retry <= retries; retry++) {
      state = await attempt(client, state, receiptFile, state.name + '-retry-' + retry);
    }
    report.parts.push({ part, status: state.status, attempts: state.attempts }); persist(reportFile, report);
  }
  report.status = report.parts.every(p => p.status === 'UPLOADED' || p.status === 'NOT_CREATED') ? 'ALL_DURABLE' : 'UNDELIVERED';
  report.finishedUtc = new Date().toISOString(); persist(reportFile, report); return report;
}
