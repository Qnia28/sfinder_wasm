// Resumable archive retrieval; never starts a solver or workflow.
// node tools/fast-bench/download-results.mjs RUN_ID NEW_OR_RESUMABLE_DIR [--full]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
for (const a of wanted) {
  assert(!a.expired, 'expired artifact ' + a.id);
  assert(/^fast-[a-zA-Z0-9-]+$/.test(a.name));
  const directory = path.join(root, a.name + '-' + a.id), receipt = directory + '.receipt.json';
  if (fs.existsSync(receipt)) {
    const old = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.equal(old.artifactId, a.id); assert.equal(old.backendDigest, a.digest);
    if (fs.existsSync(path.join(directory, 'SNAPSHOT.json'))) verifySnapshot(directory);
    else assert.equal(await hashFile(directory + '.zip'), old.zipSha256);
    console.log('VERIFIED_CACHE', a.name); continue;
  }
  assert(!fs.existsSync(directory), 'unverified partial directory; inspect before resuming: ' + directory);
  const disk = fs.statfsSync(root); assert(disk.bavail * disk.bsize > a.size_in_bytes * 2 + 1024 ** 3, 'disk admission');
  const archive = directory + '.zip'; assert(!fs.existsSync(archive), 'unverified partial ZIP: ' + archive);
  const fd = fs.openSync(archive, 'wx');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('gh', ['api', `repos/${repo}/actions/artifacts/${a.id}/zip`], { stdio: ['ignore', fd, 'inherit'] });
      child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('download exit ' + code)));
    });
  } finally { fs.closeSync(fd); }
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
