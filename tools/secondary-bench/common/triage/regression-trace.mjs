// Injected into diagnostic product copies only; boundary events, never search loops.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {threadId} from 'node:worker_threads';
const directory=path.resolve('diagnostic-traces');
fs.mkdirSync(directory,{recursive:true});
const fd=fs.openSync(path.join(directory,`${process.pid}-${threadId}.jsonl`),'ax');
let seq=0;
export function diagnostic(event,details={}) {
  const row={event,pid:process.pid,threadId,seq:seq++,utc:new Date().toISOString(),monotonicNs:process.hrtime.bigint().toString(),cpu:process.cpuUsage(),details};
  fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd);
}
export function seedDiagnostic(event,keys) {
  diagnostic(event,{keys,sha256:createHash('sha256').update(JSON.stringify(keys??null)).digest('hex')});
}
