import assert from 'node:assert/strict';
import {parentPort,workerData} from 'node:worker_threads';
import {flags} from './schedule.mjs';
const {engine,trace}=workerData;assert.deepEqual(process.execArgv,flags(engine,trace));
// Keep the message port referenced while asynchronous eager compilation runs.
// The source-locked worker installs its call handler only after solver init.
parentPort.on('message',()=>{});
const engineInfo={mode:engine,trace,execArgv:process.execArgv,v8:process.versions.v8,pid:process.pid};
function marker(phase,runId=null){if(trace)process.stdout.write(`A0_MARKER ${JSON.stringify({phase,runId,engine:engineInfo,epochMs:performance.timeOrigin+performance.now()})}\n`);}
marker('WORKER_START');
const original=parentPort.postMessage.bind(parentPort);
parentPort.postMessage=function(m,...args){
  if(m.type==='ready')marker('READY_AFTER_INIT');
  if(m.type==='phase-start')marker('API_START',m.runId);
  if(m.type==='phase-result')marker('API_RETURN',m.runId);
  if(m.type==='ready'||m.type==='phase-result')m={...m,engine:engineInfo};
  if(m.type==='audit-result')m={...m,row:{...m.row,engine:engineInfo}};
  return original(m,...args);
};
// Reuse byte-identical source-locked one-call worker, including pinning,
// seed/quality contracts and fsync-before-verification handshake.
await import('../a0-order-diagnosis-20261003/worker.mjs');
