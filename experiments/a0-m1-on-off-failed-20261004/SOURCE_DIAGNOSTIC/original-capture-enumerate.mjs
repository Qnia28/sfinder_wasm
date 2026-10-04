import fs from 'node:fs';
import path from 'node:path';
import { perSaveInputGeometry } from '../../src/per-save-minimals.mjs';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';
import { createWasmSolver } from '../../src/wasm-backend.mjs';
import { compactGeometry } from '../../src/compact-geometry.mjs';
import { createNumericCoverage } from '../../src/numeric-cover-data.mjs';
import { prepareQueuePieceCounts, unusedPiecePrepared } from '../../src/saves.mjs';
import { TETRIS_DISPLAY_ORDER } from '../../src/piece-order.mjs';
import { HERE, read, write, compressedWrite, primaryOnly, validateRows } from './common.mjs';

const [taskId, output] = process.argv.slice(2);
const manifest = read(path.join(HERE, 'selection.json'));
const task = manifest.tasks.find(row => row.taskId === taskId);
if (!task) throw new Error('Unknown task');
const event = (phase, fields = {}) => console.log(JSON.stringify({ phase, taskId, ...fields }));
let solver;
try {
  const g = perSaveInputGeometry({ sourceFumen: task.fixture.fumen, targetLines: 4 });
  if (g.board.toString(16) !== task.board || g.expectedQueueLength !== task.queueLength) throw new Error('Geometry drift');
  const groups = task.families.map(family => ({ ...family, cases: expandPatternCasesInternal(family.pattern).map((row, localId) => ({
    caseId: `${family.id}:${localId}`, sourceCaseId: row.caseId, queue: row.queue,
  })) }));
  for (const group of groups) {
    if (group.cases.length !== group.queueCases || group.cases.some(row => row.queue.length !== task.queueLength)) throw new Error('Queue contract drift');
  }
  const cases = groups.flatMap(group => group.cases);
  event('solver-init', { queues: cases.length });
  solver = await createWasmSolver(4);
  const audit = primaryOnly(solver);
  event('enumeration');
  const compact = solver.enumeratePcPatternCompact(g.board, cases.map(row => row.queue), true);
  if (!compact) throw new Error('Compact enumeration unavailable');
  event('enumeration-complete', { candidates: compact.count, edges: compact.caseIds.length });
  const geometry = compactGeometry(compact);
  const order = geometry.keys.map((_, i) => i).sort((a, b) => geometry.keys[a] < geometry.keys[b] ? -1 : geometry.keys[a] > geometry.keys[b] ? 1 : 0);
  const keys = order.map(i => geometry.keys[i]);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate geometry candidate');
  const stable = new Uint32Array(order.length);
  order.forEach((id, rank) => { stable[id] = rank; });
  const counts = cases.map(row => prepareQueuePieceCounts(row.queue));
  const pieceIndex = new Map([...TETRIS_DISPLAY_ORDER].map((piece, i) => [piece, i + 1]));
  const scopes = ['ordinary', ...TETRIS_DISPLAY_ORDER];
  const rows = scopes.map(() => Array.from({ length: cases.length }, () => null));
  for (let solution = 0; solution < compact.count; solution++) {
    const usage = geometry.usage(solution);
    for (let edge = compact.offsets[solution]; edge < compact.offsets[solution + 1]; edge++) {
      const ci = compact.caseIds[edge];
      if (ci >= cases.length) throw new Error('Invalid compact case ID');
      const pi = pieceIndex.get(unusedPiecePrepared(counts[ci], usage));
      if (pi === undefined) throw new Error('Unexpected saved piece');
      const pair = [stable[solution], compact.qualities[edge]];
      (rows[0][ci] ??= []).push(pair);
      (rows[pi][ci] ??= []).push(pair);
    }
  }
  const records = [];
  let base = 0;
  for (const group of groups) {
    for (let si = 0; si < scopes.length; si++) {
      const id = `${taskId}--${group.id}--${scopes[si]}`;
      const activeRows = new Map();
      for (let local = 0; local < group.cases.length; local++) {
        const row = rows[si][base + local];
        if (row?.length) activeRows.set(local, row);
      }
      if (!activeRows.size) {
        records.push({ id, taskId, partition: task.partition, family: group.id, filter: scopes[si], status: 'INACTIVE_NO_COVERAGE', queues: group.cases.length });
        continue;
      }
      const { prepared } = createNumericCoverage(keys, activeRows, group.cases);
      const matrix = { schema: 'primary-only-matrix-v1', id, taskId, partition: task.partition,
        fixture: { id: task.fixture.id, fumen: task.fixture.fumen, displayName: task.fixture.displayName },
        aliases: task.aliases, board: task.board, mirrorGroup: task.mirrorGroup,
        family: group.id, pattern: group.pattern, filter: scopes[si],
        geometry: { targetLines: 4, occupiedCells: task.occupiedCells, piecesNeeded: task.piecesNeeded, expectedQueueLength: task.queueLength },
        queueCases: group.cases.length, keys: prepared.keys, rows: prepared.cases,
        cases: [...activeRows.keys()].map(ci => group.cases[ci]), secondaryExecuted: false };
      validateRows(matrix);
      const file = `raw/${task.partition}/${id}.json.gz`;
      const seal = compressedWrite(path.join(output, file), matrix);
      records.push({ id, taskId, partition: task.partition, family: group.id, filter: scopes[si], status: 'RAW_READY',
        file, sha256: seal.sha256, jsonSha256: seal.jsonSha256, bytes: seal.bytes,
        rows: matrix.rows.length, candidates: matrix.keys.length, entries: prepared.entryCount });
    }
    base += group.cases.length;
  }
  solver.close(); solver = null;
  write(path.join(output, 'enumeration', `${taskId}.json`), { taskId, status: 'COMPLETE', records, audit,
    candidates: compact.count, coveredEdges: compact.caseIds.length, secondaryExecuted: false });
  event('complete', { classifications: records.length, secondaryCalls: audit.forbiddenCalls });
} finally { solver?.close(); }
