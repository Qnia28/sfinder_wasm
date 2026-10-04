// Offline field audit only. No PC enumeration, primary or secondary search.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoder } from 'tetris-fumen';
import { popcount, scanFumenField } from '../../src/board.mjs';
import { hash, readJson, writeJson } from './contracts.mjs';

export function mirrorBoard(board, height = 6) {
  let mirrored = 0n;
  for (let y = 0; y < height; y++) for (let x = 0; x < 10; x++) {
    if (board & (1n << BigInt(y * 10 + x))) mirrored |= 1n << BigInt(y * 10 + 9 - x);
  }
  return mirrored;
}
export const groupFor = board => {
  const mirrored = mirrorBoard(board);
  return (board < mirrored ? board : mirrored).toString(16);
};
export function auditDatabases(directory) {
  if (directory instanceof URL) directory = fileURLToPath(directory);
  const sources = [], entries = [], seenIds = new Set();
  for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.json')).sort()) {
    const bytes = fs.readFileSync(path.join(directory, name)), data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    if (!Array.isArray(data)) throw new Error('DB must contain an array: ' + name);
    sources.push({ file: name, sha256: hash(bytes), records: data.length });
    for (const raw of data) {
      if (typeof raw.id !== 'string' || typeof raw.fumen !== 'string' || seenIds.has(raw.id)) throw new Error('invalid/duplicate DB ID');
      seenIds.add(raw.id);
      const record = { source: name, ...raw, exposure: 'UNKNOWN', selection: 'UNDECIDED' };
      try {
        const pages = decoder.decode(raw.fumen), page = pages[0];
        if (!page) throw new Error('empty fumen');
        const field = page.field, { board, highest } = scanFumenField(field, 6);
        const garbage = Array.from({ length: 10 }, (_, x) => field.at(x, -1)).some(v => v !== '_');
        const occupied = popcount(board), heights = [];
        for (let clear = 2; clear <= 6; clear++) {
          const remaining = clear * 10 - occupied;
          if (highest < clear && remaining > 0 && remaining % 4 === 0) heights.push({ clear, piecesNeeded: remaining / 4, queueLength: remaining / 4 + 1 });
        }
        Object.assign(record, { pages: pages.length, hasOperation: Boolean(page.operation), garbage,
          boardHex: board.toString(16), mirrorGroup: groupFor(board), height: highest + 1, occupied, heights,
          eligible: highest < 6 && !garbage && pages.length === 1 && !page.operation && heights.length > 0,
          exclusion: highest >= 6 ? 'BOARD_ABOVE_6' : garbage ? 'GARBAGE_FIELD' : pages.length !== 1 ? 'MULTIPAGE_REVIEW' : page.operation ? 'OPERATION_REVIEW' : !heights.length ? 'NO_VALID_CLEAR' : null });
      } catch (error) { Object.assign(record, { eligible: false, exclusion: 'DECODE_ERROR', error: error.message }); }
      entries.push(record);
    }
  }
  const countBy = key => Object.fromEntries([...new Set(entries.map(e => e[key]))].map(k => [k, entries.filter(e => e[key] === k).length]));
  return { schema: 1, kind: 'OFFLINE_GEOMETRY_ONLY', sources, entries,
    summary: { records: entries.length, fumenStrings: new Set(entries.map(e => e.fumen)).size,
      boards: new Set(entries.filter(e => e.boardHex).map(e => e.boardHex)).size,
      mirrorGroups: new Set(entries.filter(e => e.mirrorGroup).map(e => e.mirrorGroup)).size,
      eligible: entries.filter(e => e.eligible).length, height: countBy('height'), exclusions: countBy('exclusion'),
      bySource: sources.map(source => ({ ...source, eligibleGroups: new Set(entries.filter(e => e.source === source.file && e.eligible).map(e => e.mirrorGroup)).size,
        sixPieceAt4: entries.filter(e => e.source === source.file && e.eligible && e.heights.some(h => h.clear === 4 && h.piecesNeeded === 6)).length })) } };
}
// The exposure index must list measurements/reviews, NOT mere catalog presence.
// Its scanCoverage is retained so partial historical audits cannot claim fresh.
export function applyExposure(catalog, index) {
  const byGroup = new Map();
  const byId = new Map(catalog.entries.map(e => [e.id, e]));
  for (const evidence of index.evidence) {
    const group = evidence.mirrorGroup ?? (evidence.boardHex ? groupFor(BigInt('0x' + evidence.boardHex)) : byId.get(evidence.id)?.mirrorGroup);
    if (group) byGroup.set(group, [...(byGroup.get(group) ?? []), evidence]);
  }
  for (const entry of catalog.entries) {
    entry.exposureEvidence = byGroup.get(entry.mirrorGroup) ?? [];
    entry.exposure = entry.exposureEvidence.length ? 'EXPOSED' : index.complete ? 'NO_KNOWN_EXPOSURE' : 'UNKNOWN';
  }
  catalog.exposureAudit = { complete: index.complete === true, scanCoverage: index.scanCoverage, sha256: hash(JSON.stringify(index)) };
  return catalog;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, output, exposureFile] = process.argv.slice(2);
  if (!directory || !output) throw new Error('usage: catalog.mjs <db-dir> <output.json> [exposure.json]');
  const catalog = auditDatabases(directory);
  if (exposureFile) applyExposure(catalog, readJson(exposureFile));
  writeJson(output, catalog);
  console.log(JSON.stringify(catalog.summary, null, 2));
}
