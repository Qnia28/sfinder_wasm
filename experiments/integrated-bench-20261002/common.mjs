import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const jsonSha = v => sha(JSON.stringify(v));
export const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
export function write(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); }
export function matrixInput(entry) {
  const fd = fs.openSync(path.join(HERE, entry.pack), 'r');
  const bytes = Buffer.alloc(entry.length);
  try { if (fs.readSync(fd, bytes, 0, bytes.length, entry.offset) !== bytes.length) throw Error('Truncated input'); }
  finally { fs.closeSync(fd); }
  if (sha(bytes) !== entry.sha256) throw Error(`Input drift:${entry.id}`);
  const m = JSON.parse(zlib.gunzipSync(bytes));
  if (jsonSha({ keys: m.keys, rows: m.rows, K: m.K, seedKeys: m.seedKeys }) !== entry.identitySha256) throw Error('Input identity drift');
  return m;
}
export function vector(m, ids) {
  const selected = new Set(ids);
  return m.rows.map(row => {
    let max = 0;
    for (const [id, q] of row) if (selected.has(id)) max = Math.max(max, q);
    if (!max) throw Error('Uncovered original row');
    return max;
  }).sort((a, b) => a - b);
}
export function compare(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return Math.sign(a.length - b.length); }
export function rle(v) { const a = []; for (const q of v) { if (a.at(-1)?.[0] === q) a.at(-1)[1]++; else a.push([q, 1]); } return a; }
export function unrle(v) { return v.flatMap(([q, n]) => Array(n).fill(q)); }
export function verify(m, result) {
  const map = new Map(m.keys.map((k, i) => [k, i]));
  const ids = result.keys.map(k => { if (!map.has(k)) throw Error('Foreign result key'); return map.get(k); }).sort((a,b) => a-b);
  if (result.error || result.count !== m.K || ids.length !== m.K || new Set(ids).size !== m.K) throw Error('Invalid cardinality/witness');
  const q = vector(m, ids), seedIDs = m.seedKeys.map(k => map.get(k)), seedQ = vector(m, seedIDs);
  if (compare(q, result.qualityVector) !== 0 || compare(q, seedQ) < 0) throw Error('Quality mismatch or worse than original seed');
  return { ids, qualityRLE: rle(q), qualitySha256: jsonSha(q), seedQualityRLE: rle(seedQ), seedIDs, seedSha256: jsonSha(m.seedKeys) };
}
export function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
export function seal(dir) { write(path.join(dir, 'FILES.json'), { files: files(dir).map(f => ({ file: path.relative(dir, f).replaceAll('\\','/'), bytes: fs.statSync(f).size, sha256: sha(fs.readFileSync(f)) })) }); }
export const VARIANTS = ['H0','P0','P','PD','PC','PDC'];
export function tune(solver, variant) {
  if (!VARIANTS.includes(variant)) throw Error('Unknown variant');
  if (['P','PD','PC','PDC'].includes(variant)) {
    const e = solver.e, flags = 1 | (variant.includes('D') ? 2 : 0) | (variant.includes('C') ? 4 : 0);
    if (!e.solver_bench_integrated_bounded || !e.solver_bench_audit) throw Error('Missing candidate ABI');
    solver.e = { ...e, solver_min_cover_at_count_integrated_partitioned_bounded: (...a) => e.solver_bench_integrated_bounded(...a, flags) };
  }
}
export function dominanceAudit(solver, variant) {
  if (['H0','P0'].includes(variant)) return { status: 'OFF', denseBytes: 0, allocatedBytes: 0, pairVisits: 0, wordComparisons: 0, qualityComparisons: 0, dominated: 0 };
  const a = Array.from({length:7},(_,i)=>Number(solver.e.solver_bench_audit(solver.ptr,i))>>>0);
  return { status:['OFF','COMPLETE','MEMORY_BYPASS','WORK_BYPASS'][a[0]], denseBytes:a[1], allocatedBytes:a[2], pairVisits:a[3], wordComparisons:a[4], qualityComparisons:a[5], dominated:a[6] };
}
