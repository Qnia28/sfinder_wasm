import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DIR, STAGE, ROOT, config, hash, readJson, writeJson, assertArtifactBudget } from './common.mjs';
import { verifyDesign, runnerSignature, environment, runUnit, journal } from './runner.mjs';

verifyDesign();
const out = path.join(STAGE, 'artifacts/gate'), observations = journal(path.join(out, 'gate.jsonl'));
const checks = [], golden = [];
const deadline = performance.now() + 14 * 60000;
function suite(name, cwd, files, extraEnv = {}) {
  const record = { name, files };
  try {
    const output = execFileSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
      cwd, env: { ...process.env, ...extraEnv }, encoding: 'utf8', timeout: Math.floor(Math.max(1000, deadline - performance.now() - 10000)), maxBuffer: 2 * 1024 * 1024,
    });
    fs.writeFileSync(path.join(out, `${name}.txt`), output); record.status = 'PASS'; record.logHash = hash(output);
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.message}`;
    fs.writeFileSync(path.join(out, `${name}.txt`), output); record.status = 'FAIL'; record.logHash = hash(output);
    checks.push(record); observations.append(record); throw error;
  }
  checks.push(record); observations.append(record);
}
try {
  const shared = readJson(path.join(DIR, 'design/contracts.json')).f0Suites;
  suite('REF-existing-contracts', path.join(STAGE, 'REF'), shared);
  suite('M-new-wasm-regression', path.join(STAGE, 'M'), [...shared, 'tests/saves-direct-mask.test.mjs']);
  suite('A5-parser-delta', path.join(STAGE, 'A5'), ['tests/saves-contract-delta.test.mjs']);
  suite('A4-resource-boundaries', path.join(STAGE, 'A4'), ['tests/saves-cache-bounds.test.mjs']);
  const a6Module = pathToFileURL(path.join(STAGE, 'A6/src/saves-feature.mjs')).href;
  suite('A6-independent-telemetry', ROOT, ['tests/saves-telemetry.test.mjs'], { SAVES_TELEMETRY_MODULE: a6Module });
  const manifest = readJson(path.join(DIR, 'inputs/cells.json'));
  // Minimal oracle signatures before timing; broad/deep/large correctness is
  // additionally checked against serial same-job REF results, not invented goldens.
  const cell = manifest.cells.find(cell => cell.stage === 'anchor' && cell.profile === 'B401');
  for (const variant of ['REF', 'P', 'R', 'M']) {
    const outcome = await runUnit({ variant, cell: { ...cell, temperature: 'cold' }, deadline });
    observations.append({ kind: 'GOLDEN', variant, cell: cell.id, ...outcome });
    assert.equal(outcome.status, 'PASS'); assert.equal(outcome.result.total, 210);
    golden.push({ cell: cell.id, variant, signature: outcome.result.signature });
  }
  assert.equal(new Set(golden.map(row => row.signature)).size, 1);
  const pilot = readJson(path.join(DIR, 'design/pilot.json'));
  for (const id of ['A601', 'A606', 'A612']) {
    const entry = pilot.a6.find(row => row.id === id);
    const cell = { sourceFumen: pilot.boards[entry.board].fumen, pattern: pilot.patterns[entry.pattern].text,
      wantedSave: pilot.wanted[entry.wanted], temperature: entry.temperature, clear: 4, useHold: true };
    const outcome = await runUnit({ variant: 'A6', cell, stats: true, deadline });
    observations.append({ kind: 'STATS_DIAGNOSTIC', id, ...outcome }); assert.equal(outcome.status, 'PASS');
    const stats = outcome.result.stats; assert.ok(stats);
    const keys = ['expandMs', 'prepareMs', 'searchMs', 'aggregateMs', 'evalMs', 'unassignedMs'];
    assert.ok(keys.every(key => Number.isFinite(stats[key]) && stats[key] >= 0));
    assert.ok(keys.reduce((sum, key) => sum + stats[key], 0) <= outcome.result.wallMs + 0.5);
  }
  const seal = { status: 'PASS', config: hash(fs.readFileSync(path.join(DIR, 'config.json'))),
    build: hash(fs.readFileSync(path.join(STAGE, 'BUILD_SEAL.json'))), runner: runnerSignature(),
    design: hash(fs.readFileSync(path.join(DIR, 'design-seal.json'))), variants: readJson(path.join(STAGE, 'variants-attached.json')),
    checks, golden, environment: environment(), oraclePolicy: 'Small independently checked fixture/scalar/packed/direct signatures sealed; remaining timed cells must have identical full ordered-output signatures in the same VM.' };
  writeJson(path.join(out, 'GATE_SEAL.json'), seal); writeJson(path.join(STAGE, 'GATE_SEAL.json'), seal);
  console.log(JSON.stringify({ status: 'PASS', checks, golden }, null, 2));
} catch (error) {
  writeJson(path.join(out, 'GATE_FAILURE.json'), { status: 'FAIL', name: error.name, message: error.message, checks, golden, environment: environment() });
  console.error(error); process.exitCode = 1;
} finally { observations.close(); assertArtifactBudget(out); }
