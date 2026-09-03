import test from'node:test';
import assert from'node:assert/strict';
import{createWasmSolver}from'../src/wasm-backend.mjs';
import{calculateChance,calculateSaves}from'../src/features.mjs';
import{calculateLegacySaveMinimals}from'../src/minimals-feature.mjs';

const FUMEN='v115@9gglIeglHewwhlzhBexwzhEewwJeAgH';

const ORACLES=[
  ['TI,[JOS]!,*p2;TO,[IJS]!,*p2',498,504],
  ['S,[JLTZ]!,*p2;Z,[JLST]!,*p2',1538,2016],
  ['I[JS]![TO]!,*p2',145,168],
  ['I,[JS]!,[TO]!,*p2',145,168],
];

for(const[pattern,success,total]of ORACLES){
  test(`SFinder chance oracle for pattern: ${pattern}`,async()=>{
    const solver=await createWasmSolver(4);
    try{
      const r=calculateChance({sourceFumen:FUMEN,pattern,solver});
      assert.deepEqual([r.success,r.total,r.failed],[success,total,total-success]);
    }finally{solver.close()}
  });
}

const MASK_ORDER='IJLOSTZ';
function solutionUsing(queue){
  const masks=Array(7).fill(0n),counts=new Map();
  for(const piece of queue){
    const i=MASK_ORDER.indexOf(piece),n=counts.get(piece)||0;
    masks[i]|=0xfn<<BigInt(i*4+n*32);
    counts.set(piece,n+1);
  }
  return{key:queue,masks,orderCount:1};
}

test('calculateSaves counts union branch cases separately and uses each last bag',()=>{
  const fake={enumeratePc(_board,q){return[solutionUsing(q)]}};
  const r=calculateSaves({sourceFumen:'v115@vhAAgH',pattern:'TI,*p1;TI,[J]',wantedSave:'L',solver:fake});
  assert.equal(r.total,8);
  assert.equal(r.success,6);
  assert.equal(r.failed,2);
  // One failure is branch 1 when L itself is drawn; the other is branch 2's TIJ.
  assert.equal(r.failedQueues.filter(q=>q==='TIJ').length,1);
});

test('exact minimum-cover coverage preserves duplicate cases from separate branches',()=>{
  const sol=solutionUsing('TIJ');
  const fake={enumeratePc(){return[sol]}};
  const r=calculateLegacySaveMinimals({sourceFumen:'v115@vhAAgH',analysisPattern:'TI,[J];TI,[J]',wantedSave:'',solver:fake});
  assert.equal(r.queues.length,2);
  assert.equal(r.coverage.size,2);
  assert.equal(r.saveSuccess,2);
  assert.equal(r.minimalCount,1);
  assert.deepEqual(r.coverageCounts,[2]);
});
