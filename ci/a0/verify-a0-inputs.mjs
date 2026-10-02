import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { validateSchedule } from './a0-contracts.mjs';
import { planPath } from './a0-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const attempt02 = path.join(here, 'attempt-02');
const casesFile = planPath;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const plan = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(attempt02, 'manifest.json'), 'utf8'));
const classification = fs.readFileSync(path.join(attempt02, 'classification.jsonl'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const eligible = classification.filter(row => row.autoClass === 'INTEGRATED_100K_PROBE_ELIGIBLE');
validateSchedule(plan);
if (plan.preparationManifestSha256 !== sha256(fs.readFileSync(path.join(attempt02, 'manifest.json')))
    || plan.classificationSha256 !== sha256(fs.readFileSync(path.join(attempt02, 'classification.jsonl')))) {
  throw new Error('plan preparation/classification provenance mismatch');
}
if (manifest.status !== 'PREP_COMPLETE' || eligible.length !== 81) {
  throw new Error('Attempt 02 is not the expected complete 81-matrix preparation bundle');
}

const byPath = new Map(eligible.map(row => [row.snapshot.path, row]));
const errors = [];
const allSnapshotHashes = new Map();
const snapshotIdentities = new Map();
for (const record of eligible) {
  const bytes = fs.readFileSync(path.join(attempt02, record.snapshot.path));
  const compressedSha256 = sha256(bytes);
  if (compressedSha256 !== record.snapshot.gzipSha256) errors.push(`gzip hash mismatch: ${record.snapshot.path}`);
  allSnapshotHashes.set(record.snapshot.path, compressedSha256);
  const json = gunzipSync(bytes);
  if (sha256(json) !== record.snapshot.jsonSha256) errors.push(`JSON hash mismatch: ${record.snapshot.path}`);
  const matrix = JSON.parse(json);
  snapshotIdentities.set(record.snapshot.path, sha256(Buffer.from(JSON.stringify({
    keys: matrix.keys, K: matrix.K, seedKeys: matrix.seedKeys, rows: matrix.rows,
  }))));
}
const aliasesSeen = new Set();

for (const testCase of plan.cases) {
  for (const alias of testCase.aliases) {
    if (aliasesSeen.has(alias.snapshotPath) || snapshotIdentities.get(alias.snapshotPath) !== testCase.identitySha256) {
      errors.push(`duplicate/incorrect alias identity: ${alias.snapshotPath}`);
    }
    const sourceRecord = byPath.get(alias.snapshotPath);
    if (!sourceRecord || alias.fixtureId !== sourceRecord.fixtureId || alias.family !== sourceRecord.family
        || alias.savedPiece !== sourceRecord.savedPiece) errors.push(`alias provenance labels mismatch: ${alias.snapshotPath}`);
    aliasesSeen.add(alias.snapshotPath);
  }
  if (!testCase.aliases.some(alias => alias.snapshotPath === testCase.representative.snapshotPath)) {
    errors.push(`representative is not an alias: ${testCase.caseId}`);
  }
  const relative = testCase.representative.snapshotPath;
  const record = byPath.get(relative);
  if (!record) {
    errors.push(`representative snapshot missing from eligible set: ${testCase.caseId}`);
    continue;
  }
  const bytes = fs.readFileSync(path.join(attempt02, relative));
  const jsonBytes = gunzipSync(bytes);
  if (sha256(jsonBytes) !== record.snapshot.jsonSha256) errors.push(`JSON hash mismatch: ${relative}`);
  const matrix = JSON.parse(jsonBytes);
  const identity = JSON.stringify({ keys: matrix.keys, K: matrix.K, seedKeys: matrix.seedKeys, rows: matrix.rows });
  const identitySha256 = sha256(Buffer.from(identity));
  if (identitySha256 !== testCase.identitySha256) errors.push(`matrix identity mismatch: ${testCase.caseId}`);
  if (matrix.keys.length !== testCase.candidateCount || matrix.rows.length !== testCase.rowCount
      || matrix.rows.reduce((sum, row) => sum + row.length, 0) !== testCase.entryCount
      || matrix.K !== testCase.K) errors.push(`case metadata mismatch: ${testCase.caseId}`);
  if (!Number.isInteger(matrix.K) || matrix.K < 1 || matrix.K > matrix.keys.length) {
    errors.push(`invalid K: ${testCase.caseId}`);
  }
  if (new Set(matrix.keys).size !== matrix.keys.length) errors.push(`duplicate candidate keys: ${testCase.caseId}`);
  if (matrix.keys.some(key => typeof key !== 'string' || !key.length)) errors.push(`invalid candidate key: ${testCase.caseId}`);
  if (matrix.seedKeys.length !== matrix.K || new Set(matrix.seedKeys).size !== matrix.K
      || matrix.seedKeys.some(key => !matrix.keys.includes(key))) errors.push(`invalid primary seed: ${testCase.caseId}`);
  const seedIds = new Set(matrix.seedKeys.map(key => matrix.keys.indexOf(key)));
  const activeIds = new Set();
  for (let rowIndex = 0; rowIndex < matrix.rows.length; rowIndex++) {
    const row = matrix.rows[rowIndex];
    if (!row.length) errors.push(`empty original row ${rowIndex}: ${testCase.caseId}`);
    if (!row.some(([id]) => seedIds.has(id))) errors.push(`primary seed misses original row ${rowIndex}: ${testCase.caseId}`);
    for (const pair of row) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        errors.push(`malformed edge in ${testCase.caseId}/${rowIndex}`);
        continue;
      }
      const [id, quality] = pair;
      if (!Number.isInteger(id) || id < 0 || id >= matrix.keys.length
          || !Number.isInteger(quality) || quality <= 0 || quality > 0xffffffff) errors.push(`invalid edge in ${testCase.caseId}/${rowIndex}`);
      activeIds.add(id);
    }
  }
  if (activeIds.size !== matrix.keys.length) errors.push(`inactive candidate key in ${testCase.caseId}`);
  if (allSnapshotHashes.get(relative) !== record.snapshot.gzipSha256) errors.push(`snapshot hash index mismatch: ${relative}`);
}
if (aliasesSeen.size !== eligible.length || plan.inputSnapshotCount !== eligible.length
    || plan.uniqueMatrixCount !== 73 || plan.duplicateMatrixCount !== eligible.length - plan.cases.length) {
  errors.push('catalog/alias population mismatch');
}

