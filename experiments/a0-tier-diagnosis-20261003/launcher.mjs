import {fork} from 'node:child_process';
import assert from 'node:assert/strict';
import {HERE,ROOT} from './common.mjs';
import {flags} from './schedule.mjs';
const [id,mode,profile,engine,trace]=process.argv.slice(2);assert(['0','1'].includes(trace));
const f=flags(engine,trace==='1');
// A launcher process lets the unchanged supervisor set per-call timers while
// the actual engine process starts with V8 flags, inherited by its Worker.
const script=process.env.A0_TIER_FIXTURE==='1'?'fixture.mjs':'session.mjs';
const child=fork(`${HERE}/${script}`,[id,mode,profile,engine,trace],{cwd:ROOT,execArgv:f,stdio:['ignore','inherit','inherit','ipc']});
let closeRequested=false;
process.on('message',m=>{if(m.type==='close')closeRequested=true;child.send(m);});
child.on('message',m=>process.send(m));
child.on('error',e=>{console.error(e.stack);process.exitCode=1;});
child.on('exit',(code,signal)=>{
  if(!closeRequested||code||signal){console.error(`Engine child exit code=${code} signal=${signal}`);process.exitCode=code||1;}
  if(process.connected)process.disconnect();
});
