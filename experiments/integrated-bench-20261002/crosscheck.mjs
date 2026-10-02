import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {HERE,ROOT,read,write,seal,jsonSha} from './common.mjs';
import {supervised} from './supervisor.mjs';
const shard=Number(process.argv[2]),plan=read(path.join(HERE,'launch-crosscheck.json'));
const build=read(path.join(ROOT,'.bench/build/BUILD.json'));
assert.equal(plan.buildSha256,jsonSha(build));
assert.equal(plan.apiTimeoutMs,30000);assert.equal(plan.processTimeoutMs,45000);assert.equal(plan.stateBudget,2000000);
const deadline=Number(process.env.BENCH_COMPUTE_DEADLINE_MS);
assert(Number.isFinite(deadline));
const checks=plan.checks.filter(c=>c.shard===shard),out=path.join(ROOT,'.bench/crosscheck',`${shard}`);
if(fs.existsSync(out))throw Error('Refusing to overwrite independent checks');fs.mkdirSync(out,{recursive:true});
const ledger=[];
let stopReason=null;
try{
 for(const check of checks){
  if(Date.now()+47000>=deadline){stopReason='GLOBAL_WALL_PRESERVATION_LIMIT';break}
  fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify({type:'start',utc:new Date().toISOString(),matrixId:check.matrixId})+'\n');
  const result=await supervised([check.matrixId,'THRESHOLD','crosscheck'],{apiMs:30000,processMs:45000});
  let verdict='INCONCLUSIVE';
  if(result.status==='EXACT')verdict=jsonSha({ids:result.selectedIDs,q:result.qualityRLE})===jsonSha({ids:check.expectedIDs,q:check.expectedQualityRLE})?'VERIFIED_EXACT':'MISMATCH';
  const row={...check,...result,verdict,buildSha256:jsonSha(build),stateBudget:2000000};
  ledger.push(row);fs.appendFileSync(path.join(out,'runs.jsonl'),JSON.stringify(row)+'\n');
  console.log(JSON.stringify({matrixId:check.matrixId,status:result.status,verdict}));
 }
 write(path.join(out,'CHECKS.json'),{shard,expectedChecks:checks.length,observedChecks:ledger.length,stopReason,
  status:stopReason?'PARTIAL':ledger.some(r=>r.verdict==='MISMATCH')?'MISMATCH':ledger.every(r=>r.verdict==='VERIFIED_EXACT')?'PASS':'INCONCLUSIVE',
  notRun:checks.slice(ledger.length),build,planSha256:jsonSha(plan),primaryCalls:0,enumerationCalls:0});
}catch(error){write(path.join(out,'FAILURE.json'),{message:error.stack,observedChecks:ledger.length});process.exitCode=1}
finally{seal(out)}
