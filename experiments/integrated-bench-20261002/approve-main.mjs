// Prepare approved chunk schedule without changing comparator inputs/options.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {HERE,ROOT,read,write,sha,jsonSha} from './common.mjs';
const [pilotDir,auditFile]=process.argv.slice(2).map(p=>path.resolve(p));
const proposal=read(path.join(HERE,'MAIN_CHUNK_PROPOSAL.json'));
const original=read(path.join(HERE,'SCHEDULE.json'));
const build=read(path.join(pilotDir,'bench-build/BUILD.json'));
const summary=read(path.join(pilotDir,'bench-pilot-summary/SUMMARY.json'));
const audit=read(auditFile);
assert.equal(audit.witnessAndProvenanceAuditStatus,'PASS');
assert.equal(audit.scheduleComplete,true);
const map=new Map();for(const c of proposal.chunks)for(const id of c.matrixIds){assert(!map.has(id));map.set(id,c.chunk)}
assert.equal(map.size,1502);assert.equal(proposal.chunks.length,32);
const runs=original.runs.map(r=>({...r,originalShard:r.shard,shard:map.get(r.matrixId)}));
assert(runs.every(r=>Number.isInteger(r.shard)));assert.equal(runs.length,36048);
const execution={schema:'integrated-bench-approved-chunks-v1',originalScheduleSha256:jsonSha(original),runs,
 chunks:proposal.chunks,maxParallel:16,jobTimeoutMinutes:120,developmentRunnerHoursCeiling:64,
 overallWallLimitMinutes:180,computeStopMinutesFromRunCreation:160,mainExpectedCalls:36048,
 maxPredictedChunkMinutes:proposal.maxPredictedChunkMinutes,callBudgetsUnchanged:true};
write(path.join(HERE,'EXECUTION_SCHEDULE.json'),execution);
const harnessExceptions=build.measurementHarnessSources.filter(s=>s.file.endsWith('/run.mjs')).map(s=>({
 file:s.file,pilotSha256:s.sha256,currentSha256:null,
 reason:'Scheduling/deadline supervision only; engine-worker, sample, supervisor and comparator Rust unchanged',
}));
// Hash Git-normalized LF bytes, not Windows worktree CRLF.
for(const exception of harnessExceptions){
 const bytes=fs.readFileSync(path.join(ROOT,exception.file));
 exception.currentSha256=sha(Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')));
}
write(path.join(HERE,'launch-development.json'),{phase:'development',pilotRun:37005113356,
 userAuthorization:'최대 3시간까지 허용함. 그대로 64로 진행하라',
 developmentRunnerHoursCeiling:64,overallWallLimitMinutes:180,computeStopMinutesFromRunCreation:160,
 pilotOriginalMainEntryGate:false,approvedResharding:true,executionScheduleSha256:jsonSha(execution),
 pilotSummarySha256:sha(fs.readFileSync(path.join(pilotDir,'bench-pilot-summary/SUMMARY.json'))),
 correctnessSha256:sha(fs.readFileSync(path.join(pilotDir,'bench-correctness/CORRECTNESS.json'))),
 buildSha256:jsonSha(build),independentPilotAuditStatus:audit.status,independentPilotAudit:audit,
 harnessExceptions,inputFlagsSeedsUnchanged:true,noMainChanges:true});
console.log(JSON.stringify({chunks:32,runs:runs.length,maxPredictedChunkMinutes:execution.maxPredictedChunkMinutes,
 runnerHoursCeiling:64,overallWallLimitMinutes:180,benchmarkCallsStarted:0}));
