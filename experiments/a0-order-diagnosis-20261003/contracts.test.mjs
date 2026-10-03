import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule,profileSchedule,evaluate} from './schedule.mjs';
test('16 fresh sessions, 24 calls, each variant exactly once per Worker/session',()=>{
  assert.equal(schedule.length,16);assert.equal(schedule.flatMap(s=>s.runs).length,24);
  assert.equal(new Set(schedule.flatMap(s=>s.runs).map(r=>r.runId)).size,24);
  for(const c of ['R','A','RA','AR'])assert.equal(schedule.filter(s=>s.condition===c).length,4);
  for(const s of schedule){assert.equal(new Set(s.runs.map(r=>r.label)).size,s.runs.length);assert(s.runs.every(r=>r.matrixId==='board-028--restricted-split--ordinary'&&!r.instrumented));}
  assert.equal(profileSchedule.flatMap(s=>s.runs).length,4);
});
const rows=fn=>schedule.flatMap(s=>s.runs).map(r=>({...r,apiMs:fn(r)}));
test('conditional profile is symmetric and does not silently treat partial as complete',()=>{
  assert.equal(evaluate(rows(()=>4000)).profileRequired,false);
  assert.equal(evaluate(rows(r=>r.label==='A'&&r.position===1?6000:4000)).profileRequired,true);
  assert.equal(evaluate(rows(r=>r.position===2?6000:4000)).profileRequired,true);
  assert.equal(evaluate(rows(()=>4000).slice(1)).status,'PARTIAL_STOP');
});
