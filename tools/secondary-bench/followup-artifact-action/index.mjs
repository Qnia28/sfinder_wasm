import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { filesUnder } from '../plan-wave.mjs';
import { readJson, writeJson } from '../contracts.mjs';
const client = (await import('../artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const mode = process.env.INPUT_MODE, directory = process.env.INPUT_PATH;
const output = (key, value) => fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
if (mode === 'upload') {
  const plan = readJson(path.join(directory, 'WAVE_PLAN.json')), receipt = []; let next = 0;
  async function upload() {
    while (next < plan.chunks) {
      const chunk = next++, root = path.resolve(directory, 'chunks', String(chunk));
      const result = await client.uploadArtifact(`followup-bundle-${plan.stage}-${chunk}`, filesUnder(root), root, { retentionDays: 30 });
      assert(result.id && /^[a-f0-9]{64}$/.test(result.digest));
      receipt.push({ chunk, artifactId: result.id, digest: 'sha256:' + result.digest });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, plan.chunks) }, upload));
  receipt.sort((a, b) => a.chunk - b.chunk);
  writeJson(path.join(directory, 'PUBLISH_RECEIPT.json'), { stage: plan.stage, artifacts: receipt });
  output('matrix', JSON.stringify({ include: receipt })); output('has_work', String(receipt.length > 0));
} else if (mode === 'download') {
  const id = Number(process.env['INPUT_ARTIFACT-ID']), digest = process.env.INPUT_DIGEST;
  assert(Number.isSafeInteger(id) && id > 0); assert(/^(sha256:)?[a-f0-9]{64}$/.test(digest));
  assert(!fs.existsSync(directory), 'download needs new directory');
  const result = await client.downloadArtifact(id, { path: path.resolve(directory),
    expectedHash: digest.startsWith('sha256:') ? digest : 'sha256:' + digest });
  assert(!result.digestMismatch, 'downloaded artifact hash mismatch');
} else throw new Error('unknown artifact operation');
