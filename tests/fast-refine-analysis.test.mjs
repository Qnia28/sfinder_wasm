import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest } from '../tools/fast-bench/planner.mjs';
import { hash } from '../tools/secondary-bench/contracts.mjs';
import { seal } from '../tools/secondary-bench/common/evidence.mjs';

test('offline audit permits E2E seed/quality variation and censoring, rejects missing or invalid evidence', async t => {
  for (const variant of ['valid', 'missing', 'bad-witness']) await t.test(variant, async t => {
    const temp = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir();
    const root = fs.mkdtempSync(path.join(temp, 'refine-analysis-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const planRoot = path.join(root, 'plan'), shards = path.join(root, 'shards'), dir = path.join(shards, 'fast-refine-shard-0');
    fs.mkdirSync(planRoot); fs.mkdirSync(dir, { recursive: true });
    const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
    const study = 'synthetic-refine', tasks = [], records = [];
    for (let index = 0; index < 2; index++) {
      const command = { id: 'synthetic-' + index, population: 'ALL' };
      const calls = ['reference', 'candidate'].map((implementation, order) => ({
        callId: digest([command.id, implementation]), commandId: command.id, phase: 'e2e', implementation,
        policy: 'BASE100', repeat: 0, order, diagnostics: 'timing',
      }));
      tasks.push({ index, shard: 0, command, calls });
      const fixture = { id: command.id + '/ALL', K: 1, keys: ['a', 'b'], rows: [[[0, 1], [1, 2]]], seed: [0] };
      const bytes = gzipSync(JSON.stringify(fixture)), inputRoot = path.join(dir, 'input-' + index);
      fs.mkdirSync(inputRoot); fs.writeFileSync(path.join(inputRoot, 'input.gz'), bytes);
      const ref = { id: fixture.id, filter: 'ALL', K: 1, status: 'CAPTURED', member: 'input.gz', sha256: hash(bytes) };
      records.push({ commandId: command.id, phase: 'capture', callId: digest([study, command.id, 'capture']), job: {},
        execution: { status: 'CAPTURED', reaped: true, result: { filters: [ref] } } });
      for (const implementation of ['reference', 'candidate']) records.push({
        commandId: command.id, fixtureId: ref.id, phase: 'replay', implementation,
        callId: digest([study, ref.id, 'replay', implementation]), job: {},
        execution: { status: 'RETURNED', reaped: true, result: { seed: [0], refineMs: 1,
          result: { selected: [0], qualityVector: [1], passes: 0 } } },
      });
      for (const c of calls) {
        if (variant === 'missing' && index === 0 && c.implementation === 'candidate') continue;
        const candidate = c.implementation === 'candidate', censored = index === 1 && candidate;
        records.push({ ...c, job: { command, arm: c.policy, filters: [ref] }, execution: {
          status: censored ? 'TIMEOUT_CALL' : 'RETURNED_APPROX', reaped: true,
          result: censored ? null : { policyMs: candidate ? 5 : 10, apiMs: candidate ? 4 : 9, outcomes: { ALL: {
            K: 1, keys: [candidate ? 'b' : 'a'], qualityVector: [candidate ? variant === 'bad-witness' ? 99 : 2 : 1],
            primaryResolved: candidate ? 'ortools' : 'rust', qualityExact: false, witnessAudit: 'PASS',
          } } },
        } });
      }
    }
    const plan = { study, tasks }, lock = { runId: 'synthetic', scheduleHash: digest(tasks) };
    write(planRoot, 'PLAN.json', plan); write(planRoot, 'LOCK.json', lock); await seal(planRoot, { phase: 'plan' });
    write(dir, 'LOCK.json', lock);
    write(dir, 'SUMMARY.json', { shard: 0, runId: lock.runId, scheduleHash: lock.scheduleHash, completed: records });
    fs.writeFileSync(path.join(dir, 'raw.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'starts.jsonl'), records.map(r => JSON.stringify({ callId: r.callId, job: r.job })).join('\n') + '\n');
    await seal(dir, { shard: 0 });
    const output = path.join(root, 'analysis');
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/fast-refine/analyze.mjs', import.meta.url)), planRoot, shards, output], { encoding: 'utf8' });
    if (variant === 'valid') {
      assert.equal(run.status, 0, run.stderr);
      const summary = JSON.parse(fs.readFileSync(path.join(output, 'SUMMARY.json')));
      assert.equal(summary.status, 'COMPLETE'); assert.equal(summary.allStatuses.TIMEOUT_CALL, 1);
      assert.equal(summary.qualityCounts.BASE100.BETTER, 1); assert.equal(summary.checks.sameSeedPass, 2);
      assert.equal(summary.timing['ALL:BASE100'].completeCommands, 1);
    } else assert.notEqual(run.status, 0, 'invalid evidence must not pass');
  });
});
