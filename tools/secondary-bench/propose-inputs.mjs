// Draft only. No solver calls and no performance-dependent selection.
import assert from 'node:assert/strict';
import { readJson, writeJson, hash } from './contracts.mjs';
import { parsePattern } from '../../src/pattern.mjs';

const [auditFile, outputFile] = process.argv.slice(2);
assert(auditFile && outputFile, 'usage: propose-inputs.mjs <history-audit.json> <new-proposal.json>');
const audit = readJson(auditFile), groups = new Map();
for (const entry of audit.catalog.entries) {
  if (!entry.eligible || !entry.heights.some(h => h.clear === 4)) continue;
  if (!groups.has(entry.mirrorGroup)) groups.set(entry.mirrorGroup, []);
  groups.get(entry.mirrorGroup).push(entry);
}
const seed = 'secondary-wide-proposal-20261005';
const candidates = [...groups].filter(([, entries]) => entries.every(e => e.exposure !== 'EXPOSED'))
  .sort((a, b) => hash(seed + a[0]).localeCompare(hash(seed + b[0])));
// Reserve 20% of groups provisionally, subject to full historical audit/agreement.
const reserved = new Set(candidates.slice(0, Math.ceil(groups.size * 0.20)).map(([group]) => group));
const commands = [], inventory = [];
const permutations = (n, k) => { let count = 1; for (let i = 0; i < k; i++) count *= n - i; return count; };
for (const [mirrorGroup, entries] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
  entries.sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  const entry = entries[0], geometry = entry.heights.find(h => h.clear === 4), length = geometry.queueLength;
  const partition = reserved.has(mirrorGroup) ? 'PROPOSED_RESERVE_AUDIT_PENDING' : 'PROPOSED_DEVELOPMENT';
  const families = [
    { family: length <= 7 ? 'bag' : 'bag-plus-next-draw', pattern: length <= 7 ? (length === 7 ? '*!' : `*p${length}`) : `*!,*p${length - 7}` },
    { family: 'restricted-split', pattern: `[ILJ]p3,*p${length - 3}` },
  ];
  const annotated = families.map(f => {
    const parsed = parsePattern(f.pattern);
    assert.equal(parsed.depth, length);
    const cases = parsed.branches.reduce((sum, branch) => sum + branch.elements.reduce((product, element) => product * (element.kind === 'fixed' ? 1 : permutations(element.pieces.length, element.drawCount)), 1), 0);
    return { ...f, cases };
  });
  inventory.push({ mirrorGroup, partition, representativeId: entry.id, representativeSource: entry.source,
    aliases: entries.map(e => ({ id: e.id, source: e.source, boardHex: e.boardHex })), geometry, exposure: entry.exposure, families: annotated });
  if (partition === 'PROPOSED_DEVELOPMENT') for (const family of annotated) {
    assert(family.cases <= 1000000, 'pattern exceeds product expansion cap');
    commands.push({ id: `${entry.id}/${family.family}`, kind: 'per-save', sourceFumen: entry.fumen,
      clear: 4, pattern: family.pattern, family: family.family, mirrorGroup, useHold: true,
      exactHumanQuality: 'true', primary: 'auto', database: entry.source, expectedCases: family.cases,
      piecesNeeded: geometry.piecesNeeded, queueLength: length, savedPieceCount: 1,
      sourceAliases: entries.map(e => ({ id: e.id, source: e.source, boardHex: e.boardHex })) });
  }
}
const summary = { totalMirrorGroups: groups.size, proposedDevelopmentGroups: inventory.filter(e => e.partition === 'PROPOSED_DEVELOPMENT').length,
  proposedReserveGroups: reserved.size, reserveIsFresh: 'UNCONFIRMED', captureCommands: commands.length,
  maximumCapturedSaveMatrices: commands.length * 7, queueLengthRule: 'N+1_ONLY',
  sourceRepresentatives: Object.fromEntries([...new Set(inventory.map(e => e.representativeSource))].map(source => [source, inventory.filter(e => e.representativeSource === source).length])),
  neededPieces: Object.fromEntries([...new Set(inventory.map(e => e.geometry.piecesNeeded))].map(n => [n, inventory.filter(e => e.geometry.piecesNeeded === n).length])) };
writeJson(outputFile, { schema: 1, state: 'DRAFT', approvalRecord: null, selectionSeed: seed,
  purpose: 'information', exactHumanQuality: 'true', summary, inventory, commands,
  pending: ['Full historical exposure audit', 'Agree clear=4 main population and other heights', 'Ordinary minimals save-expression population',
    'Complete historical exposure audit', 'Freeze measured save-filter selection separately from saved-piece count',
    'Remote Linux preflight and campaign source/input locks'] });
console.log(JSON.stringify(summary, null, 2));
