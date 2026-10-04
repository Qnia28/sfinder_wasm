import fs from 'node:fs';
import path from 'node:path';
import {spawn,fork,execFileSync} from 'node:child_process';
import {HERE,ROOT} from './common.mjs';
let serial=0;
export class Journal{
  constructor(){this.pending=new Map();this.child=fork(`${HERE}/writer.mjs`,[],{cwd:ROOT,stdio:['ignore','ignore','pipe','ipc']});this.child.on('message',m=>{const p=this.pending.get(m.token);if(p){clearTimeout(p.timer);this.pending.delete(m.token);p.resolve();}else if(m.type==='error')this.fail(Error(m.message));});this.child.on('error',e=>this.fail(e));this.child.on('exit',code=>{if(code||this.pending.size)this.fail(Error('Journal writer exit'));});}
  fail(e){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();}
  append(file,value){return new Promise((resolve,reject)=>{const token=`${process.pid}-${serial++}`,timer=setTimeout(()=>{this.pending.delete(token);reject(Error('Durable writer ACK exceeded10s'));},10000);this.pending.set(token,{resolve,reject,timer});this.child.send({type:'write',file,value,token});});}
  async close(){this.child.send({type:'close'});await new Promise(resolve=>this.child.once('exit',resolve));}
}
export class Session{
  constructor(id,mode,profile,{journal,out,apiMs=10000,processMs=30000,startupMs=30000,auditMs=30000,script='session.mjs',args=null}={}){
    Object.assign(this,{journal,out,apiMs,processMs,startupMs,auditMs,mode,current:null,chain:Promise.resolve(),terminal:null});
    const parent=process.env.A0_CGROUP_ROOT;if(process.platform==='linux'&&!parent)throw Error('Hosted cgroup root missing');
    this.cg=parent?path.join(parent,`session-${process.pid}-${serial++}`):null;
    if(this.cg){execFileSync('sudo',['-n','mkdir',this.cg]);execFileSync('sudo',['-n','sh','-c',`echo 3221225472 > '${this.cg}/memory.max'; echo 0 > '${this.cg}/memory.swap.max'`]);}
    let cmd=process.execPath,argv=[`${HERE}/${script}`,...(args??[id,mode,profile?'1':'0'])];
    if(this.cg){cmd='/bin/bash';argv=['-c',`sudo -n sh -c "echo $$ > '$A0_CHILD_CGROUP/cgroup.procs'" || exit 99; exec "$@"`,'a0',process.execPath,...argv];}
    this.proc=spawn(cmd,argv,{cwd:ROOT,env:{...process.env,A0_CHILD_CGROUP:this.cg??''},detached:process.platform==='linux',stdio:['ignore','pipe','pipe','ipc']});
    this.stderr='';this.events=[];this.started=performance.now();
    this.ready=new Promise((resolve,reject)=>{this.readyResolve=resolve;this.readyReject=reject;});
    this.closed=new Promise(resolve=>this.closeResolve=resolve);
    this.startupTimer=setTimeout(()=>this.kill('TIMEOUT_STARTUP'),startupMs);
    this.proc.stderr.on('data',b=>{this.stderr+=b;if(this.stderr.length>2**20)this.kill('LOG_LIMIT');});
    this.proc.on('error',e=>this.kill('SPAWN_ERROR',e));
    this.proc.on('message',m=>this.message(m));
    this.proc.on('close',(code,signal)=>{
      clearTimeout(this.startupTimer);clearTimeout(this.reapTimer);this.clearCallTimers();
      const resources=this.resources();if(this.cg)execFileSync('sudo',['-n','rmdir',this.cg]);
      if(resources.cgroupEvents?.oom_kill)this.terminal='OOM';
      if(resources.cgroupCurrentBytes>64*2**20)this.terminal='ERROR_REAP_MEMORY';
      const failure={status:this.terminal??(code?'ERROR_EXIT':'CLOSED'),code,signal,stderr:this.stderr,resources,killToCloseMs:this.killAt?performance.now()-this.killAt:null,sessionWallMs:performance.now()-this.started};
      if(this.current)this.current.reject(Object.assign(Error(failure.status),{failure}));
      if(!this.isReady)this.readyReject(Object.assign(Error(failure.status),{failure}));this.closeResolve(failure);
    });
  }
  resources(){if(!this.cg)return {localWithoutCgroup:true};return {cgroupPeakBytes:Number(fs.readFileSync(`${this.cg}/memory.peak`,'utf8')),cgroupCurrentBytes:Number(fs.readFileSync(`${this.cg}/memory.current`,'utf8')),memoryMaxBytes:Number(fs.readFileSync(`${this.cg}/memory.max`,'utf8')),swapMaxBytes:Number(fs.readFileSync(`${this.cg}/memory.swap.max`,'utf8')),cgroupEvents:Object.fromEntries(fs.readFileSync(`${this.cg}/memory.events`,'utf8').trim().split('\n').map(l=>{const [k,v]=l.split(' ');return [k,Number(v)];}))};}
  clearCallTimers(){for(const name of ['apiTimer','processTimer','auditTimer','callStartupTimer','probeTimer'])clearTimeout(this[name]);}
  kill(reason,error){if(this.terminal)return;this.terminal=reason;this.killAt=performance.now();this.events.push({type:'kill',reason,error:error?.stack});this.clearCallTimers();clearTimeout(this.startupTimer);try{if(process.platform==='linux')process.kill(-this.proc.pid,'SIGKILL');else this.proc.kill('SIGKILL');}catch(e){this.stderr+=e.stack;}this.reapTimer=setTimeout(()=>{this.current?.reject(Error('Reap2s exceeded'));this.readyReject(Error('Reap2s exceeded'));},2000);}
  message(m){
    if(this.terminal)return;
    if(m.type==='error'){this.stderr+=m.message??'Child error';this.kill('ERROR_CHILD');return;}
    if(m.type==='module-ready'){this.events.push(m);return;}
    if(m.type==='session-ready'){clearTimeout(this.startupTimer);this.isReady=true;this.readyResolve();return;}
    const c=this.current;if(!c||c.run.runId!==m.runId){this.kill('ERROR_PROTOCOL');return;}
    if(m.type==='probe-start'){
      if(!c.started||c.probeStarted){this.kill('PROBE_PROTOCOL');return;}c.probeStarted=true;
      this.probeTimer=setTimeout(()=>this.kill('TIMEOUT_PROBE'),10000);
      this.chain=this.chain.then(()=>this.journal.append(c.rawFile,{...m,hostMs:performance.now()})).catch(e=>this.kill('PERSISTENCE_ERROR',e));return;
    }
    if(m.type==='probe-result'){
      if(!c.probeStarted||c.probeDone){this.kill('PROBE_PROTOCOL');return;}c.probeDone=true;clearTimeout(this.probeTimer);
      this.chain=this.chain.then(()=>this.journal.append(c.rawFile,{...m,hostMs:performance.now()})).catch(e=>this.kill('PERSISTENCE_ERROR',e));return;
    }
    if(m.type==='phase-start'){
      if(c.started){this.kill('DUPLICATE_PHASE');return;}c.started=true;clearTimeout(this.callStartupTimer);
      this.apiTimer=setTimeout(()=>this.kill('TIMEOUT_API'),this.apiMs);this.processTimer=setTimeout(()=>this.kill('TIMEOUT_PROCESS'),this.processMs);
      c.phaseStartMs=performance.now();this.chain=this.chain.then(()=>this.journal.append(c.rawFile,{...m,resources:this.resources(),hostMs:c.phaseStartMs})).catch(e=>this.kill('PERSISTENCE_ERROR',e));
    }else if(m.type==='phase-result'){
      if(!c.started||c.raw){this.kill('RAW_PROTOCOL');return;}clearTimeout(this.apiTimer);c.raw=m;c.rawResources=this.resources();c.requestWallMs=performance.now()-this.started-(m.raw?.postTimingAuditMs??0);
      this.chain=this.chain.then(async()=>{await this.journal.append(c.rawFile,{...m,resources:c.rawResources,hostMs:performance.now()});clearTimeout(this.processTimer);this.auditTimer=setTimeout(()=>this.kill('TIMEOUT_AUDIT'),this.auditMs);this.proc.send({type:'ack',runId:c.run.runId});}).catch(e=>this.kill('PERSISTENCE_ERROR',e));
    }else if(m.type==='audit-result'){
      this.chain=this.chain.then(async()=>{if(!c.raw)throw Error('Audit before raw');const row={...m.row,coldRequestMs:c.requestWallMs,rawResources:c.rawResources,resources:this.resources(),sessionMode:this.mode,peakScope:this.mode==='COLD'?'fresh-call-process':'cumulative-session-including-module-manager',startupEvents:this.events,rawFile:path.relative(this.out,c.rawFile).replaceAll('\\','/')};await this.journal.append(c.rawFile,{type:'audit-result',runId:c.run.runId,witness:row.witness,contract:row.contract});await this.journal.append(`${this.out}/runs.jsonl`,row);c.row=row;c.persisted=true;this.tryDone();}).catch(e=>this.kill('PERSISTENCE_ERROR',e));
    }else if(m.type==='call-done'){c.done=true;this.tryDone();}
    else this.kill('ERROR_MESSAGE');
  }
  tryDone(){const c=this.current;if(c?.done&&c.persisted){this.clearCallTimers();this.current=null;c.resolve(c.row);}}
  async call(run){await this.ready;if(this.current||this.terminal)throw Error('Session unavailable');const rawFile=`${this.out}/raw/${run.runId}.jsonl`;await this.journal.append(`${this.out}/starts.jsonl`,{...run,utc:new Date().toISOString()});return await new Promise((resolve,reject)=>{this.current={run,rawFile,resolve,reject};this.callStartupTimer=setTimeout(()=>this.kill('TIMEOUT_STARTUP'),this.startupMs);this.proc.send({type:'call',run});});}
  async close(){if(!this.terminal){this.proc.send({type:'close'});this.reapTimer=setTimeout(()=>this.kill('TIMEOUT_CLOSE'),2000);}return await this.closed;}
}
