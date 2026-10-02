import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HERE, ROOT, read, write, seal, jsonSha, sha } from './common.mjs';
import { supervised } from './supervisor.mjs';
const [phase, shardArg] = process.argv.slice(2), shard = Number(shardArg);
const build = read(path.join(ROOT, '.a0/build/BUILD.json')), input = read(path.join(HERE, 'INPUTS.json'));
const runs = read(path.join(HERE, 'SCHEDULE.json')).runs.filter(r => r.phase === phase && r.shard === shard);
const deadline = Number(process.env.A0_COMPUTE_DEADLINE_MS);
if (!['smoke', 'reserved'].includes(phase) || !runs.length || !Number.isFinite(deadline)) throw Error('Invalid authorized schedule/deadline');
if (process.version !== 'v24.13.0') throw Error('Node drift');
for (const root of [ROOT, path.join(ROOT, '.a0/baseline')]) if (sha(fs.readFileSync(path.join(root, 'wasm/pc_wasm.wasm'))) !== build.wasmSha256) throw Error('Binary mismatch');
if (phase === 'reserved') {
  const freeze = read(path.join(ROOT, '.a0/freeze/FREEZE.json'));
  if (freeze.buildSha256 !== jsonSha(build) || freeze.status !== 'FROZEN_FOR_RESERVED_NOT_PRODUCT_APPROVAL') throw Error('Candidate not frozen');
}
const out = path.join(ROOT, '.a0/results', `${phase}-${shard}`); if (fs.existsSync(out)) throw Error('Refusing to overwrite route results'); fs.mkdirSync(out, { recursive: true });
const start = performance.now(), ledger = []; let stopReason = null;
try {
  for (const r of runs) {
    if (Date.now() + 77000 >= deadline || performance.now() - start > (phase === 'smoke' ? 25 : 55) * 60000) { stopReason = 'WALL_PRESERVATION_LIMIT'; break; }
    fs.appendFileSync(path.join(out, 'events.jsonl'), JSON.stringify({ type: 'start', utc: new Date().toISOString(), ...r }) + '\n');
    const result = await supervised([r.matrixId, r.variant, phase]);
    const e = input.entries.find(e => e.id === r.matrixId), row = { ...r, ...result, inputSha256: e.sha256, identitySha256: e.identitySha256, buildSha256: jsonSha(build) };
    ledger.push(row); fs.appendFileSync(path.join(out, 'runs.jsonl'), JSON.stringify(row) + '\n');
    console.log(JSON.stringify({ runId: r.runId, status: row.status, routeWallMs: row.routeWallMs, phases: row.trace?.map(p => [p.engine, p.completed, p.states]) }));
  }
  write(path.join(out, 'SHARD.json'), { phase, shard, status: stopReason ? 'PARTIAL' : 'COMPLETE', stopReason, expectedRuns: runs.length, observedRuns: ledger.length, notRun: runs.slice(ledger.length),
    scheduledRuns: runs, scheduleSha256: jsonSha(runs), build, runtime: { node: process.version, v8: process.versions.v8, cpu: os.cpus()[0]?.model, platform: process.platform },
    actualInputPrimaryCalls: 0, actualInputPcCalls: 0, operationalWallMs: performance.now() - start });
} catch (error) { write(path.join(out, 'FAILURE.json'), { message: error.stack, observedRuns: ledger.length }); process.exitCode = 1; }
finally { seal(out); }
