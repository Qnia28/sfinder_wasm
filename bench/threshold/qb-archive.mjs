import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, copyFileSync, constants, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { sha256 } from './engine.mjs';
const root = resolve(process.argv[2]); assert(process.argv[2]);
function walk(dir, name) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? walk(resolve(dir, e.name), name) : e.name === name ? [resolve(dir, e.name)] : []); }
function one(dir, name) { const files = walk(resolve(root, dir), name); assert.equal(files.length, 1); return files[0]; }
const sourceManifest = one('fixtures', 'manifest.json'), manifest = JSON.parse(readFileSync(sourceManifest));
const target = resolve('bench/threshold/qb-independent100'); assert(!existsSync(target)); mkdirSync(resolve(target, 'inputs'), { recursive: true });
copyFileSync(sourceManifest, resolve(target, 'manifest.json'), constants.COPYFILE_EXCL);
for (const c of manifest.cases) copyFileSync(resolve(dirname(sourceManifest), c.file), resolve(target, c.file), constants.COPYFILE_EXCL);
const initialPath = resolve(root, 'audited/qb-review/review.json');
function compact(path) {
  const bytes = readFileSync(path), review = JSON.parse(bytes);
  return { ...review, fullReviewedArtifactSha256: sha256(bytes),
    environments: review.environments.map(e => { const { build, ...rest } = e; return { ...rest, buildObjectHash: sha256(JSON.stringify(build)) }; }),
    archiveNote: 'Repeated identical full build metadata removed from per-VM environments only. Build preserved once in qb-independent-build.json; canonical build object SHA256 retained per environment. Samples/witness hashes/statistics unchanged. Full vectors remain in audited raw artifacts.' };
}
const reports = resolve('bench/threshold/reports');
function save(name, data) { writeFileSync(resolve(reports, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); }
save('qb-independent.json', compact(initialPath));
const repeatedPath = resolve(root, 'audited/qb-recheck-review/review.json');
if (existsSync(repeatedPath)) save('qb-independent-recheck.json', compact(repeatedPath));
for (const [targetName, source] of [
  ['qb-independent-resolution.json', resolve(root, 'audited/qb-final/resolution.json')],
  ['qb-independent-audit.json', resolve(root, 'audited/local-audit.json')],
  ['qb-independent-execution.json', resolve(root, 'execution/execution.json')],
  ['qb-independent-build.json', one('build', 'build.json')],
]) copyFileSync(source, resolve(reports, targetName), constants.COPYFILE_EXCL);
copyFileSync(resolve(root, 'audited/qb-final/report.md'), resolve('bench/threshold/QB_INDEPENDENT_REPORT_KO.md'), constants.COPYFILE_EXCL);
console.log(JSON.stringify({ matrices: manifest.cases.length, fixtureRoot: target, reports,
  initialBytes: readFileSync(resolve(reports, 'qb-independent.json')).length }, null, 2));
