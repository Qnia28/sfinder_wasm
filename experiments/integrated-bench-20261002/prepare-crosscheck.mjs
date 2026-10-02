// Select only exact candidate results lacking a normal baseline exact witness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,read,write,jsonSha,sha} from './common.mjs';
const [summaryDir,mainRunArg]=process.argv.slice(2),mainRun=Number(mainRunArg);
assert(Number.isSafeInteger(mainRun));
const summary=read(path.join(summaryDir,'SUMMARY.json'));
assert.equal(summary.runCount,36048);assert.equal(summary.status,'PASS');
const rows=fs.readFileSync(path.join(summaryDir,'ALL_RUNS.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
const groups=new Map();for(const r of rows){if(!groups.has(r.matrixId))groups.set(r.matrixId,[]);groups.get(r.matrixId).push(r)}
const checks=[];
for(const [id,records]of groups){
 const baseline=records.filter(r=>['H0','P0'].includes(r.variant)&&r.status==='EXACT');
 const candidate=records.filter(r=>['P','PD','PC','PDC'].includes(r.variant)&&r.status==='EXACT');
 if(baseline.length||!candidate.length)continue;
 const first=candidate[0];
 assert(candidate.every(r=>jsonSha({ids:r.selectedIDs,q:r.qualityRLE})===jsonSha({ids:first.selectedIDs,q:first.qualityRLE})));
 checks.push({matrixId:id,expectedIDs:first.selectedIDs,expectedQualityRLE:first.qualityRLE,candidateVariants:[...new Set(candidate.map(r=>r.variant))]});
}
checks.sort((a,b)=>a.matrixId<b.matrixId?-1:1);assert(checks.length<=1502);
const plan={phase:'development-exact-crosscheck',mainRun,sourceSummarySha256:sha(fs.readFileSync(path.join(summaryDir,'SUMMARY.json'))),
 sourceResultsSha256:sha(fs.readFileSync(path.join(summaryDir,'ALL_RUNS.jsonl'))),buildSha256:jsonSha(summary.build),
 pilotRun:37005113356,apiTimeoutMs:30000,processTimeoutMs:45000,stateBudget:2000000,
 maxParallel:16,overallWallLimitMinutes:180,computeStopMinutesFromMainCreation:160,
 checks:checks.map((c,i)=>({...c,shard:i%16})),repeatCount:1,unlimitedIntegrated:false,retuning:false};
write(path.join(HERE,'launch-crosscheck.json'),plan);console.log(JSON.stringify({checks:checks.length,mainRun,realSolverCalls:0}));
