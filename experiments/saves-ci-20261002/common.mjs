import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const DIR = path.join(ROOT, 'experiments/saves-ci-20261002');
export const STAGE = path.join(ROOT, '.campaign');
export const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json')));
export const activeDesignFile = config.campaign === 'diagnostic' ? 'diagnostic-design-seal.json' : 'design-seal.json';
export const activeCellsFile = config.campaign === 'diagnostic' ? 'inputs/diagnostic.json' : 'inputs/cells.json';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
export function gitFile(ref, file) {
  return execFileSync('git', ['show', `${ref}:${file}`], { cwd: ROOT, maxBuffer: 128 * 1024 * 1024 });
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const signature = value => hash(JSON.stringify(canonical(value)));
export function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }).sort();
}
export function assertArtifactBudget(directory, limit = config.artifactPerJobLimitBytes) {
  const files = filesUnder(directory);
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  if (bytes > limit) throw new Error(`Artifact safety gate: ${bytes} > ${limit}; do not upload or discard evidence`);
  return { bytes, limit, files: files.map(file => ({ file: path.relative(directory, file).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(file)) })) };
}
