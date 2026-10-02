// Metadata selection and byte-preserving packaging only. No solver calls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { HERE, read, write, sha, jsonSha } from './common.mjs';
const old = path.resolve(process.argv[2]);
const all = read(path.join(old, 'INPUTS.json')).entries;
const eligible = all.filter(e => e.partition === 'development' && e.route === 'INTEGRATED_100K_PROBE_ELIGIBLE');
const ranked = [...eligible].sort((a, b) => sha(`a0-integration-20261003\0smoke\0${a.id}`).localeCompare(sha(`a0-integration-20261003\0smoke\0${b.id}`)));
const large = [...eligible].sort((a, b) => b.E - a.E || a.id.localeCompare(b.id)).slice(0, 4);
const smokeIDs = new Set(large.map(m => m.id));
for (const e of ranked) { if (smokeIDs.size === 16) break; smokeIDs.add(e.id); }
assert.equal(smokeIDs.size, 16);
const reserved = all.filter(e => e.partition === 'reserved-validation');
const entries = [], packs = [];
for (const [name, selected] of [['smoke', all.filter(e => smokeIDs.has(e.id))], ['reserved', reserved]]) {
  const chunks = []; let offset = 0;
  for (const e of selected) {
    const fd = fs.openSync(path.join(old, e.pack), 'r'), bytes = Buffer.alloc(e.length);
    try { assert.equal(fs.readSync(fd, bytes, 0, bytes.length, e.offset), bytes.length); } finally { fs.closeSync(fd); }
    assert.equal(sha(bytes), e.sha256);
    entries.push({ ...e, pack: `inputs/${name}.bin`, offset, sourcePack: e.pack, sourceOffset: e.offset });
    chunks.push(bytes); offset += bytes.length;
  }
  assert(offset < 25 * 2 ** 20); fs.mkdirSync(path.join(HERE, 'inputs'), { recursive: true });
  const file = `inputs/${name}.bin`, bytes = Buffer.concat(chunks); fs.writeFileSync(path.join(HERE, file), bytes, { flag: 'wx' });
  packs.push({ file, bytes: bytes.length, sha256: sha(bytes) });
}
const schedule = [];
for (const [phase, matrices, count] of [['smoke', entries.filter(e => smokeIDs.has(e.id)), 8], ['reserved', entries.filter(e => e.partition === 'reserved-validation' && e.route === 'INTEGRATED_100K_PROBE_ELIGIBLE'), 16]]) {
  matrices.sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < matrices.length; i++) {
    const id = matrices[i].id, p = Number.parseInt(sha(`a0-integration-20261003\0order\0${id}`).slice(0, 2), 16) % 2 ? ['A', 'R'] : ['R', 'A'];
    [p, [...p].reverse(), [...p].reverse(), p].forEach((order, r) => order.forEach((variant, j) => schedule.push({ phase, shard: i % count, matrixId: id, variant, repetition: r + 1, position: j + 1, runId: `${phase}--${id}--${variant}--r${r + 1}` })));
  }
}
assert.equal(schedule.filter(r => r.phase === 'smoke').length, 128); assert.equal(schedule.filter(r => r.phase === 'reserved').length, 832);
const tiny = reserved.filter(e => e.route === 'TINY_LEGACY_EXACT'); assert.equal(tiny.length, 115);
write(path.join(HERE, 'INPUTS.json'), { entries, packs, smokeSelection: 'metadata E-largest4 plus independent hash-ranked fill to16', sourceIndexSha256: jsonSha(read(path.join(old, 'INPUTS.json'))), reservedFreshHoldoutCertified: false });
write(path.join(HERE, 'SCHEDULE.json'), { runs: schedule });
write(path.join(HERE, 'SCOPE.json'), { authorization: '검증까지 완료하고 Dev에 최종 연결하기 전까지 계속 진행', baselineCommit: 'c0cb2a048e7275bfea587d176b1954efff0a8a08', reusedEffectRun: 37016499665, reusedExactCheckRun: 37018994637,
  expectedBaselineRebuildHash: '73224bda4e514a99dfa0b97bc9ee3ada43f723cef84c419fade368045e4847f3', smokeRouteTuples: 128, reservedRouteTuples: 832, maxActualSolverCalls: 1920,
  nativeAlgorithmsChanged: false, fastChanged: false, actualInputPrimaryCalls: 0, actualInputPcCalls: 0, reservedTinyDispatchAudits: 115, globalWallMinutes: 180, computeStopMinutes: 160, maxRunnerHours: 64,
  apiIntegratedMs: 10000, processIntegratedMs: 30000, apiThresholdMs: 30000, processThresholdMs: 45000, thresholdStateCap: 2000000, productThresholdLimitsChanged: false, devApplyAuthorized: false });
console.log(JSON.stringify({ entries: entries.length, smokeMatrices: 16, reservedEligible: 104, reservedTiny: 115, routeTuples: schedule.length, bytes: packs.reduce((n, p) => n + p.bytes, 0), solverCalls: 0 }));
