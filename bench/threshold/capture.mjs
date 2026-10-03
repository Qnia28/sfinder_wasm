import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_SHA, sha256 } from './engine.mjs';

const id = process.argv[2], out = resolve(process.argv[3] || `bench/threshold/results/capture/${id}`);
const config = JSON.parse(readFileSync(process.env.THRESHOLD_CAPTURE_CONFIG || new URL('./capture-config.json', import.meta.url)));
const db = JSON.parse(readFileSync(process.env.THRESHOLD_CAPTURE_DB || new URL('./cycle1-setups.json', import.meta.url)));
assert(db.setups.some(s => s.id === id));
assert(!existsSync(resolve(out, 'capture.json')), 'never overwrite a capture');
mkdirSync(out, { recursive: true });
const report = { setupId: id, baseline: BASELINE_SHA, databaseHash: db.sourceSha256,
  node: process.version, runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null, records: [] };
function child(args, timeoutSeconds, name) {
  return new Promise(done => {
    const p = spawn(process.execPath, [fileURLToPath(new URL('./capture-child.mjs', import.meta.url)), ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, error = null;
    const timer = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, timeoutSeconds * 1000);
    p.stdout.on('data', b => { stdout = (stdout + b).slice(-65536); });
    p.stderr.on('data', b => { stderr = (stderr + b).slice(-65536); });
    p.on('error', e => { error = String(e); });
    p.once('close', (code, signal) => {
      clearTimeout(timer);
      const log = { code, signal, timedOut, error, stdout, stderr };
      writeFileSync(resolve(out, `${name}.log.json`), JSON.stringify(log, null, 2));
      done({ status: timedOut ? 'TIMEOUT' : code === 0 && !error ? 'OK' : 'ERROR', ...log });
    });
  });
}
const enumeration = await child(['enumerate', id, out], config.enumerationSeconds, 'enumeration');
report.enumerationStatus = enumeration.status;
if (enumeration.status === 'OK') {
  const captured = JSON.parse(readFileSync(resolve(out, 'enumeration.json')));
  report.enumerationMs = captured.enumerationMs;
  for (const record of captured.records) {
    if (record.status === 'NO_MINIMAL') { report.records.push(record); continue; }
    const primary = await child(['primary', id, out, record.filter, String(config.primarySeconds)],
      config.primarySeconds + 10, `primary-${record.filter}`);
    if (primary.status === 'OK') report.records.push({ ...record,
      ...JSON.parse(readFileSync(resolve(out, `${record.filter}.proof.json`))) });
    else report.records.push({ ...record, status: primary.status === 'TIMEOUT' ? 'PRIMARY_TIMEOUT' :
      /HiGHS cardinality status:.*[Tt]ime/.test(primary.stderr) ? 'PRIMARY_TIMEOUT' : 'PRIMARY_ERROR' });
  }
}
report.buildHash = sha256(readFileSync(new URL('./build/build.json', import.meta.url)));
writeFileSync(resolve(out, 'capture.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
// Expected time limits are censored inputs, not correctness successes. Unexpected
// errors fail the job while preserving logs and all completed filters.
if (enumeration.status === 'ERROR' || report.records.some(r => r.status === 'PRIMARY_ERROR')) process.exitCode = 1;
