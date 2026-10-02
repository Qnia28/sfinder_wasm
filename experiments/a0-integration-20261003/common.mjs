import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const jsonSha = value => sha(JSON.stringify(value));
export const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
export function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
export function seal(dir) { write(path.join(dir, 'FILES.json'), { files: files(dir).map(file => ({ file: path.relative(dir, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) })) }); }
export function matrixInput(entry) {
  const fd = fs.openSync(path.join(HERE, entry.pack), 'r'), bytes = Buffer.alloc(entry.length);
  try { if (fs.readSync(fd, bytes, 0, bytes.length, entry.offset) !== bytes.length) throw Error('Truncated matrix'); } finally { fs.closeSync(fd); }
  if (sha(bytes) !== entry.sha256) throw Error('Pack segment drift');
  const m = JSON.parse(zlib.gunzipSync(bytes));
  if (jsonSha({ keys: m.keys, rows: m.rows, K: m.K, seedKeys: m.seedKeys }) !== entry.identitySha256) throw Error('Identity drift');
  if (!m.primary.cardinalityProven) throw Error('Primary proof missing');
  return m;
}
export function compare(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]); return Math.sign(a.length - b.length); }
export function rle(vector) { const out = []; for (const q of vector) { if (out.at(-1)?.[0] === q) out.at(-1)[1]++; else out.push([q, 1]); } return out; }
export function unrle(vector) { return vector.flatMap(([q, n]) => Array(n).fill(q)); }
export function verify(m, result, seedKeys = m.seedKeys) {
  const index = new Map(m.keys.map((key, i) => [key, i]));
  const ids = result.keys.map(key => { if (!index.has(key)) throw Error('Foreign key'); return index.get(key); }).sort((a, b) => a - b);
  if (result.error || result.count !== m.K || ids.length !== m.K || new Set(ids).size !== m.K) throw Error('Wrong K');
  const evaluate = keys => { const chosen = new Set(keys.map(key => index.get(key))); const q = m.rows.map(row => row.reduce((max, [id, q]) => chosen.has(id) ? Math.max(max, q) : max, 0)).sort((a, b) => a - b); if (!q[0]) throw Error('Uncovered weighted row'); return q; };
  const q = evaluate(result.keys), seed = evaluate(seedKeys);
  if (compare(q, result.qualityVector) !== 0 || compare(q, seed) < 0) throw Error('Quality regression vs incoming seed');
  return { selectedIDs: ids, qualityRLE: rle(q), qualitySha256: jsonSha(q), seedSha256: jsonSha(seedKeys) };
}
export function context(m) { return { primary: { count: m.K, backend: m.primary.backend, searchedStates: m.primary.searchedStates }, primaryKeys: m.seedKeys, primaryHard: m.primary.primaryHard,
  requestedPrimary: m.primary.requested, requested: 'auto', kernelStats: m.primary.kernelStats, decomposition: 'off' }; }
