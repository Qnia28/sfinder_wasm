// Offline metadata analysis; never changes the active frozen campaign inputs.
import assert from 'node:assert/strict';
import { decoder } from 'tetris-fumen';
import { scanFumenField } from '../../src/board.mjs';
import { groupFor, applyExposure } from './catalog.mjs';
import { readJson, writeJson } from './contracts.mjs';
const [partialFile, archivesFile, proposalFile, outputFile] = process.argv.slice(2);
assert(partialFile && archivesFile && proposalFile && outputFile);
const partial = readJson(partialFile), archived = readJson(archivesFile), proposal = readJson(proposalFile);
const evidence = [...partial.index.evidence, ...archived.evidence], errors = [...archived.errors];
for (const item of archived.fumenRefs) {
  try {
    const page = decoder.decode(item.fumen)[0]; assert(page);
    const mirrorGroup = groupFor(scanFumenField(page.field, 6).board);
    for (const source of item.sources) evidence.push({ mirrorGroup, ...source, kind: 'ARCHIVED_FUMEN_REFERENCE' });
  } catch (error) { errors.push({ fumen: item.fumen, error: error.message }); }
}
const index = { schema: 1, complete: false, scanCoverage: [...partial.index.scanCoverage, ...archived.scanCoverage], evidence,
  pending: ['Unarchived historical validation/browser/input-exposure records not all covered', 'Reference presence is conservative exposure, not completed-engine timing'] };
const catalog = applyExposure(partial.catalog, index), groups = new Map();
for (const entry of catalog.entries) if (!groups.has(entry.mirrorGroup)) groups.set(entry.mirrorGroup, entry.exposure);
const partitions = Object.fromEntries(['PROPOSED_DEVELOPMENT', 'PROPOSED_RESERVE_AUDIT_PENDING'].map(partition => {
  const entries = proposal.inventory.filter(entry => entry.partition === partition);
  return [partition, { groups: entries.length, exposedOrPossible: entries.filter(entry => groups.get(entry.mirrorGroup) === 'EXPOSED').length,
    unknown: entries.filter(entry => groups.get(entry.mirrorGroup) !== 'EXPOSED').length, freshClaim: 'NONE' }];
}));
const summary = { groups: groups.size, exposedOrPossible: [...groups.values()].filter(value => value === 'EXPOSED').length,
  unknown: [...groups.values()].filter(value => value !== 'EXPOSED').length, partitions,
  scannedArchivedPaths: archived.scannedPaths, errors: errors.length };
writeJson(outputFile, { schema: 1, kind: 'OFFLINE_EXISTING_HISTORY_NO_SOLVER', frozenInputsChanged: false,
  historicalTimesImportedIntoCurrentRaw: false, summary, errors, index, catalog,
  timingReuseCandidates: archived.directEngineMetadataCandidates });
console.log(JSON.stringify(summary, null, 2));
