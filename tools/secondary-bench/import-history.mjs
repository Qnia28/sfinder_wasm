// Conservative, partial exposure audit from explicitly named old evidence files.
// Planning/review references count as exposure candidates; absence is UNKNOWN.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decoder } from 'tetris-fumen';
import { scanFumenField } from '../../src/board.mjs';
import { groupFor, applyExposure } from './catalog.mjs';
import { readJson, writeJson, hash } from './contracts.mjs';

const [catalogFile, outputFile, ...sources] = process.argv.slice(2);
assert(catalogFile && outputFile && sources.length, 'usage: import-history.mjs <catalog> <new-output> <evidence-json> [...]');
const catalog = readJson(catalogFile), knownIds = new Map(catalog.entries.map(e => [e.id, e])), evidence = [], scanCoverage = [];
for (const source of sources) {
  const bytes = fs.readFileSync(source), data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const sourceName = path.basename(path.dirname(source)) + '/' + path.basename(source);
  scanCoverage.push({ source: sourceName, pathAtAudit: path.resolve(source), sha256: hash(bytes) });
  const groups = new Set();
  const addGroup = value => {
    try { const board = BigInt('0x' + String(value).replace(/^0x/, '')); groups.add(groupFor(board)); } catch { /* Unknown old labels remain unlinked. */ }
  };
  function walk(value, key = '') {
    if (typeof value === 'string') {
      if (key === 'mirrorGroup' || key === 'board' || key === 'boardHex') addGroup(value);
      if (key === 'sourceFumen' || key === 'fumen') {
        try { const page = decoder.decode(value)[0]; if (page) groups.add(groupFor(scanFumenField(page.field, 6).board)); } catch { /* Recorded bad input stays in old source. */ }
      }
      if (['id', 'caseId', 'setupId'].includes(key)) {
        for (const [id, entry] of knownIds) if (value === id || value.includes(id + '-') || value.includes(id + '/') || value.endsWith(':' + id)) groups.add(entry.mirrorGroup);
      }
      return;
    }
    if (Array.isArray(value)) { for (const entry of value) walk(entry, key); return; }
    if (value && typeof value === 'object') {
      for (const [name, child] of Object.entries(value)) {
        if (knownIds.has(name)) groups.add(knownIds.get(name).mirrorGroup); // seenIds maps
        walk(child, name);
      }
    }
  }
  walk(data);
  for (const mirrorGroup of groups) evidence.push({ mirrorGroup, source: sourceName, sha256: hash(bytes), kind: 'CONSERVATIVE_HISTORICAL_REFERENCE' });
}
const index = { schema: 1, complete: false, pending: ['Other Threshold / Integrated / browser campaigns and archived bundles must be audited before fresh-holdout designation'], scanCoverage, evidence };
applyExposure(catalog, index);
const groups = new Set(catalog.entries.map(e => e.mirrorGroup)), exposed = new Set(catalog.entries.filter(e => e.exposure === 'EXPOSED').map(e => e.mirrorGroup));
writeJson(outputFile, { index, summary: { groups: groups.size, knownOrPossibleExposedGroups: exposed.size, unknownGroups: groups.size - exposed.size }, catalog });
console.log(JSON.stringify({ auditedSources: sources.length, groups: groups.size, exposed: exposed.size, unknown: groups.size - exposed.size, complete: false }));
