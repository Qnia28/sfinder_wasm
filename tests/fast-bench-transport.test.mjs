import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishPayloads } from '../tools/fast-bench/transport.mjs';
import { verifySnapshot } from '../tools/secondary-bench/common/evidence.mjs';

function fixtures(t, count) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-transport-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return Array.from({ length: count }, (_, i) => {
    const directory = path.join(root, 'payload-' + i);
    fs.mkdirSync(directory); fs.writeFileSync(path.join(directory, 'input.json'), JSON.stringify({ i }));
    return { name: 'payload-' + i, directory, receiptFile: path.join(root, 'receipts', i + '.json'), identity: { i } };
  });
}

test('bounded concurrent payload uploads retain input order and immutable receipts', async t => {
  const payloads = fixtures(t, 7), levels = [], gates = [];
  let active = 0, peak = 0, id = 0, entered = 0;
  const client = { uploadArtifact: async (_name, _files, root, options) => {
    active++; peak = Math.max(peak, active); levels.push(options.compressionLevel);
    verifySnapshot(root);
    entered++;
    if (entered <= 3) await new Promise(resolve => {
      gates.push(resolve);
      if (gates.length === 3) gates.splice(0).reverse().forEach(r => r());
    });
    active--;
    return { id: ++id, digest: 'a'.repeat(64) };
  } };
  payloads[0].precompressed = true;
  const result = await publishPayloads(client, payloads);
  assert.equal(result.status, 'ALL_DURABLE'); assert.equal(peak, 3); assert.equal(active, 0);
  assert.deepEqual(result.results.map(r => r.name), payloads.map(p => p.name));
  assert.equal(levels.filter(v => v === 0).length, 1);
  assert.equal(levels.filter(v => v === 1).length, 6);
  assert(result.results.every(r => r.receipt.attempts[0].artifactId > 0));
});

test('failed upload remains failed; retry uploads only failed immutable checkpoint', async t => {
  const payloads = fixtures(t, 2);
  let calls = 0;
  const client = { uploadArtifact: async name => {
    calls++;
    if (name.startsWith('payload-1') && name.endsWith('-t0')) throw new Error('transport interrupted');
    return { id: calls, digest: 'b'.repeat(64) };
  } };
  const first = await publishPayloads(client, payloads);
  assert.equal(first.status, 'UNDELIVERED');
  assert.deepEqual(first.results.map(r => r.status), ['UPLOADED', 'FAILED']);
  const second = await publishPayloads(client, payloads.map(p => ({ ...p, retry: true })));
  assert.equal(second.status, 'ALL_DURABLE'); assert.equal(calls, 3);
  assert.equal(second.results[1].receipt.attempts.length, 2);
});

test('overlapping ownership and unsafe concurrency are rejected before upload', async t => {
  const p = fixtures(t, 1)[0];
  const client = { uploadArtifact: () => { throw new Error('must not upload'); } };
  await assert.rejects(publishPayloads(client, [p, p]), /ownership/);
  await assert.rejects(publishPayloads(client, [p], { concurrency: 4 }));
});
