// Evidence and transport never import an executor or solver.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { digest, sha256, readJson, writeJson, replaceJson, filesUnder, memberPath, safePath } from './contracts.mjs';
import { materializeFixture } from '../followup-storage.mjs';

async function hashFile(file) {
  const hash = createHash('sha256'); for await (const bytes of fs.createReadStream(file)) hash.update(bytes); return hash.digest('hex');
}
export async function seal(directory, identity) {
  const file = path.join(directory, 'SNAPSHOT.json');
  const members = [];
  for (const f of filesUnder(directory).filter(f => f !== file)) members.push({
    path: memberPath(directory, f), bytes: fs.statSync(f).size, sha256: await hashFile(f),
  });
  const snapshot = { schemaVersion: 1, identity, members, checkpointId: digest({ identity, members }) };
  if (fs.existsSync(file)) assert.deepEqual(readJson(file), snapshot, 'sealed checkpoint bytes changed');
  else writeJson(file, snapshot);
  return snapshot;
}
export function verifySnapshot(directory) {
  const snapshot = readJson(path.join(directory, 'SNAPSHOT.json'));
  assert.equal(snapshot.checkpointId, digest({ identity: snapshot.identity, members: snapshot.members }));
  for (const member of snapshot.members) {
    const file = safePath(directory, member.path); assert.equal(fs.statSync(file).size, member.bytes);
    assert.equal(sha256(fs.readFileSync(file)), member.sha256, 'checkpoint member changed');
  }
  assert.equal(filesUnder(directory).length, snapshot.members.length + 1, 'unindexed checkpoint file'); return snapshot;
}
export async function deliver(client, directory, receiptFile, identity, profile, name, retry = false) {
  const snapshot = await seal(directory, identity);
  let state;
  if (fs.existsSync(receiptFile)) {
    state = readJson(receiptFile); assert(retry, 'checkpoint already attempted');
    assert.equal(state.checkpointId, snapshot.checkpointId);
    if (state.status === 'UPLOADED') return state;
  } else state = { schemaVersion: 1, checkpointId: snapshot.checkpointId, identity, status: 'PENDING', attempts: [], solverCalls: 0 };
  const attempt = { transportAttemptId: digest({ checkpointId: snapshot.checkpointId, number: state.attempts.length }),
    name: name + '-t' + state.attempts.length, status: 'PENDING' };
  state.attempts.push(attempt); state.status = 'PENDING'; replaceJson(receiptFile, state);
  try {
    const result = await client.uploadArtifact(attempt.name, filesUnder(directory), path.resolve(directory), { retentionDays: profile.retentionDays });
    assert(Number.isSafeInteger(result.id) && result.id > 0 && /^[a-f0-9]{64}$/.test(result.digest), 'invalid backend receipt');
    Object.assign(attempt, { status: 'UPLOADED', artifactId: result.id, digest: 'sha256:' + result.digest }); state.status = 'UPLOADED';
    const segment = { schemaVersion: 1, checkpointId: snapshot.checkpointId, identity,
      artifactId: result.id, digest: attempt.digest, members: snapshot.members };
    writeJson(receiptFile + '.segment-' + (state.attempts.length - 1) + '.json', segment);
  } catch (error) { attempt.status = 'FAILED'; attempt.error = error.message; state.status = 'FAILED'; }
  replaceJson(receiptFile, state); return state;
}
export function deadlineClient(client, ms) {
  return { uploadArtifact: async (...args) => {
    let timer;
    try { return await Promise.race([client.uploadArtifact(...args), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('TRANSPORT_DEADLINE')), ms);
    })]); } finally { clearTimeout(timer); }
  } };
}
export function loadHistory(directory, campaignId) {
  const rows = [], starts = [], aliases = [], warnings = [], seen = new Map(), snapshots = new Map();
  for (const file of filesUnder(directory).filter(f => path.basename(f) === 'SNAPSHOT.json')) {
    snapshots.set(path.dirname(file), verifySnapshot(path.dirname(file)));
  }
  for (const file of filesUnder(directory).filter(f => ['raw.jsonl', 'starts.jsonl'].includes(path.basename(f)))) {
    const text = fs.readFileSync(file, 'utf8'), lines = text.split('\n'), snapshot = snapshots.get(path.dirname(file));
    if (!snapshot) warnings.push({ status: 'UNSEALED_EVIDENCE', file });
    for (const [i, line] of lines.entries()) {
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch (error) {
        if (i === lines.length - 1 && !text.endsWith('\n')) { warnings.push({ status: 'TORN_FINAL_APPEND', file, line: i + 1 }); continue; }
        throw error;
      }
      assert.equal(row.campaignId, campaignId, 'foreign campaign evidence');
      const key = path.basename(file) + '/' + (row.executionAttemptId ?? row.recordId);
      assert(!key.endsWith('/undefined'), 'record identity missing');
      const pointer = { file, line: i + 1, sha256: sha256(line), rawHash: sha256(text), snapshot: snapshot?.checkpointId ?? null };
      if (seen.has(key)) {
        const old = seen.get(key);
        assert(snapshot && old.snapshot === snapshot.checkpointId && old.rawHash === pointer.rawHash && old.sha256 === pointer.sha256,
          'duplicate execution record without identical transport proof');
        aliases.push({ canonical: old, alias: pointer }); continue;
      }
      seen.set(key, pointer);
      (path.basename(file) === 'raw.jsonl' ? rows : starts).push({ ...row, rawPointer: pointer });
    }
  }
  const unknown = starts.filter(s => !rows.some(r => r.executionAttemptId === s.executionAttemptId));
  return { rows, starts, unknown, aliases, warnings, checkpoints: [...snapshots].map(([directory, snapshot]) => ({ directory, ...snapshot })) };
}
export function indexHistory(directory, campaignId) {
  loadHistory(directory, campaignId);
  const members = filesUnder(directory).filter(f => path.resolve(f) !== path.resolve(directory, 'HISTORY_INDEX.json')).map(f => ({
    path: memberPath(directory, f), sha256: sha256(fs.readFileSync(f)), bytes: fs.statSync(f).size,
  }));
  const index = { schemaVersion: 1, campaignId, members };
  writeJson(path.join(directory, 'HISTORY_INDEX.json'), index); return index;
}
export function verifyHistoryIndex(directory, expectedHash, campaignId) {
  const bytes = fs.readFileSync(path.join(directory, 'HISTORY_INDEX.json')); assert.equal(sha256(bytes), expectedHash);
  const index = JSON.parse(bytes); assert.equal(index.campaignId, campaignId);
  for (const member of index.members) assert.equal(sha256(fs.readFileSync(safePath(directory, member.path))), member.sha256);
  assert.equal(filesUnder(directory).length, index.members.length + 1, 'history changed after indexing'); return index;
}
export function mergeContinuationHistory(lock, directory) {
  const c = lock.manifest.continuation; if (!c || path.resolve(c.history) === path.resolve(directory)) return;
  verifyHistoryIndex(c.history, c.historyIndexSha256, lock.manifest.campaignId);
  assert(!path.resolve(directory).startsWith(path.resolve(c.history) + path.sep), 'cannot append inside immutable parent history');
  for (const file of filesUnder(c.history)) {
    const destination = safePath(directory, '_parent-' + c.historyIndexSha256 + '/' + memberPath(c.history, file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) assert.equal(sha256(fs.readFileSync(destination)), sha256(fs.readFileSync(file)), 'parent copy changed');
    else materializeFixture(file, destination, { size: fs.statSync(file).size, bytes: () => fs.readFileSync(file) });
  }
}
// Reserve every previously scheduled slot, including NOT_RUN and unknowns.
// Callers may retain parent evidence separately when a changed harness epoch
// is an intentional new measurement rather than a replay/reclassification.
export function historyReservation(manifest) {
  const c=manifest.continuation;
  if(!c)return {calls:0,unknown:[],warnings:[],statuses:{}};
  verifyHistoryIndex(c.history,c.historyIndexSha256,manifest.campaignId);
  const history=loadHistory(c.history,manifest.campaignId),ids=new Set();
  for(const file of filesUnder(c.history).filter(f=>path.basename(f)==='STAGE_PLAN.json'))
    for(const call of readJson(file).expectedCalls)ids.add(call.logicalCallId??call.callId);
  for(const row of [...history.rows,...history.starts])ids.add(row.logicalCallId??row.callId);
  assert(!ids.has(undefined),'unidentified parent execution');
  const statuses={};for(const r of history.rows)statuses[r.status]=(statuses[r.status]??0)+1;
  return {calls:ids.size,unknown:history.unknown,warnings:history.warnings,statuses};
}
export function readLegacy(directory) {
  // Read-only: retain raw bytes and legacy hash rules rather than reidentify calls.
  const rows = [];
  for (const file of filesUnder(directory).filter(f => path.basename(f) === 'raw.jsonl')) {
    const bytes = fs.readFileSync(file), lines = bytes.toString('utf8').split(/\r?\n/);
    for (const [i, line] of lines.entries()) if (line) {
      const record = JSON.parse(line);
      rows.push({ format: 'legacy-jsonl', record, original: { file, line: i + 1, rawHash: sha256(bytes), lineHash: sha256(line),
        callId: record.callId, sourceLock: record.sourceLock } });
    }
  }
  return rows;
}
