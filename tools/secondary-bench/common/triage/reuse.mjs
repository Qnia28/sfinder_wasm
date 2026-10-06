// Reuse completed prerequisites after adjudication-only changes, never rewrite raw identities.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, filesUnder, digest } from '../contracts.mjs';
import { loadHistory, verifyHistoryIndex } from '../evidence.mjs';
import { compileTasks } from './protocol.mjs';
import { evidenceFirst } from './gates.mjs';

export const ADJUDICATION_FILES = new Set([
  'tools/secondary-bench/common/README_KO.md',
  ...['action.mjs','analysis.mjs','gates.mjs','protocol.mjs','prepare.py','independent-audit.py','reuse.mjs']
    .map(f=>'tools/secondary-bench/common/triage/'+f),
  'tests/triage-bench.test.mjs','tests/triage-independent-audit.test.py',
]);
export function verifyReuse(m) {
  if (!m.prerequisiteReuse) return null;
  assert(evidenceFirst(m.gateContract));
  assert.deepEqual(m.prerequisiteReuse,{id:'adjudication-only-prerequisites-v1',phases:['CANARY','CALIBRATION']});
  const parent=readJson(m.continuation.parentLock),old=parent.manifest;
  assert.equal(parent.manifestHash,digest(old));
  assert.deepEqual(old.sourceFiles.product,m.sourceFiles.product,'prerequisite product changed');
  for (const file of new Set([...Object.keys(old.sourceFiles.harness),...Object.keys(m.sourceFiles.harness)]))
    if (!ADJUDICATION_FILES.has(file)) assert.equal(old.sourceFiles.harness[file],m.sourceFiles.harness[file],
      'prerequisite execution source changed: '+file);
  for(const field of ['inputs','profileContract','tasksHash','job','baselineFiles','runtime'])
    assert.deepEqual(old[field],m[field],'prerequisite condition changed: '+field);
  verifyHistoryIndex(m.continuation.history,m.continuation.historyIndexSha256,m.campaignId);
  const history=loadHistory(m.continuation.history,m.campaignId);
  assert(!history.warnings.length&&!history.unknown.length,'parent evidence incomplete');
  const rows=history.rows.filter(r=>r.invocationId===parent.invocationId);
  const templates=fs.readFileSync(path.join(path.dirname(m.continuation.parentLock),'../TASKS.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const plans=filesUnder(m.continuation.history).filter(f=>path.basename(f)==='STAGE_PLAN.json').map(readJson)
    .filter(p=>p.manifestHash===parent.manifestHash);
  assert.equal(plans.length,2,'reuse only fully completed prerequisites');
  for(const phase of m.prerequisiteReuse.phases) {
    const plan=plans.find(p=>p.phase===phase);assert(plan);
    const calls=compileTasks(old,templates,phase).flatMap(t=>t.calls);
    assert.deepEqual(plan.expectedCalls,calls,'parent prerequisite schedule');
    const observed=rows.filter(r=>r.phase===phase);
    assert.equal(observed.length,calls.length);
    assert.deepEqual(new Set(observed.map(r=>r.callId)),new Set(calls.map(c=>c.callId)));
    assert(observed.every(r=>r.manifestHash===parent.manifestHash&&r.execution?.reaped===true
      &&['EXACT','TIMEOUT_CALL','INCOMPLETE','OOM'].includes(r.status)),'invalid prerequisite outcome');
  }
  return {parent,rows,plans,history};
}
export function collectedHistory(lock, current) {
  const reuse=verifyReuse(lock.manifest);
  return reuse ? {...current,rows:[...reuse.rows,...current.rows]} : current;
}
