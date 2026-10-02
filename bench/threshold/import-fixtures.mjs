// One-time local import. CI reads only the committed, hashed gzip fixtures.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BASELINE_SHA, ELEMENTS, sha256, validateMatrix } from './engine.mjs';

const source = process.argv[2];
assert(source, 'usage: node bench/threshold/import-fixtures.mjs <workspace-root>');
assert(!existsSync('bench/threshold/manifest.json'), 'manifest is frozen; do not overwrite it');
const validation = resolve(source, 'tools/validation');
const analysisPath = resolve(validation, 'secondary-routing-design-20260929/ANALYSIS.json');
const bytes = readFileSync(analysisPath), analysis = JSON.parse(bytes);
const development = [
  ['extra000-split-I', 'ordinary:cycle3-extra-t-000-f000-split-I'],
  ['qb266-full-Z', 'per-save:c7-2plus2-qb-row-266-fullsplit-Z'],
  ['extra000-full-I', 'ordinary:cycle3-extra-t-000-f000-fullsplit-I'],
  ['pcinfo018-L', 'per-save:cycle1-pcinfo-018-split-L'],
  ['elephant-J', 'per-save:cycle1-elephant-j-a-split-J'],
  ['jaws-J', 'per-save:cycle1-alt-jaws-a-split-J'],
  ['jaws-O', 'per-save:cycle1-alt-jaws-a-split-O'],
  ['pcinfo030-T', 'ordinary:cycle1-pcinfo-030-split-T'],
  ['pcinfo030-I', 'ordinary:cycle1-pcinfo-030-split-I'],
  ['qb235-full-Z', 'per-save:c7-2plus2-qb-row-235-fullsplit-Z'],
  ['qb059-full-I', 'per-save:c7-2plus2-qb-row-059-fullsplit-I'],
  ['qb157-S', 'per-save:c7-2plus2-qb-row-157-split-S'],
];
const heldout = [
  ['shoes-T', 'ordinary:cycle1-alt-shoes-a-split-T'],
  ['cliff-I', 'per-save:cycle1-cliff-o-a-split-I'],
  ['pcinfo019-O', 'per-save:cycle1-pcinfo-019-split-O'],
  ['qb003-T', 'heldout:c7-2plus2-qb-row-003-split-T'],
  ['bigjaws-I', 'heldout:cycle1-big-jaws-a-split-I'],
  ['hills-T', 'ordinary:cycle1-hills-a-split-T'],
  ['extra006-I', 'ordinary:cycle3-extra-t-006-f000-split-I'],
  ['qb279-full-S', 'per-save:c7-2plus2-qb-row-279-fullsplit-S'],
];
mkdirSync('bench/threshold/inputs', { recursive: true });
const cases = [];
for (const [suite, list] of [['development', development], ['validation', heldout]]) {
  for (const [id, caseId] of list) {
    const entry = analysis.inputs.find(x => x.caseIds.includes(caseId));
    assert(entry, caseId);
    const input = readFileSync(resolve(validation, ...entry.matrixPath.split(/[\\/]/)));
    assert.equal(sha256(input), entry.sha256);
    const matrix = JSON.parse(input); validateMatrix(matrix);
    const mirrorGroup = analysis.cohorts.find(x => x.sha256 === entry.sha256)?.mirrorGroup;
    assert(mirrorGroup, 'missing mirror group');
    const compressed = gzipSync(input, { level: 9 });
    const file = `inputs/${id}.json.gz`;
    writeFileSync(resolve('bench/threshold', file), compressed, { flag: 'wx' });
    cases.push({ id, caseId, suite, mirrorGroup, file, sha256: entry.sha256,
      compressedSha256: sha256(compressed), sourcePath: entry.matrixPath.replaceAll('\\', '/'),
      n: matrix.keys.length, K: matrix.K, F: entry.features.forced, rows: matrix.rows.length,
      entries: entry.features.entries, qualityLevels: entry.features.qualityLevels,
      seedIds: matrix.seed, KProofSource: 'existing audited capture; not re-proved by this benchmark' });
  }
}
const groups = new Set(cases.filter(x => x.suite === 'development').map(x => x.mirrorGroup));
assert(cases.filter(x => x.suite === 'validation').every(x => !groups.has(x.mirrorGroup)));
writeFileSync('bench/threshold/manifest.json', JSON.stringify({ version: 1, baseline: BASELINE_SHA,
  elements: ELEMENTS, analysisSha256: sha256(bytes), cases,
  smoke: ['extra000-split-I', 'pcinfo018-L'],
  factorial: ['extra000-split-I','qb266-full-Z','extra000-full-I','pcinfo018-L','pcinfo030-T','qb235-full-Z'],
}, null, 2) + '\n', { flag: 'wx' });
writeFileSync('bench/threshold/references.json', JSON.stringify({ version: 1,
  policy: 'Exact witnesses are independently re-scored on all original rows, and cross-checked across completed settings/pairs. Seed scores are never treated as optimal. Candidate-only completions are reported separately; no offline optimum is invented.',
  smallOracle: 'independent exhaustive K/quality/ID oracle in correctness.test.mjs',
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Frozen ${cases.length} matrices, 12 development / 8 disjoint-group validation.`);
