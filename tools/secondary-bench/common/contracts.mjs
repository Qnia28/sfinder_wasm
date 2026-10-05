import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function artifactDigest(value) {
  assert(typeof value === 'string' && /^(sha256:)?[a-f0-9]{64}$/.test(value), 'artifact SHA256 required');
  return value.startsWith('sha256:') ? value : 'sha256:' + value;
}
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { assert(Number.isFinite(value), 'nonfinite canonical number'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'canonical JSON values only');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export const digest = value => sha256(canonical(value));
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'wx');
  try { fs.writeSync(fd, canonical(value) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function replaceJson(file, value) {
  const tmp = file + '.pending-' + process.pid;
  writeJson(tmp, value); fs.renameSync(tmp, file);
}
export function strict(value, keys, label) {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, label + ' object required');
  for (const key of Object.keys(value)) assert(keys.includes(key), `${label}: unsupported field ${key}`);
}
export function integer(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  assert(Number.isSafeInteger(value) && value >= min && value <= max, 'bounded integer required'); return value;
}
export function safePath(root, member) {
  assert(typeof member === 'string' && member.length && !path.isAbsolute(member));
  assert(!member.includes('\\') && !member.split('/').some(p => ['..', '.', ''].includes(p)), 'unsafe member');
  const file = path.resolve(root, member); assert(file.startsWith(path.resolve(root) + path.sep), 'path escape'); return file;
}
export function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    assert(!e.isSymbolicLink(), 'symlink forbidden');
    const file = path.join(root, e.name); return e.isDirectory() ? filesUnder(file) : [file];
  });
}
export const memberPath = (root, file) => path.relative(root, file).replaceAll('\\', '/');
export function sourceBytes(file) {
  const bytes = fs.readFileSync(file), text = bytes.toString('utf8');
  return (/^(src|rust|wasm)\//.test(file) || ['package.json', 'package-lock.json'].includes(file))
    && !bytes.includes(0) && Buffer.from(text).equals(bytes) ? Buffer.from(text.replaceAll('\r\n', '\n')) : bytes;
}
export function verifySources(sources) {
  for (const group of ['product', 'harness']) {
    assert(Object.keys(sources[group]).length, group + ' lock required');
    for (const [file, hash] of Object.entries(sources[group])) {
      safePath(process.cwd(), file); assert.equal(sha256(sourceBytes(file)), hash, 'source mismatch: ' + file);
    }
  }
}
export const ENGINES = ['integrated', 'threshold', 'cpsat'];
export const STAGES = ['preflight', 'acquire', 'initial', 'additional'];
export const logicalCallId = (lock, stage, inputId, inputHash, variant, repeat, phase, limits) => digest({
  campaignId: lock.manifest.campaignId, stage, inputId, inputHash, variant, repeat, phase,
  conditionHash: lock.conditionHash, limits,
});
