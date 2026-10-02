import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {HERE,ROOT,read,jsonSha,sha} from './common.mjs';
test('approved operational chunks preserve every comparison and independent budget',()=>{
 const original=read(path.join(HERE,'SCHEDULE.json')),e=read(path.join(HERE,'EXECUTION_SCHEDULE.json')),approval=read(path.join(HERE,'launch-development.json'));
 assert.equal(e.runs.length,36048);assert.equal(new Set(e.runs.map(r=>r.runId)).size,36048);
 assert.equal(e.chunks.length,32);assert.equal(e.maxParallel,16);assert.equal(e.developmentRunnerHoursCeiling,64);
 assert.equal(e.maxPredictedChunkMinutes<=80,true);assert.equal(e.overallWallLimitMinutes,180);
 assert.equal(approval.executionScheduleSha256,jsonSha(e));
 const groups=new Map();
 for(let i=0;i<original.runs.length;i++){
  const {shard,originalShard,...current}=e.runs[i],{shard:oldShard,...old}=original.runs[i];
  assert.deepEqual(current,old);assert.equal(originalShard,oldShard);
  if(!groups.has(current.matrixId))groups.set(current.matrixId,new Set());groups.get(current.matrixId).add(shard);
 }
 assert.equal(groups.size,1502);for(const shards of groups.values())assert.equal(shards.size,1);
 const plan=read(path.join(HERE,'PLAN.json'));
 assert.equal(plan.supervision.apiCallTimeoutMs,10000);assert.equal(plan.supervision.processTimeoutMs,30000);
});
test('only approved scheduling harness differs from successful pilot; comparator code frozen',()=>{
 const launch=read(path.join(HERE,'launch-development.json'));
 const build=read(path.join(ROOT,'.bench/pilot-frozen/BUILD.json'));
 assert.equal(launch.buildSha256,jsonSha(build));
 for(const source of [...build.candidateSources,...build.measurementHarnessSources]){
  const old=execFileSync('git',['show',`${build.candidateCommit}:${source.file}`],{cwd:ROOT,maxBuffer:32*2**20});assert.equal(sha(old),source.sha256);
  const bytes=fs.readFileSync(path.join(ROOT,source.file));
  const current=/\.(wasm|png|bin)$/.test(source.file)?bytes:Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));
  const exception=launch.harnessExceptions.find(e=>e.file===source.file);
  assert.equal(sha(current),exception?.currentSha256??source.sha256,source.file);
  if(exception)assert.equal(exception.file,'experiments/integrated-bench-20261002/run.mjs');
 }
});
