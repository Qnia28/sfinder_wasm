import test from 'node:test';import assert from 'node:assert/strict';
import {expandPatternCases,expandPatternCasesInternal,expandPattern} from '../src/pattern.mjs';
import {CELLS,allGeometricPlacements} from '../src/batch-geometry.mjs';
test('internal bag sharing preserves public values, case order and independent mutable public bags',()=>{
 for(const pattern of ['*!','T,*p3','[IJL]p3,*p4','I;I','T,*p2;I,*p2']){
  const publicCases=expandPatternCases(pattern),internal=expandPatternCasesInternal(pattern);
  assert.deepEqual(internal,publicCases);assert.deepEqual(expandPattern(pattern),publicCases.map(c=>c.queue));
  if(internal[0].lastBag){assert.throws(()=>internal[0].lastBag.pieces.clear(),TypeError);assert.throws(()=>{internal[0].lastBag.drawCount=0},TypeError);}
  if(publicCases[0].lastBag&&publicCases.length>1){assert.notEqual(publicCases[0].lastBag,publicCases[1].lastBag);publicCases[0].lastBag.pieces.clear();assert.ok(publicCases[1].lastBag.pieces.size);}
 }
 const shared=expandPatternCasesInternal('T,*p3');assert.equal(shared[0].lastBag,shared[1].lastBag);assert.equal(shared[0].observedBag,shared[1].observedBag);
 assert.throws(()=>expandPatternCasesInternal('*p3,*p4',{maxCases:5000}),/exceeds/);
});
test('geometry cache preserves public mutation isolation and invalidates edited CELLS',()=>{
 for(const p of ['I','J','L','O','S','T','Z'])for(let height=2;height<=6;height++){
  const first=allGeometricPlacements(p,height),expected=first.slice();first.reverse();first.splice(0,1);assert.deepEqual(allGeometricPlacements(p,height),expected);
 }
 const saved=CELLS.O[0][0][0];const before=allGeometricPlacements('O',4);
 try{CELLS.O[0][0][0]=2;assert.notDeepEqual(allGeometricPlacements('O',4),before);}finally{CELLS.O[0][0][0]=saved;}
 assert.deepEqual(allGeometricPlacements('O',4),before);
});
