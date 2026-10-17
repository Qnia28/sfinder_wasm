// Fixed capture-seed comparison isolates the refine implementation from primary.
// Only refine execution is timed; import, fixture decoding and verification are outside.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { hash, selectedVector, validateFixture } from '../secondary-bench/contracts.mjs';
const send = message => new Promise((resolve, reject) => process.send(message, error => error ? reject(error) : resolve()));
process.once('message', async ({ job }) => {
  try {
    const bytes = fs.readFileSync(job.fixturePath); assert.equal(hash(bytes), job.fixture.sha256);
    const fixture = JSON.parse(gunzipSync(bytes)); validateFixture(fixture);
    const modulePath = path.join(job.sourceRoot, 'src/min-cover-quality-refine.mjs');
    assert.equal(hash(fs.readFileSync(modulePath)), job.moduleSha256);
    const { refineMinimumCoverQuality } = await import(pathToFileURL(modulePath).href);
    selectedVector(fixture, fixture.seed);
    const prepared = { keys: fixture.keys, cases: fixture.rows };
    const start = performance.now();
    const result = refineMinimumCoverQuality(prepared, fixture.seed);
    const refineMs = performance.now() - start;
    assert.deepEqual(result.qualityVector, selectedVector(fixture, result.selected));
    await send({ event: 'result', record: { status: 'RETURNED', fixtureId: fixture.id, refineMs,
      seed: fixture.seed, result, moduleSha256: job.moduleSha256, witnessAudit: 'PASS' } });
  } catch (error) { await send({ event: 'result', record: { status: 'ERROR', error: error.stack } }); }
  finally { process.disconnect(); }
});
await send({ event: 'ready' });
