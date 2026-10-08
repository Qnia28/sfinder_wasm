// Diagnostic-only, per-isolate durable scalar records. No solver imports.
import fs from 'node:fs';
import path from 'node:path';
import { threadId } from 'node:worker_threads';

export function installMemoryTrace(role, directory = process.env.SECONDARY_MEMORY_DIRECTORY) {
  if (!directory) throw new Error('missing diagnostic directory');
  const fd = fs.openSync(path.join(directory, `memory-${process.pid}-${threadId}.jsonl`), 'wx');
  let sequence = 0, closed = false;
  const group = process.platform === 'linux'
    ? fs.readFileSync('/proc/self/cgroup','utf8').trim().split('\n').find(s=>s.startsWith('0::'))?.slice(3) : null;
  const scalar = name => {
    if (!group) return null;
    const text = fs.readFileSync(path.join('/sys/fs/cgroup',group,name),'utf8').trim();
    return /^\d+$/.test(text) ? Number(text) : text;
  };
  const trace = (stage, detail = {}) => {
    if (closed) throw new Error('closed diagnostic trace');
    if (++sequence > 10000) throw new Error('diagnostic trace bound exceeded');
    const row = { ...detail,schema:1,role,pid:process.pid,threadId,sequence,stage,
      wallMs:performance.timeOrigin+performance.now(),memory:process.memoryUsage(),
      cgroupCurrent:scalar('memory.current'),cgroupPeak:scalar('memory.peak'),cgroupEvents:scalar('memory.events') };
    fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd);
  };
  globalThis.__secondaryMemoryTrace = trace;
  trace('trace-open');
  return { trace,close(){ if (!closed) { trace('trace-close');closed=true;delete globalThis.__secondaryMemoryTrace;fs.closeSync(fd); } } };
}
