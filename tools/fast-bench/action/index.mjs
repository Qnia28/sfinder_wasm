import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { publishPayloads } from '../transport.mjs';
import { verifySnapshot } from '../../secondary-bench/common/evidence.mjs';

const root = path.resolve('fast-preflight');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'LOCK.json'), 'utf8'));
assert.equal(lock.runId, process.env.SOURCE_RUN_ID);
const contract = JSON.parse(fs.readFileSync(path.join(root, 'CONTRACT_RESULT.json'), 'utf8'));
assert.equal(contract.status, 'PASS'); assert.equal(contract.calls, 30);
const payloads = [0, 1, 2].map(shard => {
  const directory = path.join(root, 'payload-' + shard), snapshot = verifySnapshot(directory);
  assert.equal(snapshot.identity.runId, lock.runId); assert.equal(snapshot.identity.shard, shard);
  return { directory, receiptFile: path.join(root, `receipt-${shard}.json`),
    name: `fast-preflight-payload-${shard}`, identity: snapshot.identity, retry: true };
});
const client = (await import('../../secondary-bench/artifact-action/node_modules/@actions/artifact/lib/artifact.js')).default;
const result = await publishPayloads(client, payloads);
fs.writeFileSync(path.join(root, 'TRANSPORT_RECOVERY.json'), JSON.stringify({
  sourceRunId: lock.runId, transportRunId: process.env.GITHUB_RUN_ID,
  solverCalls: 0, result }, null, 2), { flag: 'wx' });
const text = `## Fast transport recovery ${result.status}\nSource contracts: run ${lock.runId}, 30 PASS; additional solver calls: 0.\n`
  + result.results.map(r => `- ${r.name}: ${r.status}, ${r.transportMs.toFixed(0)}ms; ${r.receipt?.attempts.at(-1).error ?? 'receipt saved'}`).join('\n');
console.log(text); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
assert.equal(result.status, 'ALL_DURABLE');
fs.appendFileSync(process.env.GITHUB_OUTPUT, 'artifact-ids=' + result.results.map(r => r.receipt.attempts.at(-1).artifactId).join(',') + '\n');
