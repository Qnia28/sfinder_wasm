import {fork} from 'node:child_process';
import assert from 'node:assert/strict';
import {HERE,ROOT} from './common.mjs';
import {TRACE_FLAGS} from './schedule.mjs';
const [id,mode,profile,engine,trace]=process.argv.slice(2);assert.equal(profile,trace);assert.equal(engine,'DEFAULT');
const child=fork(`${HERE}/session.mjs`,[id,mode,profile,engine,trace],{cwd:ROOT,execArgv:trace==='1'?TRACE_FLAGS:[],stdio:['ignore','inherit','inherit','ipc']});
let closing=false;process.on('message',m=>{if(m.type==='close')closing=true;child.send(m);});child.on('message',m=>process.send(m));
child.on('error',e=>{console.error(e.stack);process.exitCode=1;});
child.on('exit',(code,signal)=>{if(!closing||code||signal){console.error(`Engine child exit code=${code} signal=${signal}`);process.exitCode=code||1;}if(process.connected)process.disconnect();});
