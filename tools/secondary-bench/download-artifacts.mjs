// Actions download-artifact v4 lists only1000 artifacts. Explicit REST pagination
// is mandatory for this checkpoint-rich campaign. Archives are checksum-verified
// and extracted with path traversal/symlink protection by Python's stdlib.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hash, writeJson } from './contracts.mjs';
const exec = promisify(execFile);
const [repository, runId, outputDir, prefix = 'secondary-results-'] = process.argv.slice(2);
assert(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)); assert(/^[0-9]+$/.test(runId));
fs.mkdirSync(outputDir, { recursive: true });
const pages = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`],
  { maxBuffer: 64 * 1024 * 1024, timeout: 120000 }));
const all = pages.flatMap(page => page.artifacts), selected = all.filter(a => a.name.startsWith(prefix));
assert.equal(new Set(all.map(a => a.id)).size, all.length); assert.equal(all.length, pages[0].total_count, 'artifact inventory changed during download; retry after wave completes');
assert(selected.every(a => !a.expired), 'needed artifact has expired');
writeJson(path.join(outputDir, 'DOWNLOAD_INDEX.json'), { repository, runId, listed: all.length, selected: selected.length,
  prefix, startedUtc: new Date().toISOString(), artifacts: selected });
const directory = path.join(outputDir, '_archives'); fs.mkdirSync(directory, { recursive: true });
const useBackend = process.env.ACTIONS_RUNTIME_TOKEN && String(process.env.GITHUB_RUN_ID) === runId;
const artifactClient = useBackend ? (await import('./artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default : null;
const completed = [], errors = []; let next = 0;
const extractor = `import pathlib,sys,zipfile,stat
root=pathlib.Path(sys.argv[2]).resolve()
root.mkdir(parents=True,exist_ok=False)
with zipfile.ZipFile(sys.argv[1]) as z:
 for i in z.infolist():
  p=(root/i.filename).resolve()
  assert p==root or root in p.parents, 'unsafe artifact member'
  assert not stat.S_ISLNK(i.external_attr>>16), 'artifact symlink forbidden'
 z.extractall(root)
`;
async function worker() {
  while (next < selected.length) {
    const artifact = selected[next++];
    try {
      assert(/^[a-zA-Z0-9_.-]+$/.test(artifact.name), 'unsafe artifact name');
      if (artifactClient) {
        const destination = path.join(outputDir, artifact.name);
        const downloaded = await artifactClient.downloadArtifact(artifact.id, { path: destination, expectedHash: artifact.digest });
        assert(!downloaded.digestMismatch, 'backend artifact digest mismatch');
        completed.push({ id: artifact.id, name: artifact.name, digest: artifact.digest, bytes: artifact.size_in_bytes, transport: 'CURRENT_RUN_BACKEND_ID' });
        continue;
      }
      const { stdout: bytes } = await exec('gh', ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`],
        { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
      assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'artifact response is not ZIP');
      if (artifact.digest) assert.equal('sha256:' + hash(bytes), artifact.digest, 'artifact digest mismatch');
      const archive = path.join(directory, `${artifact.id}.zip`); fs.writeFileSync(archive, bytes, { flag: 'wx' });
      const destination = path.join(outputDir, artifact.name);
      await exec('python', ['-c', extractor, archive, destination], { timeout: 120000 });
      completed.push({ id: artifact.id, name: artifact.name, digest: 'sha256:' + hash(bytes), bytes: bytes.length });
    } catch (error) { errors.push({ id: artifact.id, name: artifact.name, error: error.message }); }
  }
}
await Promise.all(Array.from({ length: Math.min(artifactClient ? 5 : 3, selected.length) }, worker));
writeJson(path.join(outputDir, 'DOWNLOAD_COMPLETE.json'), { runId, listed: all.length, selected: selected.length,
  downloaded: completed.length, completed, errors, finishedUtc: new Date().toISOString() });
console.log(JSON.stringify({ runId, listed: all.length, selected: selected.length, downloaded: completed.length, errors: errors.length }));
assert.equal(errors.length, 0, 'partial download is NOT valid history; retain index and retry missing archives');
