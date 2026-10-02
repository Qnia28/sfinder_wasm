import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { perSaveInputGeometry } from '../../src/per-save-minimals.mjs';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';
import { HERE, ROOT, sha, jsonSha, read, write, mirror, patterns } from './common.mjs';

const expected = {
  'cycle1.json': '58f02fe2e1f7939e127de4c7ea2886bcf45c91a797ffa0d25dc8a0e4fb262388',
  'qb.json': '3d21d8d97701af13261caea7381bf7b70e02931ce939d23b3381c6247e1dc69a',
};
const seed = 'integrated-20261002-v1';
const inventory = [];
for (const [file, hash] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(HERE, 'inputs', file));
  assert.equal(sha(bytes), hash);
  const fixtures = JSON.parse(bytes);
  assert.equal(fixtures.length, file === 'cycle1.json' ? 45 : 356);
  for (const fixture of fixtures) {
    const g = perSaveInputGeometry({ sourceFumen: fixture.fumen, targetLines: 4 });
    const reflected = mirror(g.board);
    inventory.push({ db: file, id: fixture.id, fixture, board: g.board.toString(16),
      mirrorGroup: (g.board < reflected ? g.board : reflected).toString(16), queueLength: g.expectedQueueLength,
      occupiedCells: g.occupiedCells, piecesNeeded: g.piecesNeeded });
  }
}
const qbGroups = new Map();
for (const row of inventory.filter(r => r.db === 'qb.json')) {
  if (!qbGroups.has(row.mirrorGroup)) qbGroups.set(row.mirrorGroup, []);
  qbGroups.get(row.mirrorGroup).push(row);
}
assert.equal(qbGroups.size, 238);
const ranked = [...qbGroups].map(([group, rows]) => ({ group, rows, rank: sha(`${seed}\0group\0${group}`) }))
  .sort((a, b) => a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.group.localeCompare(b.group));
const selected = inventory.filter(r => r.db === 'cycle1.json').map(row => ({ ...row, partition: 'development' }));
const cycle1Groups = new Set(selected.map(row => row.mirrorGroup));
const sampledGroups = [...ranked.slice(0, 64), ...ranked.slice(64).filter(group => !cycle1Groups.has(group.group)).slice(0, 16)];
assert.equal(sampledGroups.length, 80);
sampledGroups.forEach((group, i) => {
  const row = [...group.rows].sort((a, b) => {
    const ar = sha(`${seed}\0representative\0${a.id}`), br = sha(`${seed}\0representative\0${b.id}`);
    return ar < br ? -1 : ar > br ? 1 : 0;
  })[0];
  selected.push({ ...row, partition: i < 64 ? 'development' : 'reserved-validation',
    samplePosition: i + 1, samplingGroupRank: group.rank, groupAliases: group.rows.map(r => r.id).sort() });
});
const developmentGroups = new Set(selected.filter(r => r.partition === 'development').map(r => r.mirrorGroup));
for (const row of selected) row.overlapsDevelopmentGeometry = row.partition !== 'development' && developmentGroups.has(row.mirrorGroup);
const taskMap = new Map();
for (const row of selected) {
  const key = `${row.partition}:${row.board}`;
  if (!taskMap.has(key)) taskMap.set(key, { partition: row.partition, board: row.board, mirrorGroup: row.mirrorGroup,
    queueLength: row.queueLength, occupiedCells: row.occupiedCells, piecesNeeded: row.piecesNeeded,
    fixture: row.fixture, aliases: [], overlapDevelopmentGeometry: row.overlapsDevelopmentGeometry });
  taskMap.get(key).aliases.push({ db: row.db, id: row.id, samplePosition: row.samplePosition ?? null });
}
const tasks = [...taskMap.values()].sort((a, b) => `${a.partition}:${a.board}`.localeCompare(`${b.partition}:${b.board}`));
tasks.forEach((task, i) => {
  task.taskId = `board-${String(i + 1).padStart(3, '0')}`;
  task.shard = i % 16;
  const box = task.aliases.some(a => ['cycle1-pcinfo-015', 'cycle1-pcinfo-020'].includes(a.id));
  task.families = patterns(task.queueLength, box).map(family => ({ ...family,
    queueCases: expandPatternCasesInternal(family.pattern).length }));
});
const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', 'c0cb2a048e7275bfea587d176b1954efff0a8a08', '--', 'src', 'rust', 'wasm', 'package.json', 'package-lock.json'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
const sources = tracked.map(file => ({ file, sha256: sha(execFileSync('git', ['show', `c0cb2a048e7275bfea587d176b1954efff0a8a08:${file}`], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 })) }));
const manifest = { schema: 'integrated-primary-capture-v1', baselineCommit: 'c0cb2a048e7275bfea587d176b1954efff0a8a08',
  databases: expected, seed, sampling: '64 hash-ranked development mirror groups; 16 subsequent groups excluding cycle1/development geometry; independent hash-ranked representative',
  cycle1Records: 45, qbDevelopmentGroups: 64, qbReservedGroups: 16, qbPopulationMirrorGroups: 238,
  selectedRecords: selected.map(({ fixture, ...row }) => row), tasks, sources,
  taskCount: tasks.length, shardCount: 16, enumerationTimeoutMs: 180000, primaryTimeoutMs: 90000,
  primary: { requested: 'auto', ortoolsAvailable: false, runtime: 'Node24.13.0 without JSPI flag; auto routes wide kernels to HiGHS',
    proof: 'standard', highsTimeLimitSeconds: 60, highsThreads: 1 },
  ordinaryAndSevenPerSave: true, secondaryAllowed: false, secondaryMeasurements: 0,
  freshHoldoutCertified: false, reservedPolicy: 'No secondary access. Historical exposure must be audited before calling this fresh holdout.',
  expectedClassifications: tasks.reduce((n, task) => n + task.families.length * 8, 0),
};
write(path.join(HERE, 'selection.json'), manifest);
write(path.join(HERE, 'inventory.json'), inventory.map(({ fixture, ...row }) => row));
console.log(JSON.stringify({ tasks: tasks.length, selectedRecords: selected.length, qbDevelopment: 64, qbReserved: 16,
  expectedClassifications: manifest.expectedClassifications, manifestSha256: jsonSha(manifest), secondaryExecuted: false }));
