import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { distribution, qualityDifference } from '../tools/fast-triage/analysis.mjs';
import { seal } from '../tools/secondary-bench/common/evidence.mjs';
import { digest } from '../tools/fast-bench/planner.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';

test('quality degradation magnitude uses actual original rows, separate from proof loss', () => {
  const f = { keys: ['a', 'b'], rows: [[[0, 2], [1, 1]], [[0, 2], [1, 4]], [[0, 5], [1, 3]]] };
  const base = { K: 1, keys: ['a'], qualityVector: [2, 2, 5], qualityExact: true };
  const candidate = { K: 1, keys: ['b'], qualityVector: [1, 3, 4], qualityExact: false };
  assert.deepEqual(qualityDifference(base, candidate, f), { relation: 'WORSE', firstSortedDifference: 0,
    baselineAtDifference: 2, candidateAtDifference: 1, proofLost: true, proofGained: false,
    lowerRows: 2, higherRows: 1, lowerMagnitude: 3, higherMagnitude: 2 });
  assert.equal(distribution([1, 3, 2, 4]).median, 2.5);
});

test('offline analyzer retains timeout denominator, raw quality and feature timing', async () => {
  const temp = path.join(os.tmpdir(), 'opencode'); fs.mkdirSync(temp, { recursive: true });
  const root = fs.mkdtempSync(path.join(temp, 'fast-triage-analysis-'));
  const output = path.join(root, 'analysis');
  const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  try {
    const index = path.join(root, 'fast-analysis-index-1'), delta = path.join(root, 'fast-measure-0-delta-0-2'), input = path.join(root, 'fast-input-0-3');
    for (const dir of [index, delta, input]) fs.mkdirSync(dir);
    const fixture = { keys: ['a', 'b'], rows: [[[0, 2], [1, 1]]], K: 1 };
    const bytes = gzipSync(JSON.stringify(fixture)); fs.writeFileSync(path.join(input, 'fixture.gz'), bytes);
    const schedule = [], records = [], raws = [];
    for (let repeat = 0; repeat < 3; repeat++) for (const arm of ['BASE100', 'U192']) {
      const callId = `${arm}-${repeat}`, timeout = repeat === 2 && arm === 'U192';
      const call = { callId, commandId: 'x', phase: 'e2e', repeat, arm, diagnostics: 'timing' };
      const outcome = { K: 1, keys: [arm === 'BASE100' ? 'a' : 'b'], qualityVector: [arm === 'BASE100' ? 2 : 1], qualityExact: arm === 'BASE100',
        fastTelemetry: { stages: [{ name: 'features', ms: .1 }] } };
      schedule.push(call); records.push({ ...call, status: timeout ? 'TIMEOUT_CALL' : 'RETURNED_APPROX', policyMs: timeout ? null : arm === 'BASE100' ? 10 : 8,
        outcomes: timeout ? null : { ALL: outcome } });
      raws.push({ ...call, execution: { result: timeout ? null : { outcomes: { ALL: outcome } } } });
    }
    fs.writeFileSync(path.join(delta, 'raw.jsonl'), raws.map(r => JSON.stringify(r)).join('\n') + '\n');
    const sealed = await seal(delta, { runId: '1', name: 'test' });
    const plan = { study: 'fast-triage-e2e-20261017', schedule, chunks: [{ tasks: [{ command: { id: 'x', population: 'ALL', mirrorGroup: 'g' } }] }],
      selection: { main: [{ id: 'x/ALL', member: 'fixture.gz', sha256: hash(bytes), features: { S: 2 }, inputArtifact: { name: 'fast-input-0', id: 3 } }] } };
    write(index, 'PLAN.json', plan);
    write(index, 'AUDIT.json', { runId: '1', status: 'COLLECTION_COMPLETE', scheduleHash: digest(schedule), observed: 6, expected: 6, missing: [],
      statuses: { RETURNED_APPROX: 5, TIMEOUT_CALL: 1 }, artifactIndex: [{ name: 'fast-measure-0-delta-0', id: 2, checkpointId: sealed.checkpointId }] });
    fs.writeFileSync(path.join(index, 'calls.jsonl.gz'), gzipSync(records.map(r => JSON.stringify(r)).join('\n')));
    await seal(index, { runId: '1', name: 'test' });
    execFileSync(process.execPath, ['tools/fast-triage/analyze.mjs', root, output], { encoding: 'utf8' });
    const result = JSON.parse(fs.readFileSync(path.join(output, 'SUMMARY.json')));
    assert.equal(result.timing['ALL:U192'].pairedComplete3, 0);
    assert.equal(result.timing['ALL:U192'].missingOrCensored, 1);
    assert.equal(result.losses.length, 2); assert.equal(result.proofLosses.length, 2);
    assert.equal(result.filterStageCosts['ALL:BASE100:features'].n, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
