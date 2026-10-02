import fs from 'node:fs';
import path from 'node:path';
import { DIR, hash, readJson, writeJson, signature } from './common.mjs';
import { decodeAndValidate } from '../../src/pc-input.mjs';

const [lunaRoot, museManifest] = process.argv.slice(2);
if (!lunaRoot || !museManifest) throw new Error('Usage: export-history.mjs <luna archive> <muse manifest>');
const history = [];
const tuple = row => [decodeAndValidate(row.sourceFumen, row.clear ?? 4).board.toString(16).padStart(10, '0'), row.pattern, row.wantedSave, row.clear ?? 4, row.useHold ?? true, row.outcomeCache ?? false];
for (const campaign of ['A1-wide', 'A2-reuse', 'B1-branches', 'B2-short-mid', 'B2-long-fixed']) {
  const file = path.join(lunaRoot, 'configs', `${campaign}-cells.json`), manifest = readJson(file);
  for (const cell of manifest.cells) {
    const config = readJson(cell.config);
    const resultDir = campaign === 'B2-long-fixed' ? 'B2-long-rerun' : campaign;
    const resultFile = path.join(lunaRoot, 'results', resultDir, `${cell.id}.json`);
    const result = fs.existsSync(resultFile) ? readJson(resultFile) : null;
    const pairs = result?.trialPairs ?? [];
    const ratios = pairs.filter(pair => pair.base?.wallMs != null && pair.tip?.wallMs != null).map(pair => pair.base.wallMs / pair.tip.wallMs);
    history.push({ archive: 'Luna', campaign, id: cell.id, tuple: tuple(config), manifestSha256: hash(fs.readFileSync(file)),
      configSha256: hash(fs.readFileSync(cell.config)), controls: { base: { ref: config.base.ref, hashes: config.base.hashes }, tip: { ref: config.tip.ref, hashes: config.tip.hashes } },
      temperature: config.mode?.includes('reuse') ? 'repeated-session' : 'see-archived-protocol',
      resultSha256: result ? hash(fs.readFileSync(resultFile)) : null,
      pairedObservations: pairs.length, pairedWallRatios: ratios, resultPresent: Boolean(result),
      disposition: 'EXISTING_EVIDENCE_SUFFICIENT_NO_CI_REPLAY', reason: 'No new candidate/hypothesis for this element; ratios are historical Windows evidence only.' });
  }
}
const muse = readJson(museManifest);
for (const row of muse.cells) history.push({ archive: 'Muse', id: row.id, tuple: tuple(row), manifestSha256: hash(fs.readFileSync(museManifest)),
  controls: 'Archive manifest lacks immutable pair hashes; retain as input coverage, not identical candidate or golden proof.',
  disposition: 'HISTORICAL_INPUT_COVERAGE_ONLY' });
const inputs = readJson(path.join(DIR, 'inputs/cells.json'));
const index = new Map();
for (const record of history) { const key = signature(record.tuple); if (!index.has(key)) index.set(key, []); index.get(key).push(record); }
const ledger = inputs.cells.map(cell => {
  const matches = index.get(signature(tuple(cell))) ?? [];
  return { id: cell.id, classification: matches.length ? 'NEW_HYPOTHESIS' : 'NEW_SAMPLE_EXPANSION',
    purpose: cell.stage === 'a6' ? 'Changed zero-off-path telemetry overhead, not old integrated Muse stats.' : cell.stage === 'anchor' ? 'Separate product/wrapper/rebuild/direct full costs.' : 'Independent B4 implementation, new geometry/Hold/pattern coverage.',
    priorInputMatches: matches.map(record => ({ archive: record.archive, id: record.id, campaign: record.campaign ?? 'Muse matrix' })),
    controlsEqualToPrior: false, reusePriorTimingAsNewObservation: false, rerunOldAlgorithmCampaign: false };
});
writeJson(path.join(DIR, 'inputs/evidence-ledger.json'), { schema: 'saves-cell-evidence-reuse-v1', history, newCells: ledger,
  limitations: 'Luna independent performance does not include B3/B4/B6; Muse integrated hashes are not presumed identical to minimal prototypes.' });
const seal = readJson(path.join(DIR, 'design-seal.json'));
seal.files['inputs/evidence-ledger.json'] = hash(fs.readFileSync(path.join(DIR, 'inputs/evidence-ledger.json')));
writeJson(path.join(DIR, 'design-seal.json'), seal);
console.log(JSON.stringify({ historicalRows: history.length, newCells: ledger.length, priorInputOverlap: ledger.filter(row => row.priorInputMatches.length).length }));
