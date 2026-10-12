import test from 'node:test';
import assert from 'node:assert/strict';
import {ARMS,JOB,LIMITS,tasksFor,validateReservation} from '../tools/secondary-bench/common/triage/factorial-plan.mjs';
import {capacity,worstCall} from '../tools/secondary-bench/common/budget.mjs';
test('factorial reserves all 64 fresh calls in independent reverse-order VM blocks',()=>{
  validateReservation();const ids=new Set();
  for(let input=0;input<4;input++){
    const ref={id:'input-'+input,sha256:'a'.repeat(64),metadata:{dataset:input<2?'PER_SAVE':'ALL'}};
    const a=tasksFor(ref,input,1),b=tasksFor(ref,input,2);
    assert.deepEqual(a.map(t=>t.calls[0].variant),b.map(t=>t.calls[0].variant).reverse());
    assert.deepEqual(a.map(t=>t.calls[0].variant).sort(),[...ARMS].sort());
    for(const t of [...a,...b]){assert.equal(t.calls.length,1);assert.equal(t.worstMs,worstCall(LIMITS,JOB));assert(!ids.has(t.calls[0].callId));ids.add(t.calls[0].callId);}
  }
  assert.equal(ids.size,64);assert(8*worstCall(LIMITS,JOB)<=capacity(JOB));
  assert.throws(()=>tasksFor({id:'x'},4,1));
});
