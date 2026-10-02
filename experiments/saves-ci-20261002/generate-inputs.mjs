import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIR, readJson, writeJson, hash, signature } from './common.mjs';
import { decodeAndValidate } from '../../src/pc-input.mjs';
import { popcount } from '../../src/board.mjs';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';

const [cycle1Path, qbPath] = process.argv.slice(2);
if (!cycle1Path || !qbPath) throw new Error('Usage: node generate-inputs.mjs <cycle1.json> <qb.json>');
const selection = readJson(path.join(DIR, 'design/selection.json'));
const pilot = readJson(path.join(DIR, 'design/pilot.json'));
const exposure = readJson(path.join(DIR, 'design/exposure.json'));
const original = [];
for (const [db, file] of [['cycle1', cycle1Path], ['qb', qbPath]]) {
  const bytes = fs.readFileSync(file);
  assert.equal(hash(bytes), selection.dbHashes[db], `DB drift: ${db}`);
  for (const row of JSON.parse(bytes)) {
    const { board } = decodeAndValidate(row.fumen, 4);
    let mirror = 0n, height = 0;
    const columns = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) if (board & (1n << BigInt(y * 10 + x))) {
      mirror |= 1n << BigInt(y * 10 + 9 - x); columns.push(x); height = Math.max(height, y + 1);
    }
    const occupied = popcount(board), span = Math.max(...columns) - Math.min(...columns) + 1;
    original.push({ db, id: row.id, fumen: row.fumen, raw: board.toString(16).padStart(10, '0'),
      group: (board < mirror ? board : mirror).toString(16).padStart(10, '0'), occupied,
      required: (40 - occupied) / 4, height, span, box: height === 4 && occupied === 16 && span === 4 });
  }
}
original.sort((a, b) => a.id.localeCompare(b.id));
const byId = new Map(original.map(row => [row.id, row])), byRaw = new Map();
for (const row of original) {
  if (!byRaw.has(row.raw)) byRaw.set(row.raw, { ...row, aliases: [], weight: 0 });
  const representative = byRaw.get(row.raw);
  representative.aliases.push(row.id); representative.weight++;
}
const holdoutGroups = new Set(selection.holdoutGroups);
const excluded = new Set(exposure.excludedGroups);
for (const [index, id] of selection.holdoutIds.entries()) {
  const row = byId.get(id); assert.ok(row, id);
  assert.equal(row.group, selection.holdoutGroups[index]);
  assert.ok(!excluded.has(row.group) && !row.box);
}
const development = [...byRaw.values()].filter(row => !holdoutGroups.has(row.group));
assert.equal(original.length, 401); assert.equal(byRaw.size, 299); assert.equal(development.length, 264);
for (const key of ['deepIds', 'largeIds']) {
  const groups = selection[key].map(id => { assert.ok(byId.has(id), id); return byId.get(id).group; });
  assert.equal(new Set(groups).size, groups.length);
  assert.ok(groups.every(group => !holdoutGroups.has(group)));
}
const counts = new Map(), cells = [], dedup = [], owners = new Map();
function add(stage, row, profile, pattern, wantedSave, temperature, useHold = true, conditions = ['REF', 'M']) {
  if (row.box && pattern === '*!') throw new Error(`BOX bag prohibited: ${row.id}`);
  if (!counts.has(pattern)) {
    const expanded = expandPatternCasesInternal(pattern);
    assert.ok(expanded.every(entry => entry.lastBag));
    assert.equal(new Set(expanded.map(entry => entry.queue.length)).size, 1);
    counts.set(pattern, { cases: expanded.length, length: expanded[0].queue.length });
  }
  const metadata = counts.get(pattern);
  const cell = { id: `${stage}:${row.id}:${profile}`, stage, profile, setupId: row.id, sourceFumen: row.fumen,
    raw: row.raw, group: row.group, required: row.required, weight: byRaw.get(row.raw)?.weight ?? 1,
    pattern, wantedSave, temperature, useHold, clear: 4, singleSaveMask: true, outcomeCache: false,
    queueCount: metadata.cases, queueLength: metadata.length, conditions,
    directEligible: row.required > 0 && metadata.length === row.required + 1 };
  const key = signature([row.raw, pattern, wantedSave, temperature, useHold, conditions.includes('A6') ? 'A6' : 'B4']);
  if (owners.has(key)) { dedup.push({ id: cell.id, owner: owners.get(key) }); return; }
  owners.set(key, cell.id); cells.push(cell);
}
const fixture = boardKey => {
  const row = pilot.boards[boardKey], board = decodeAndValidate(row.fumen, 4).board;
  const found = byId.get(row.id);
  return found ?? { ...row, raw: board.toString(16).padStart(10, '0'), group: 'fixture', box: false };
};
for (const entry of pilot.b4) add('anchor', fixture(entry.board), entry.id, pilot.patterns[entry.pattern].text,
  pilot.wanted[entry.wanted], entry.temperature, entry.useHold ?? true, ['REF', 'P', 'R', 'M']);
