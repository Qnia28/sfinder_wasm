// Synthetic artifact packaging only. Never imports or invokes a solver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { HERE, read, write, compressedWrite, sha, jsonSha, matrixIdentity } from './common.mjs';

test('nested wildcard artifact layout is independently aggregated without losing inputs', () => {
  const temporary = process.env.RUNNER_TEMP ?? path.join(os.tmpdir(), 'opencode');
  fs.mkdirSync(temporary, { recursive: true });
  const root = fs.mkdtempSync(path.join(temporary, 'capture-layout-fixture-'));
  const selection = read(path.join(HERE, 'selection.json'));
  try {
    for (let shard = 0; shard < 16; shard++) {
      const folder = path.join(root, 'downloads', `capture-shard-${shard}`, `shard-${String(shard).padStart(2, '0')}`);
      const tasks = selection.tasks.filter(row => row.shard === shard);
      const outcomes = [];
      const seals = [];
      for (const task of tasks) for (const family of task.families) for (const scope of ['ordinary', 'I', 'J', 'L', 'O', 'S', 'T', 'Z']) {
        const id = `${task.taskId}--${family.id}--${scope}`;
        if (!['ordinary', 'I'].includes(scope)) { outcomes.push({ id, status: 'INACTIVE_NO_COVERAGE' }); continue; }
        const value = { id, taskId: task.taskId, keys: ['a'], rows: [[[0, 2]]], cases: [{ caseId: '0' }], K: 1, seedKeys: ['a'],
          partition: task.partition, board: task.board, mirrorGroup: task.mirrorGroup, family: family.id, filter: scope,
          aliases: task.aliases, primary: { cardinalityProven: true }, primaryOnlyAudit: { forbiddenCalls: 0 }, secondaryExecuted: false };
        value.identitySha256 = matrixIdentity(value);
        const file = `matrices/${id}.json.gz`;
        const seal = compressedWrite(path.join(folder, file), value);
        seals.push({ file, bytes: seal.bytes, sha256: seal.sha256 });
        outcomes.push({ id, status: 'PRIMARY_EXACT', file, identitySha256: value.identitySha256, partition: task.partition,
          K: 1, rows: 1, candidates: 1, entries: 1, sha256: seal.sha256,
          classification: { productRoute: 'TINY_LEGACY_EXACT' }, family: family.id, filter: scope, primary: { backend: 'kernel' } });
      }
      write(path.join(folder, 'SHARD.json'), { shard, tasks: tasks.map(row => row.taskId), outcomes,
        selectionSha256: jsonSha(selection), build: { selectionSha256: jsonSha(selection), wasmSha256: 'synthetic-no-wasm' },
        secondaryExecuted: false, performanceMeasurements: false });
      const file = path.join(folder, 'SHARD.json');
      seals.push({ file: 'SHARD.json', bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) });
      write(path.join(folder, 'FILES.json'), { files: seals, bytes: seals.reduce((n, row) => n + row.bytes, 0) });
    }
    execFileSync(process.execPath, [path.join(HERE, 'aggregate.mjs'), path.join(root, 'downloads'), path.join(root, 'summary')]);
    const result = read(path.join(root, 'summary', 'SUMMARY.json'));
    assert.equal(result.status, 'PASS');
    assert.equal(result.classificationCount, selection.expectedClassifications);
    const index = read(path.join(root, 'summary', 'MATRIX_INDEX.json'));
    assert(index.matrices.every(row => fs.existsSync(path.join(root, 'downloads', row.file))));
    const folder = path.join(root, 'downloads', 'capture-shard-0', 'shard-00');
    const original = read(path.join(folder, 'SHARD.json'));
    const originalSeal = read(path.join(folder, 'FILES.json'));
    function replaceShard(value) {
      fs.writeFileSync(path.join(folder, 'SHARD.json'), JSON.stringify(value));
      const bytes = fs.readFileSync(path.join(folder, 'SHARD.json'));
      const seal = structuredClone(originalSeal);
      Object.assign(seal.files.find(row => row.file === 'SHARD.json'), { bytes: bytes.length, sha256: sha(bytes) });
      fs.writeFileSync(path.join(folder, 'FILES.json'), JSON.stringify(seal));
    }
    const duplicate = structuredClone(original);
    duplicate.outcomes.push(duplicate.outcomes[0]);
    replaceShard(duplicate);
    assert.throws(() => execFileSync(process.execPath, [path.join(HERE, 'aggregate.mjs'), path.join(root, 'downloads'), path.join(root, 'duplicate')], { stdio: 'pipe' }), /Duplicate classification/);
    const foreign = structuredClone(original);
    foreign.outcomes[0].id = 'unknown-foreign-id';
    replaceShard(foreign);
    assert.throws(() => execFileSync(process.execPath, [path.join(HERE, 'aggregate.mjs'), path.join(root, 'downloads'), path.join(root, 'foreign')], { stdio: 'pipe' }), /Foreign classification/);
  } finally {
    // This test owns this exact freshly-created synthetic temporary tree.
    fs.rmSync(root, { recursive: true });
  }
});
