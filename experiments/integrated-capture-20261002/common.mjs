import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const jsonSha = value => sha(JSON.stringify(value));
export const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export function compressedWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = Buffer.from(JSON.stringify(value));
  const bytes = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  return { file, sha256: sha(bytes), jsonSha256: sha(json), bytes: bytes.length };
}
export const compressedRead = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
export function mirror(board) {
  let result = 0n;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) {
    if ((board >> BigInt(y * 10 + x)) & 1n) result |= 1n << BigInt(y * 10 + 9 - x);
  }
  return result;
}
export function patterns(length, box = false) {
  const bag = { 7: '*!', 8: '*p7,T', 5: '*p5' }[length];
  if (!bag) throw new Error(`Unsupported queue length ${length}`);
  return [
    ...(!box ? [{ id: 'bag', pattern: bag }] : []),
    { id: 'restricted-split', pattern: `[IJL]p3,*p${length - 3}` },
  ];
}
export function matrixIdentity(matrix) {
  return jsonSha({ keys: matrix.keys, rows: matrix.rows, K: matrix.K, seedKeys: matrix.seedKeys });
}
export function validateRows(matrix) {
  const { keys, rows, cases } = matrix;
  if (!keys.length || !rows.length || cases.length !== rows.length) throw new Error('Empty/misaligned matrix');
  if (new Set(keys).size !== keys.length || keys.some((key, i) => typeof key !== 'string' || (i > 0 && keys[i - 1] >= key))) throw new Error('Noncanonical candidate IDs');
  if (new Set(cases.map(c => c.caseId)).size !== cases.length) throw new Error('Duplicate case IDs');
  for (const row of rows) {
    if (!row.length) throw new Error('Empty active row');
    const ids = new Set();
    for (const [id, q] of row) {
      if (!Number.isSafeInteger(id) || id < 0 || id >= keys.length || ids.has(id)) throw new Error('Invalid/duplicate edge ID');
      if (!Number.isSafeInteger(q) || q <= 0 || q > 0xffffffff) throw new Error('Invalid quality');
      ids.add(id);
    }
  }
}
export function validateSeed(matrix) {
  validateRows(matrix);
  const { K, seedKeys, keys, rows } = matrix;
  if (!Number.isSafeInteger(K) || K < 1 || seedKeys.length !== K || new Set(seedKeys).size !== K) throw new Error('Invalid K/seed');
  const index = new Map(keys.map((key, i) => [key, i]));
  const chosen = new Set(seedKeys.map(key => { if (!index.has(key)) throw new Error('Unknown seed'); return index.get(key); }));
  for (const row of rows) if (!row.some(([id]) => chosen.has(id))) throw new Error('Seed does not cover original row');
  if (matrix.primary?.cardinalityProven !== true) throw new Error('Unproven primary');
}
export function primaryOnly(solver) {
  const audit = { forbiddenCalls: 0, cardinalityCalls: 0, kernelCalls: 0 };
  const deny = name => () => { audit.forbiddenCalls++; throw new Error(`SECONDARY_FORBIDDEN:${name}`); };
  for (const name of ['minimumCover', 'minimumCoverIds', 'minimumCoverAtCount']) solver[name] = deny(name);
  const exports = { ...solver.e };
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value !== 'function') continue;
    if (name === 'solver_min_cover_cardinality') exports[name] = (...args) => { audit.cardinalityCalls++; return value(...args); };
    else if (name === 'solver_primary_kernelize') exports[name] = (...args) => { audit.kernelCalls++; return value(...args); };
    else if (name === 'solver_min_cover' || name.startsWith('solver_min_cover_at_count')) exports[name] = deny(name);
  }
  solver.e = exports;
  return audit;
}
export function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}