for (const entry of pilot.a6.filter(entry => ['A601', 'A604', 'A608', 'A612'].includes(entry.id)))
  add('a6', fixture(entry.board), entry.id, pilot.patterns[entry.pattern].text, pilot.wanted[entry.wanted], entry.temperature, true, ['REF', 'A6']);
const order = 'TIJLSZO';
for (const row of development) {
  const r = row.required, tail = order[r] ?? 'I';
  add('broad', row, 'fixed1', `${order.slice(0, r)},[${tail}]p1`, 'I', 'cold');
  add('broad', row, 'prefix210', `${order.slice(0, r - 2)},*p3`, pilot.wanted.multi8, 'warm');
}
for (const [index, id] of selection.deepIds.entries()) {
  const row = byId.get(id), r = row.required;
  add('deep', row, row.box ? 'box-prefix' : 'bag', r === 4 ? '*p5' : r === 7 ? 'T,*!' : row.box ? 'TIJL,*p3' : '*!', 'ALL', 'cold', index % 2 === 0);
  add('deep', row, 'restricted', r === 4 ? '[TI]p2,[LJS]p3' : r === 7 ? '[TIL]p3,*p5' : '[TIL]p3,[JSZO]p4', pilot.wanted.multi8, 'warm', index % 2 !== 0);
  add('deep', row, 'q9', '[TLJ]!,*p6', pilot.wanted.or, 'cold');
  add('deep', row, 'q10', '[TLJ]!,*!', pilot.wanted.complex8, 'warm');
}
for (const [index, id] of selection.largeIds.entries()) {
  const row = byId.get(id); assert.equal(row.required, 6); assert.ok(!row.box);
  add('large', row, 'all', '*p3,*p4', 'ALL', 'warm', index % 2 === 0);
  add('large', row, 'multi8', '*p3,*p4', pilot.wanted.multi8, 'cold', index % 2 !== 0);
}
const shardCounts = { anchor: 1, a6: 1, broad: 8, deep: 4, large: 2 };
const stageIndices = {};
for (const cell of cells) { const n = stageIndices[cell.stage] ?? 0; cell.shard = n % shardCounts[cell.stage]; stageIndices[cell.stage] = n + 1; }
const execution = { schema: 'saves-ci-cells-v1', generatedWithoutSolver: true, shardCounts, repetitions: 2, cells, dedup,
  counts: Object.fromEntries(Object.keys(shardCounts).map(stage => [stage, { cells: cells.filter(cell => cell.stage === stage).length,
    timedRequests: cells.filter(cell => cell.stage === stage).reduce((sum, cell) => sum + cell.conditions.length * 2, 0) }])),
  sourceContract: 'variants.json source hashes + build-seal.json WASMs + gate-seal.json required before timing' };
writeJson(path.join(DIR, 'inputs/inventory.json'), { dbHashes: selection.dbHashes, original });
writeJson(path.join(DIR, 'inputs/development.json'), { boards: development });
writeJson(path.join(DIR, 'inputs/holdout.json'), { enabled: false, boards: selection.holdoutIds.map(id => byId.get(id)), groups: selection.holdoutGroups });
writeJson(path.join(DIR, 'inputs/cells.json'), execution);
const files = ['inventory', 'development', 'holdout', 'cells'].map(name => `inputs/${name}.json`);
writeJson(path.join(DIR, 'design-seal.json'), { schema: 'saves-ci-design-seal-v1', protocol: 'PLAN_KO + independent variants; no candidate performance inspected',
  files: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(DIR, file)))])),
  holdoutGroups: selection.holdoutGroups, counts: execution.counts, dedup: dedup.length });
console.log(JSON.stringify({ counts: execution.counts, dedup, totalTimedRequests: cells.reduce((sum, cell) => sum + cell.conditions.length * 2, 0) }, null, 2));