const caseIds = new Set(plan.cases.map(testCase => testCase.caseId));
if (plan.selectedCaseIds.some(caseId => !caseIds.has(caseId))) errors.push('selectedCaseIds contains unknown matrix');
const expectedRuns = plan.selectedUniqueMatrixCount * plan.variants.length * plan.repetitionsPerVariant;
if (plan.runSchedule.length !== expectedRuns || plan.plannedRuns !== expectedRuns) errors.push('run schedule count mismatch');
for (const matrixId of plan.selectedCaseIds) {
  for (let repetition = 1; repetition <= plan.repetitionsPerVariant; repetition++) {
    const pair = plan.runSchedule.filter(row => row.caseId === matrixId && row.repetition === repetition);
    if (pair.length !== 2 || new Set(pair.map(row => row.variant)).size !== 2) {
      errors.push(`incomplete A/B pair: ${matrixId}/rep${repetition}`);
    } else if (pair[0].sequence >= pair[1].sequence) {
      errors.push(`invalid sequence order: ${matrixId}/rep${repetition}`);
    }
  }
}
if (errors.length) throw new Error(`A0 input preflight failed (${errors.length}):\n${errors.slice(0, 40).join('\n')}`);

const summary = {
  status: 'INPUTS_PREPARED_NOT_MEASURED',
  inputSnapshots: eligible.length,
  uniqueMatrices: plan.uniqueMatrixCount,
  duplicateSnapshots: plan.duplicateMatrixCount,
  selectedMatrices: plan.selectedUniqueMatrixCount,
  repetitionsPerVariant: plan.repetitionsPerVariant,
  plannedRuns: plan.plannedRuns,
  variants: plan.variants,
  totalOriginalRows: plan.cases.reduce((sum, testCase) => sum + testCase.rowCount, 0),
  totalQualityEntries: plan.cases.reduce((sum, testCase) => sum + testCase.entryCount, 0),
  snapshotsSha256: sha256(Buffer.from(JSON.stringify([...allSnapshotHashes].sort(([a], [b]) => a.localeCompare(b))))),
  scheduleSha256: sha256(fs.readFileSync(casesFile)),
  measurementsStarted: false,
};
if (process.env.A0_INPUT_SUMMARY_PATH) {
  fs.writeFileSync(path.resolve(process.env.A0_INPUT_SUMMARY_PATH), `${JSON.stringify(summary, null, 2)}\n`);
}
console.log(JSON.stringify(summary, null, 2));
