import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { registerNumericCoverage } from '../../src/numeric-cover-data.mjs';
import { normalizeExactHumanQuality } from '../../src/min-cover-adaptive.mjs';

export const ENGINES = Object.freeze(['integrated', 'threshold', 'cpsat']);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const identity = value => hash(JSON.stringify(value));
export const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
export function writeJson(filename, value) {
  const fd = fs.openSync(filename, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
export function positiveMs(value, label) {
  assert(Number.isSafeInteger(value) && value > 0 && value <= 2147483647, `${label} needs a finite positive millisecond limit`);
  return value;
}
export function assertExact(value) {
  assert.equal(normalizeExactHumanQuality(value), 'true', 'benchmark requires explicit Human quality exact');
}
export function validateLimits(limits) {
  for (const name of ['startupMs', 'callMs', 'reapMs']) positiveMs(limits?.[name], name);
  return limits;
}
export function selectedVector(fixture, selected) {
  const chosen = new Set(selected);
  assert.equal(chosen.size, fixture.K, 'witness cardinality');
  assert.equal(selected.length, fixture.K, 'duplicate selected ID');
  for (const id of selected) assert(Number.isInteger(id) && id >= 0 && id < fixture.keys.length, 'unknown selected ID');
  return fixture.rows.map(row => {
    let best = 0;
    for (const [id, q] of row) if (chosen.has(id)) best = Math.max(best, q);
    assert(best > 0, 'witness misses original row');
    return best;
  }).sort((a, b) => a - b);
}
export function validateFixture(fixture) {
  assert.equal(fixture.schema, 1, 'unsupported fixture schema');
  assert(typeof fixture.id === 'string' && fixture.id.length > 0);
  assert(Array.isArray(fixture.keys) && fixture.keys.every((key, i) => typeof key === 'string' && (!i || fixture.keys[i - 1] < key)), 'stable keys must be uniquely ascending');
  assert(Number.isInteger(fixture.K) && fixture.K >= 0 && fixture.K <= fixture.keys.length);
  assert(Array.isArray(fixture.rows) && Array.isArray(fixture.seed));
  for (const row of fixture.rows) {
    assert(Array.isArray(row) && row.length > 0, 'empty original row');
    const ids = new Set();
    for (const entry of row) {
      assert(Array.isArray(entry) && entry.length === 2);
      const [id, q] = entry;
      assert(Number.isInteger(id) && id >= 0 && id < fixture.keys.length && !ids.has(id), 'invalid/duplicate edge ID');
      assert(Number.isSafeInteger(q) && q > 0 && q <= 0xffffffff, 'invalid quality');
      ids.add(id);
    }
  }
  if (fixture.caseIds) assert.equal(fixture.caseIds.length, fixture.rows.length);
  assert.equal(fixture.cardinalityProof?.status, 'PROVEN', 'minimal K provenance required');
  assert(typeof fixture.cardinalityProof.backend === 'string');
  selectedVector(fixture, fixture.seed);
  return fixture;
}
// Dedup identity includes the seed and stable universe, not just the matrix.
export function fixtureIdentity(fixture) {
  validateFixture(fixture);
  return identity({ keys: fixture.keys, rows: fixture.rows, K: fixture.K, seed: fixture.seed });
}
export function packedView(fixture) {
  validateFixture(fixture);
  const { keys, rows } = fixture;
  const offsets = new Uint32Array(rows.length + 1);
  const entries = rows.reduce((sum, row) => sum + row.length, 0);
  const ids = new Uint32Array(entries), qualities = new Uint32Array(entries);
  let position = 0;
  for (let r = 0; r < rows.length; r++) {
    offsets[r] = position;
    for (const [id, q] of rows[r]) { ids[position] = id; qualities[position++] = q; }
  }
  offsets[rows.length] = position;
  const rawCases = rows.map((_, i) => ({ caseId: fixture.caseIds?.[i] ?? i }));
  const coverage = { size: rows.length };
  // Preserve ALL stable IDs, even if an imported fixture has unused candidates.
  registerNumericCoverage(coverage, { keys, keyIndex: new Map(keys.map((key, i) => [key, i])), rawCases, primaryCases: [] },
    { offsets, ids, qualities, caseCount: rows.length, entryCount: entries });
  return { coverage, qualityFor: () => { throw new Error('packed original qualities only'); } };
}
export function verifyResult(fixture, result, { engine }) {
  assert(result && Array.isArray(result.keys) && Array.isArray(result.qualityVector), 'missing witness');
  assert.equal(result.count, fixture.K);
  const index = new Map(fixture.keys.map((key, id) => [key, id]));
  const selected = result.keys.map(key => index.get(key)).sort((a, b) => a - b);
  const qualityVector = selectedVector(fixture, selected);
  assert.deepEqual(result.qualityVector, qualityVector, 'original weighted quality mismatch');
  if (engine === 'cpsat' && result.completed) {
    assert.equal(result.qualityComplete, true, 'CP quality proof missing');
    assert.equal(result.tieComplete, true, 'CP stable-ID proof missing');
  }
  return { selected, qualityVector, qualityHash: identity(qualityVector), completed: result.completed === true };
}
