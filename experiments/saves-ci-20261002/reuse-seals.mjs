import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIR, STAGE, config, readJson, writeJson, hash, activeDesignFile, assertArtifactBudget } from './common.mjs';
import { verifyDesign, runnerSignature, environment } from './runner.mjs';

assert.equal(config.campaign, 'diagnostic'); verifyDesign();
const mode = process.argv[2], prior = path.resolve(process.argv[3]);
if (mode === 'build') {
  const priorFile = path.join(prior, 'BUILD_SEAL.json'), old = readJson(priorFile);
  assert.equal(hash(fs.readFileSync(priorFile)), config.reuseBuildSeal);
  const source = readJson(path.join(STAGE, 'variants.json'));
  assert.deepEqual(old.variants, source, 'Source overlay changed; old build cannot be reused');
  const out = path.join(STAGE, 'artifacts/build'); fs.mkdirSync(out, { recursive: true });
  for (const variant of ['R', 'M']) {
    const bytes = fs.readFileSync(path.join(prior, `${variant}.wasm`)); assert.equal(hash(bytes), old.wasm[variant]);
    fs.writeFileSync(path.join(out, `${variant}.wasm`), bytes);
  }
  writeJson(path.join(out, 'BUILD_SEAL.json'), { ...old, config: hash(fs.readFileSync(path.join(DIR, 'config.json'))),
    design: hash(fs.readFileSync(path.join(DIR, activeDesignFile))),
    reuse: { originalRun: config.reuseRun, originalCommit: config.reuseRunCommit, originalBuildSeal: config.reuseBuildSeal,
      reusedIdenticalWasm: true, freshCompileExecuted: false, priorNativeTests: '73 pass; successful original build job checked by preflight' } });
  assertArtifactBudget(out);
  console.log('Verified immutable source and reused the exact Linux R/M WASM bytes; no rebuild or native-suite replay.');
} else if (mode === 'gate') {
  const priorFile = path.join(prior, 'GATE_SEAL.json'), old = readJson(priorFile);
  assert.equal(hash(fs.readFileSync(priorFile)), config.reuseGateSeal); assert.equal(old.status, 'PASS');
  assert.equal(old.build, config.reuseBuildSeal);
  assert.deepEqual(old.variants, readJson(path.join(STAGE, 'variants-attached.json')), 'Candidate JS/WASM/pack changed; correctness evidence cannot be reused');
  const gate = { ...old, config: hash(fs.readFileSync(path.join(DIR, 'config.json'))), design: hash(fs.readFileSync(path.join(DIR, activeDesignFile))),
    build: hash(fs.readFileSync(path.join(STAGE, 'BUILD_SEAL.json'))), runner: runnerSignature(), environment: environment(),
    reuse: { originalRun: config.reuseRun, originalGateSeal: config.reuseGateSeal, identicalSourceWasmPack: true,
      correctnessSuitesReplayed: false, proof: 'Successful prior-run commit and original gate seal pinned; no candidate/input mutation.',
      newRunnerGate: 'Child supervision synthetic tests + immutable subset/design verification + per-unit full ordered-output equality' } };
  const out = path.join(STAGE, 'artifacts/gate');
  writeJson(path.join(out, 'GATE_SEAL.json'), gate); writeJson(path.join(STAGE, 'GATE_SEAL.json'), gate);
  assertArtifactBudget(out);
  console.log('Reused unchanged candidate correctness evidence; new runner/config/subset separately sealed.');
} else throw new Error('Expected build or gate reuse mode');
