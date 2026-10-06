import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, digest, verifySources, sha256 } from '../contracts.mjs';
import { validateFixture, fixtureIdentity } from '../../contracts.mjs';
import { validateManifest, PHASES, compileTasks, chunksFor } from './protocol.mjs';

const [prepared, targetFile] = process.argv.slice(2);
assert(prepared&&targetFile,'verify-prepared <prepared-dir> <analysis TARGETS.jsonl>');
const m=validateManifest(readJson(path.join(prepared,'MANIFEST.json'))),entry=readJson(path.join(prepared,'START.json'));
assert.equal(digest(m),entry.manifestHash);verifySources(m.sourceFiles);
const templates=fs.readFileSync(path.join(prepared,'TASKS.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const targets=fs.readFileSync(targetFile,'utf8').trim().split('\n').map(JSON.parse);
let maxCalls=0,jobs=0;const phaseCounts={};
for(const phase of PHASES){const selected=targets.map(f=>f.id),ts=compileTasks(m,templates,phase,selected),chunks=chunksFor(m,templates,phase,selected);
  const calls=ts.reduce((n,t)=>n+t.calls.length,0);maxCalls+=calls;jobs+=chunks.length;phaseCounts[phase]={calls,jobs:chunks.length};
  const ids=ts.flatMap(t=>t.calls.map(c=>c.callId));assert.equal(new Set(ids).size,ids.length);
}
assert.equal(maxCalls,8479);assert.equal(jobs,523);assert((jobs+36)*2.5<=1400);
let verified=0;
for(const target of targets){const bytes=fs.readFileSync(target.source_locator);assert.equal(sha256(bytes),target.fixture_sha256);
  const fixture=validateFixture(JSON.parse(bytes));assert.equal(fixture.id,target.id);assert.equal(fixture.K,target.K);
  assert.equal(fixture.keys.length,target.n);assert.equal(fixture.rows.length,target.R);
  assert.equal(Boolean(fixture.primaryHard),target.primary_hard);
  const command=fixture.origin.command;
  assert.equal(command.clear,4);assert.equal(command.useHold,true);assert.equal(command.exactHumanQuality,'true');
  assert.equal(command.queueLength,command.piecesNeeded+1);assert.equal(command.savedPieceCount,1);
  assert.equal(command.pattern,target.pattern);assert.equal(command.family,target.family);
  // includes original weighted rows, stable universe, K and primary seed
  assert(/^[a-f0-9]{64}$/.test(fixtureIdentity(fixture)));verified++;
  global.gc?.();
}
const report={status:'PREPARED_MANIFEST_INPUT_PROOF_SEED_PAIR_BUDGET_SOURCE_PASS',verifiedFixtureFiles:verified,maxCalls,maxMatrixJobs:jobs,
  reservedControlJobs:36,conservativeRunnerHours:(jobs+36)*2.5,phaseCounts,solverCalls:0,maxRemoteCpSyntheticCalls:4,
  remoteGatesPending:['CP_SYNTHETIC_PREFLIGHT','CANARY','CANARY_INDEPENDENT_AUDIT','CALIBRATION','CALIBRATION_INDEPENDENT_AUDIT'],
  notPerformancePass:true};
fs.writeFileSync(path.join(prepared,'LOCAL_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
