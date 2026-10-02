import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, ROOT, read, write, sha, jsonSha, compressedRead, validateSeed, matrixIdentity } from './common.mjs';
const downloads = path.resolve(process.argv[2] ?? path.join(ROOT, '.capture/downloads'));
const output = path.resolve(process.argv[3] ?? path.join(ROOT, '.capture/summary'));
const selection = read(path.join(HERE, 'selection.json'));
function shardDirectory(i) {
  const artifact = path.join(downloads, `capture-shard-${i}`);
  return fs.existsSync(path.join(artifact, 'SHARD.json')) ? artifact
    : path.join(artifact, `shard-${String(i).padStart(2, '0')}`);
}
const shards = [];
const missing = [], errors = [], matrices = [], statuses = {};
const catalog = new Map();
const classificationIDs = new Set();
for (let i = 0; i < selection.shardCount; i++) {
  const dir = shardDirectory(i);
  if (!fs.existsSync(path.join(dir, 'SHARD.json'))) { missing.push(i); continue; }
  const seal = read(path.join(dir, 'FILES.json'));
  const sealedFiles = new Set(seal.files.map(row => row.file));
  assert.equal(sealedFiles.size, seal.files.length, 'Duplicate sealed file');
  assert(sealedFiles.has('SHARD.json'), 'Unsealed shard index');
  for (const row of seal.files) {
    const file = path.join(dir, row.file);
    assert.equal(fs.statSync(file).size, row.bytes);
    assert.equal(sha(fs.readFileSync(file)), row.sha256, row.file);
  }
  const shard = read(path.join(dir, 'SHARD.json'));
  assert.equal(shard.shard, i);
  assert.equal(shard.selectionSha256, jsonSha(selection));
  assert.equal(shard.build.selectionSha256, jsonSha(selection));
  assert.equal(shard.secondaryExecuted, false);
  assert.equal(shard.performanceMeasurements, false);
  assert.deepEqual(shard.tasks, selection.tasks.filter(row => row.shard === i).map(row => row.taskId));
  shards.push(shard);
  const expectedIDs = new Set(selection.tasks.filter(task => task.shard === i).flatMap(task =>
    task.families.flatMap(family => ['ordinary', 'I', 'J', 'L', 'O', 'S', 'T', 'Z'].map(scope => `${task.taskId}--${family.id}--${scope}`))));
  for (const row of shard.outcomes) {
    if (row.id) {
      assert(expectedIDs.has(row.id), `Foreign classification: ${row.id}`);
      assert(!classificationIDs.has(row.id), `Duplicate classification: ${row.id}`);
      classificationIDs.add(row.id);
    }
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    if (/ERROR/.test(row.status)) errors.push(row.id ?? row.taskId);
    if (row.status !== 'PRIMARY_EXACT') continue;
    assert(sealedFiles.has(row.file), `Unsealed matrix: ${row.file}`);
    assert.equal(sha(fs.readFileSync(path.join(dir, row.file))), row.sha256);
    const matrix = compressedRead(path.join(dir, row.file));
    assert.equal(matrix.id, row.id);
    assert.equal(matrix.partition, row.partition);
    const task = selection.tasks.find(task => task.taskId === matrix.taskId);
    assert(task && task.shard === i, 'Wrong matrix task/shard');
    for (const key of ['partition', 'board', 'mirrorGroup', 'aliases']) assert.deepEqual(matrix[key], task[key]);
    validateSeed(matrix);
    assert.equal(matrix.identitySha256, matrixIdentity(matrix));
    assert.equal(matrix.identitySha256, row.identitySha256);
    assert.equal(matrix.primaryOnlyAudit.forbiddenCalls, 0);
    assert.equal(matrix.secondaryExecuted, false);
    const entry = { id: row.id, shard: i, file: path.relative(downloads, path.join(dir, row.file)).replaceAll('\\', '/'), sha256: row.sha256,
      identitySha256: row.identitySha256, partition: row.partition, board: matrix.board, mirrorGroup: matrix.mirrorGroup,
      family: matrix.family, filter: matrix.filter, K: row.K, rows: row.rows, candidates: row.candidates, entries: row.entries,
      classification: row.classification, aliases: matrix.aliases };
    matrices.push(entry);
    if (!catalog.has(row.identitySha256)) catalog.set(row.identitySha256, []);
    catalog.get(row.identitySha256).push(entry);
  }
}
const classificationCount = classificationIDs.size;
const routes = {}, partitions = {}, families = {}, filters = {}, backends = {};
for (const shard of shards) for (const row of shard.outcomes.filter(row => row.status === 'PRIMARY_EXACT')) {
  for (const [map, key] of [[routes, row.classification.productRoute], [partitions, row.partition], [families, row.family], [filters, row.filter], [backends, row.primary.backend]]) map[key] = (map[key] ?? 0) + 1;
}
const incomplete = selection.expectedClassifications - classificationCount;
const status = missing.length || errors.length || incomplete ? 'INCOMPLETE' : Object.keys(statuses).some(key => /TIMEOUT|UNPROVEN/.test(key)) ? 'COMPLETE_WITH_UNPROVEN_INPUTS' : 'PASS';
const report = { schema: 'integrated-capture-summary-v1', status, selectionSha256: jsonSha(selection),
  baselineCommit: selection.baselineCommit, databaseHashes: selection.databases, selectedRecords: selection.selectedRecords.length,
  cycle1Records: 45, qbDevelopmentGroups: 64, qbReservedGroups: 16, geometryTasks: selection.taskCount,
  expectedClassifications: selection.expectedClassifications, classificationCount, incomplete, missingShards: missing, errors,
  statuses, primaryExactMatrices: matrices.length, strictUniqueMatrices: catalog.size,
  originalRows: matrices.reduce((n, row) => n + row.rows, 0), qualityEdges: matrices.reduce((n, row) => n + row.entries, 0),
  routes, partitions, families, filters, backends, secondaryCalls: 0, performanceMeasurements: 0,
  freshHoldoutCertified: false, reservedValidationNotSecondaryTested: true,
  wasmHashes: [...new Set(shards.map(shard => shard.build.wasmSha256))],
  archiveBytes: shards.reduce((n, shard) => {
    const dir = shardDirectory(shard.shard);
    return n + read(path.join(dir, 'FILES.json')).bytes;
  }, 0),
};
assert(report.wasmHashes.length <= 1, 'Mixed binaries');
write(path.join(output, 'SUMMARY.json'), report);
write(path.join(output, 'MATRIX_INDEX.json'), { matrices });
write(path.join(output, 'DEDUP_INDEX.json'), { rule: 'ordered keys/rows/K/seedKeys; reserved/development aliases retained',
  groups: [...catalog].map(([identitySha256, aliases]) => ({ identitySha256, aliases: aliases.map(row => ({ id: row.id, partition: row.partition, file: row.file })) })) });
console.log(JSON.stringify(report, null, 2));
if (status === 'INCOMPLETE') process.exitCode = 1;
