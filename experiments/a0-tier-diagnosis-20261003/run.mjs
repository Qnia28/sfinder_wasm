import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import {ROOT,MATRIX_ID,read,write,seal,sha,jsonSha} from './common.mjs';
import {schedule,CAMPAIGN} from './schedule.mjs';
import {Journal,Session} from '../a0-diagnosis-20261003/supervisor.mjs';
class TierSession extends Session{
  constructor(run,options){
    super(MATRIX_ID,'SHARED_PROCESS_FRESH_WORKER',run.trace,{...options,apiMs:30000,processMs:45000,startupMs:45000,auditMs:30000,
      script:'../a0-tier-diagnosis-20261003/launcher.mjs',args:[MATRIX_ID,'SHARED_PROCESS_FRESH_WORKER',run.trace?'1':'0',run.engineMode,run.trace?'1':'0']});
    this.run=run;this.logChain=Promise.resolve();this.logBytes=0;
    for(const [stream,socket]of [['stdout',this.proc.stdout],['stderr',this.proc.stderr]])socket.on('data',b=>{
      this.logBytes+=b.length;if(this.logBytes>4*2**20){this.kill('LOG_LIMIT');return;}
      const record={stream,runId:run.runId,hostEpochMs:performance.timeOrigin+performance.now(),text:b.toString('utf8')};
      this.logChain=this.logChain.then(()=>this.journal.append(`${this.out}/logs/${run.runId}.jsonl`,record)).catch(e=>{this.logFailure=e.stack;this.kill('LOG_PERSISTENCE_ERROR',e);});
    });
  }
  message(m){if(m.type==='worker-ready'||m.type==='engine-ready'){this.events.push(m);return;}super.message(m);}
  async close(){const result=await super.close();await this.logChain;return {...result,...(this.logFailure?{status:'LOG_PERSISTENCE_ERROR',logFailure:this.logFailure}:{}),logBytes:this.logBytes,runId:this.run.runId};}
}
const lock=read(`${ROOT}/.a0/tier/LOCK.json`);assert.equal(sha(fs.readFileSync(`${ROOT}/wasm/pc_wasm.wasm`)),lock.wasmSha256);
assert.equal(process.platform,'linux');delete process.env.A0_TIER_FIXTURE;
const allowed=fs.readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)[1].trim();process.env.A0_WORKER_CPU=allowed.split(/[,-]/)[0];
const out=`${ROOT}/.a0/tier/results`;assert(!fs.existsSync(out));fs.mkdirSync(`${out}/raw`,{recursive:true});fs.mkdirSync(`${out}/logs`);
const journal=new Journal(),start=performance.now(),stop=Number(process.env.A0_COMPUTE_DEADLINE_MS),rows=[],outcomes=[],sessions=[];let active,reason;
assert.equal(stop,Date.parse(CAMPAIGN.originCreated)+CAMPAIGN.computeMinutes*60000);
try{
  for(const run of schedule){
    if(Date.now()+177000>=stop||performance.now()-start+177000>=17*60000){reason='NOT_RUN_BUDGET';break;}
    let failure=null,row=null,closed=null;
    active=new TierSession(run,{journal,out});
    try{await active.ready;row=await active.call(run);rows.push(row);}
    catch(e){failure={message:e.stack,failure:e.failure??null};await journal.append(`${out}/failures.jsonl`,{...run,...failure});}
    closed=await active.close();sessions.push(closed);active=null;
    const status=failure?(closed.status??'ERROR'):closed.status==='CLOSED'&&closed.code===0?'VERIFIED':'ERROR_CLOSE';
    const outcome={...run,status,failure,apiMs:row?.apiMs??null,initMs:row?.initMs??null,session:closed};outcomes.push(outcome);await journal.append(`${out}/outcomes.jsonl`,outcome);
    console.log(JSON.stringify({runId:run.runId,status,apiMs:row?.apiMs,initMs:row?.initMs,threadCpu:row?.threadCpu,profile:row?.profile,logBytes:closed.logBytes}));
    if((status!=='VERIFIED'&&!status.startsWith('TIMEOUT_'))||(!run.trace&&closed.stderr)){reason=status==='VERIFIED'?'UNEXPECTED_STDERR':status;break;}
  }
}catch(e){reason=e.message;await journal.append(`${out}/failures.jsonl`,{message:e.stack});process.exitCode=1;}
finally{
  if(active){sessions.push(await active.close());active=null;}await journal.close();
  const fatal=reason||outcomes.some(o=>o.status!=='VERIFIED');if(fatal)process.exitCode=1;
  write(`${out}/SUMMARY.json`,{status:reason?'PARTIAL':outcomes.length===schedule.length?(fatal?'COMPLETE_WITH_TIMEOUTS':'COMPLETE'):'PARTIAL',stopReason:reason??null,
    expectedCalls:24,attemptedCalls:outcomes.length,verifiedCalls:rows.length,outcomes,sessions,notRun:schedule.slice(outcomes.length),scheduled:schedule,
    lock,lockSha256:jsonSha(lock),runtime:{node:process.version,v8:process.versions.v8,cpu:os.cpus()[0]?.model,cpus:os.cpus().length,allowedCpuList:allowed,workerCpu:process.env.A0_WORKER_CPU,runId:process.env.GITHUB_RUN_ID},
    campaign:CAMPAIGN,clockReset:false,operationalWallMs:performance.now()-start,nativeThresholdCalls:0,actualPrimaryCalls:0,actualPcCalls:0,performanceConfirmationCalls:0});seal(out);
}
