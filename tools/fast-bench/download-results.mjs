// Resumable archive retrieval; never starts a solver or workflow.
// node tools/fast-bench/download-results.mjs RUN_ID NEW_OR_RESUMABLE_DIR [--full]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { verifySnapshot } from '../secondary-bench/common/evidence.mjs';
const [runId, destination, mode] = process.argv.slice(2);
assert(/^\d+$/.test(runId) && destination && (!mode || mode === '--full'));
const repo = 'Qnia28/sfinder_wasm', root = path.resolve(destination);
fs.mkdirSync(root, { recursive: true });
const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
  `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`], { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 }));
const artifacts = pages.flatMap(p => p.artifacts).filter(a => a.name.startsWith('fast-'));
const inventory = path.join(root, 'ARTIFACTS-' + runId + '.json');
if (!fs.existsSync(inventory)) fs.writeFileSync(inventory, JSON.stringify({ repo, runId, artifacts }, null, 2), { flag: 'wx' });
const wanted = mode === '--full' ? artifacts : artifacts.filter(a => ['fast-analysis-index', 'fast-bootstrap', 'fast-measurement-plan'].includes(a.name)
  || /^fast-(capture|measure)-summary-/.test(a.name));
assert(wanted.length, 'no matching artifacts');
const hashFile = async file => {
  const h = createHash('sha256'); for await (const bytes of fs.createReadStream(file)) h.update(bytes); return h.digest('hex');
};
const workers = Number(process.env.FAST_DOWNLOAD_WORKERS ?? 1);
assert(Number.isInteger(workers) && workers >= 1 && workers <= 4, 'download workers must be 1..4');
async function preserve(a) {
  assert(!a.expired, 'expired artifact ' + a.id);
  assert(/^fast-[a-zA-Z0-9-]+$/.test(a.name));
  const directory = path.join(root, a.name + '-' + a.id), receipt = directory + '.receipt.json';
  if (fs.existsSync(receipt)) {
    const old = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.equal(old.artifactId, a.id); assert.equal(old.backendDigest, a.digest);
    if (fs.existsSync(path.join(directory, 'SNAPSHOT.json'))) verifySnapshot(directory);
    else assert.equal(await hashFile(directory + '.zip'), old.zipSha256);
    console.log('VERIFIED_CACHE', a.name); return;
  }
  assert(!fs.existsSync(directory), 'unverified partial directory; inspect before resuming: ' + directory);
  const disk = fs.statfsSync(root); assert(disk.bavail * disk.bsize > a.size_in_bytes * 2 + 1024 ** 3, 'disk admission');
  const archive = directory + '.zip';
  const quarantine = reason => {
    const retained = archive + '.incomplete-' + Date.now();
    fs.renameSync(archive, retained);
    fs.appendFileSync(path.join(root, 'TRANSPORT_ERRORS.jsonl'), JSON.stringify({ artifactId: a.id, reason, retained }) + '\n');
  };
  if (fs.existsSync(archive) && 'sha256:' + await hashFile(archive) !== a.digest) quarantine('previous incomplete download');
  for (let attempt = 0; !fs.existsSync(archive) && attempt < 6; attempt++) {
    const fd = fs.openSync(archive, 'wx');
    let failure;
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('gh', ['api', `repos/${repo}/actions/artifacts/${a.id}/zip`], { stdio: ['ignore', fd, 'inherit'], timeout: 180000 });
        child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('download exit ' + code)));
      });
    } catch (error) { failure = error; }
    finally { fs.closeSync(fd); }
    if (failure) {
      quarantine(failure.message);
      if (attempt === 5) throw failure;
      // Transport retries only: preserve each failed archive and back off so
      // a transient TLS/network outage does not trigger immediate repeat calls.
      const waitMs = Math.min(120000, 10000 * 2 ** attempt);
      console.log('TRANSPORT_RETRY', a.id, 'waitMs', waitMs);
      await delay(waitMs);
    }
  }
  const sha = await hashFile(archive);
  assert.equal('sha256:' + sha, a.digest, 'backend ZIP digest mismatch');
  execFileSync('python', [fileURLToPath(new URL('../secondary-bench/followup-extract.py', import.meta.url)),
    archive, directory, String(1024 ** 3)], { stdio: 'inherit' });
  const sealed = fs.existsSync(path.join(directory, 'SNAPSHOT.json'));
  if (sealed) verifySnapshot(directory);
  fs.writeFileSync(receipt, JSON.stringify({ artifactId: a.id, backendDigest: a.digest, zipSha256: sha,
    sealed, repository: repo, runId }, null, 2), { flag: 'wx' });
  if (sealed) fs.unlinkSync(archive);
  console.log('PRESERVED', a.name, a.id);
}
let next = 0, failure;
await Promise.all(Array.from({ length: workers }, async () => {
  while (!failure && next < wanted.length) {
    const artifact = wanted[next++];
    try { await preserve(artifact); } catch (error) { failure ??= error; }
  }
}));
if (failure) throw failure;
console.log('COLLECTION_COMPLETE', runId, wanted.length);
