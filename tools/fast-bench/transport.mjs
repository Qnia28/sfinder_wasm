// Fast-only transport helpers. No solver execution, no background uploads during measurement.
import assert from 'node:assert/strict';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { deliver } from '../secondary-bench/common/evidence.mjs';

// Planning/control jobs may publish independent shard payloads concurrently.
// Keep input order and await in-flight transfers even when one fails.
export async function publishPayloads(client, payloads, { concurrency = 3, now = () => performance.now() } = {}) {
  assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 3);
  for (const key of ['directory', 'receiptFile', 'name']) {
    const values = payloads.map(p => key === 'name' ? p[key] : path.resolve(p[key]));
    assert.equal(new Set(values).size, values.length, 'payload ownership must be distinct: ' + key);
  }
  const results = new Array(payloads.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, payloads.length) }, async () => {
    while (next < payloads.length) {
      const index = next++, p = payloads[index], started = now();
      const compressed = p.precompressed === true;
      const timedClient = { uploadArtifact: (name, files, root, options) =>
        client.uploadArtifact(name, files, root, { ...options, compressionLevel: compressed ? 0 : 1 }) };
      try {
        const receipt = await deliver(timedClient, p.directory, p.receiptFile, p.identity,
          { retentionDays: 30 }, p.name, p.retry === true);
        results[index] = { index, name: p.name, status: receipt.status, receipt,
          compressionLevel: compressed ? 0 : 1, transportMs: now() - started };
      } catch (error) {
        results[index] = { index, name: p.name, status: 'FAILED', error: error.message, transportMs: now() - started };
      }
    }
  }));
  return { status: results.every(r => r.status === 'UPLOADED') ? 'ALL_DURABLE' : 'UNDELIVERED', results };
}
