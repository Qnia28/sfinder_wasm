import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sha256 } from './engine.mjs';
const db = JSON.parse(readFileSync(new URL('./cycle1-setups.json', import.meta.url)));
const bytes = readFileSync(process.argv[2]), analysis = JSON.parse(bytes);
const historicalGroups = [...new Set(analysis.cohorts.map(x => x.mirrorGroup))];
const ids = ['cycle1-elephant-a', 'cycle1-jaws-a', 'cycle1-jeremy-a', 'cycle1-legs-a',
  'cycle1-pcinfo-031', 'cycle1-pcinfo-032', 'cycle1-pcinfo-033', 'cycle1-grace-system-a'];
const validation = ids.map(id => {
  const setup = db.setups.find(s => s.id === id); assert(setup);
  assert(!historicalGroups.includes(setup.mirrorGroup));
  return { setupId: id, mirrorGroup: setup.mirrorGroup, occupied: setup.occupied };
});
assert.equal(new Set(validation.map(s => s.mirrorGroup)).size, 8);
writeFileSync(new URL('./selection-policy.json', import.meta.url), JSON.stringify({ version: 1,
  databaseHash: db.sourceSha256, historicalAnalysisHash: sha256(bytes), historicalGroups,
  validation, developmentCount: 12,
  rule: 'Validation board groups frozen before Actions candidate timing. Choose one proved nontrivial matrix per group using structural rank K-F, levels, n, rows, then lexical ID. Development excludes validation groups and round-robins occupied 24/12/16. No threshold timing or completion result enters selection. Missing validation groups are reported, never silently replaced.' }, null, 2) + '\n', { flag: 'wx' });
console.log('Frozen 8 previously unmeasured validation groups.');
