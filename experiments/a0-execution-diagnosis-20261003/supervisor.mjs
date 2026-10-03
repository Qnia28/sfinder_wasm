import assert from 'node:assert/strict';
import {Session} from '../a0-diagnosis-20261003/supervisor.mjs';
import {MATRIX_ID,jsonSha} from './common.mjs';
import {LIMITS} from './schedule.mjs';
export class ExecutionSession extends Session{
  constructor(run,options){
    super(MATRIX_ID,'SHARED_PROCESS_FRESH_WORKER',run.profile,{...options,apiMs:LIMITS.apiMs,processMs:LIMITS.processMs,startupMs:LIMITS.startupMs,auditMs:LIMITS.auditMs,
      script:'../a0-execution-diagnosis-20261003/launcher.mjs',args:[MATRIX_ID,'SHARED_PROCESS_FRESH_WORKER',run.profile?'1':'0','DEFAULT',run.profile?'1':'0']});
    this.run=run;this.logChain=Promise.resolve();this.logBytes=0;
    const send=this.proc.send.bind(this.proc);
    this.proc.send=(m,...a)=>{
      if(m.type==='ack'&&run.profile){this.exportStarted=true;this.exportTimer=setTimeout(()=>this.kill('TIMEOUT_PROFILE_EXPORT'),LIMITS.profileExportMs);}
      return send(m,...a);
    };
    this.proc.on('close',()=>clearTimeout(this.exportTimer));
    for(const [stream,socket]of [['stdout',this.proc.stdout],['stderr',this.proc.stderr]])socket.on('data',b=>{
      this.logBytes+=b.length;if(this.logBytes>4*2**20){this.kill('LOG_LIMIT');return;}
      const record={stream,runId:run.runId,hostEpochMs:performance.timeOrigin+performance.now(),text:b.toString('utf8')};
      this.logChain=this.logChain.then(()=>this.journal.append(`${this.out}/logs/${run.runId}.jsonl`,record)).catch(e=>{this.logFailure=e.stack;this.kill('LOG_PERSISTENCE_ERROR',e);});
    });
  }
  message(m){
    if(m.type==='worker-ready'||m.type==='engine-ready'){this.events.push(m);return;}
    if(m.type==='profile-result'){
      const c=this.current;
      if(!c||c.run.runId!==m.runId||!c.raw||!this.exportStarted||this.profileReceived){this.kill('PROFILE_PROTOCOL');return;}
      this.profileReceived=true;
      this.chain=this.chain.then(async()=>{
        assert.equal(jsonSha(m.data),m.record.profileSha256);await this.journal.append(`${this.out}/profiles/${m.runId}.jsonl`,m);
        clearTimeout(this.exportTimer);this.profilePersisted=true;this.proc.send({type:'profile-ack',runId:m.runId});
      }).catch(e=>this.kill('PROFILE_PERSISTENCE_ERROR',e));return;
    }
    if(m.type==='audit-result'&&this.run.profile&&!this.profilePersisted){this.kill('AUDIT_BEFORE_PROFILE');return;}
    super.message(m);
  }
  async close(){const result=await super.close();await this.logChain;return {...result,...(this.logFailure?{status:'LOG_PERSISTENCE_ERROR',logFailure:this.logFailure}:{}),logBytes:this.logBytes,runId:this.run.runId};}
}
