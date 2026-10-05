// Only this recipe knows legacy F/A names and template layouts. No dispatch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { digest, sha256, readJson, writeJson, filesUnder, sourceBytes } from '../contracts.mjs';
import { PROFILE, resolveManifest } from '../manifest.mjs';

export function commonSources(legacySources) {
  const product = {}, harness = {};
  for (const [file, hash] of Object.entries(legacySources)) {
    if (/^(src|wasm|rust)\//.test(file) || ['package.json', 'package-lock.json', '.gitattributes'].includes(file)) product[file] = hash;
    else harness[file] = hash;
  }
  for (const file of [...filesUnder('tools/secondary-bench/common').filter(f => /\.(mjs|yml|py)$/.test(f)),
    ...filesUnder('.github/workflows').filter(f => /secondary-bench-common-.*\.yml$/.test(f)),
    ...filesUnder('tests').filter(f => /secondary-bench-common.*\.mjs$/.test(f))]) {
    const name = file.replaceAll('\\', '/'); harness[name] = sha256(sourceBytes(name));
  }
  return { product, harness };
}
export function convertFollowup(templateFile, outputDir) {
  assert(!fs.existsSync(outputDir), 'new recipe output required');
  const p = readJson(templateFile), refs = [];
  if (p.reusedBundle) {
    const bytes = fs.readFileSync(p.reusedBundle.file); assert.equal(sha256(bytes), p.reusedBundle.sha256);
    const packed = JSON.parse(gunzipSync(bytes));
    assert.equal(packed.originalCaptureSourceLock, p.reusedBundle.originalCaptureSourceLock);
    const expected = new Map(p.reusedBundle.fixtures.map(f => [f.id, f.sha256]));
    for (const f of packed.imported) {
      const data = Buffer.from(f.bytesBase64, 'base64'); assert.equal(sha256(data), expected.get(f.id));
      const file = path.join(outputDir, 'fixtures', sha256(data) + '.json');
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data, { flag: 'wx' });
      refs.push({ id: f.id, file: file.replaceAll('\\', '/'), sha256: sha256(data), acquisition: 'ORIGINAL_CAPTURE_REUSED',
        provenance: { originalFile: f.originalFile, originalSourceLock: packed.originalCaptureSourceLock } });
    }
  }
  const m = resolveManifest({ schemaVersion: 1, campaignId: p.campaignId, revision: 1, purpose: 'information', approval: null,
    profile: PROFILE.id, sourceFiles: commonSources(p.sourceFiles),
    inputs: { commands: p.commands, fixtures: refs, diagnostics: p.boxPreflight ?? [],
      recovery: p.recovery.map(c => {
        const proof = { ...c };
        if (fs.existsSync(c.rawFile)) {
          const line = fs.readFileSync(c.rawFile, 'utf8').split(/\r?\n/)[c.rawLine - 1];
          assert.equal(sha256(line), c.rawLineSha256); proof.rawLineBase64 = Buffer.from(line).toString('base64');
        }
        return { inputId: c.inputId, engine: c.engine, repeat: c.repeat,
          limits: { startupMs: 10000, callMs: 300000, reapMs: 5000 }, proof };
      }) },
    selection: { id: p.fixtureSelection === 'ALL_NONTRIVIAL' ? 'all-nontrivial-v1' : 'hash-one-per-command-v1', supplementIds: p.supplementIds },
    repeats: { initial: p.initialRepeats, additional: p.retestRepeats, threshold: p.retestThreshold, seed: p.scheduleSeed, order: 'six-engine-orders-v1' },
    limits: { secondary: p.limits, capture: p.captureLimits, phases: p.capturePhaseLimits,
      diagnostic: { startupMs: 10000, callMs: 120000, reapMs: 5000 } },
    budget: { maxParallel: p.policy.maxParallel, overallMs: p.policy.overallMs, maxCalls: p.commands.length + (p.boxPreflight?.length ?? 0)
      + p.recovery.length + (p.commands.length + p.supplementIds.length) * 3 * (p.initialRepeats + p.retestRepeats),
      job: Object.fromEntries(Object.entries(p.shape).filter(([key]) => key !== 'taskMinutes')) },
    provenance: { role: 'development', exposures: ['LEGACY_RESERVE_EXPOSED_NOT_FRESH'],
      legacyTemplate: templateFile, legacyTemplateSha256: sha256(fs.readFileSync(templateFile)), legacyContinuation: p.continuation ?? null },
    analysis: 'INFORMATION_ONLY' });
  writeJson(path.join(outputDir, 'MANIFEST.json'), m);
  const equivalence = { schemaVersion: 1, state: 'OFFLINE_CONVERSION_NOT_LAUNCHED', legacyTemplate: templateFile,
    manifestHash: digest(m), commandsIdentical: digest(m.inputs.commands) === digest(p.commands),
    limitsIdentical: digest(m.limits.secondary) === digest(p.limits), repeatsIdentical: m.repeats.initial === p.initialRepeats && m.repeats.additional === p.retestRepeats,
    policyIdentical: m.budget.maxParallel === p.policy.maxParallel && m.budget.overallMs === p.policy.overallMs,
    jobShapeIdentical: Object.entries(m.budget.job).every(([k, v]) => p.shape[k] === v),
    diagnosticReservation: 'COMMON_WORST_CALL_INCLUDES_SCOPE_OVERHEAD; LEGACY_DIAGNOSTIC_USED_150000_FIXED',
    recoveryProofsPortable: m.inputs.recovery.every(r => Boolean(r.proof.rawLineBase64)),
    continuation: 'NOT_AUTOMATICALLY_MIGRATED; EXPLICIT_PARENT_LOCK_AND_COMPLETE_HISTORY_REQUIRED',
    campaignAdmission: 'FINAL_TRANSPORT_AND_AUDIT_RESERVED_EXPLICITLY' };
  writeJson(path.join(outputDir, 'EQUIVALENCE.json'), equivalence); return m;
}
