import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
export const BASELINE = 'c0cb2a048e7275bfea587d176b1954efff0a8a08';
export const EXPECTED_WASM = '73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3';
export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const jsonSha = v => sha(JSON.stringify(v));
export const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
export function write(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); }
export function append(f, v) { const fd = fs.openSync(f, 'a'); try { fs.writeSync(fd, JSON.stringify(v) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
export function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
export function seal(dir) { write(path.join(dir, 'FILES.json'), { files: files(dir).map(f => ({ file: path.relative(dir, f).replaceAll('\\', '/'), bytes: fs.statSync(f).size, sha256: sha(fs.readFileSync(f)) })) }); }
export function matrix(entry) {
  const fd = fs.openSync(path.join(HERE, entry.pack), 'r'), bytes = Buffer.alloc(entry.length);
  try { if (fs.readSync(fd, bytes, 0, bytes.length, entry.offset) !== bytes.length) throw Error('Truncated segment'); } finally { fs.closeSync(fd); }
  if (sha(bytes) !== entry.sha256) throw Error('Input drift');
  const m = JSON.parse(zlib.gunzipSync(bytes));
  if (jsonSha({ keys: m.keys, rows: m.rows, K: m.K, seedKeys: m.seedKeys }) !== entry.identitySha256 || !m.primary.cardinalityProven) throw Error('Identity/proof drift');
  return m;
}
export function context(m) { return { primary: { count: m.K, backend: m.primary.backend, searchedStates: m.primary.searchedStates }, primaryKeys: m.seedKeys,
  primaryHard: m.primary.primaryHard, requestedPrimary: m.primary.requested, requested: 'auto', kernelStats: m.primary.kernelStats, decomposition: 'off' }; }
export const compare = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]); return Math.sign(a.length - b.length); };
export function verify(m, r, seed = m.seedKeys) {
  const index = new Map(m.keys.map((k, i) => [k, i])), ids = r.keys.map(k => index.get(k)).sort((a, b) => a - b);
  if (r.count !== m.K || ids.length !== m.K || new Set(ids).size !== m.K || ids.some(i => i == null) || r.error) throw Error('Invalid K/keys');
  const qFor = keys => { const chosen = new Set(keys.map(k => index.get(k))); const q = m.rows.map(row => row.reduce((v, [id, quality]) => chosen.has(id) ? Math.max(v, quality) : v, 0)).sort((a, b) => a - b); if (!q.length || !q[0]) throw Error('Uncovered row'); return q; };
  const q = qFor(r.keys); if (compare(q, r.qualityVector) || compare(q, qFor(seed)) < 0) throw Error('Weighted quality/seed regression');
  return { selectedIDs: ids, qualitySha256: jsonSha(q), seedSha256: jsonSha(seed), originalRowCount: q.length };
}
