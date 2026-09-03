import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePerSaveMinimalsFromBoard,unusedPieceForSolution} from '../src/per-save-minimals-core.mjs';

const MASK_ORDER='IJLOSTZ';
function solution(key,usedPieces){
  const masks=Array(7).fill(0n);
  const nextCell=Array(7).fill(0);
  for(const piece of usedPieces){
    const i=MASK_ORDER.indexOf(piece);
    if(i<0)throw new Error(`bad piece ${piece}`);
    const offset=i*4+nextCell[i]*28;
    masks[i]|=0xfn<<BigInt(offset);
    nextCell[i]++;
  }
  return{key,masks,orderCount:1};
}

function fakeSolver(table){return{enumeratePc(_board,queue){return table.get(queue)??[]}}}

test('unused piece is queue multiset minus solution usage',()=>{
  const s=solution('save-T','SIOLJZ');
  assert.equal(unusedPieceForSolution('TSIOLJZ',s),'T');
});

test('100% save is conditional on PC-success queues, not all queues',()=>{
  const q1='TSIOLJZ',q2='TISOLJZ',q3='TZSIOLJ';
  const table=new Map([
    [q1,[solution('q1-save-T','SIOLJZ'),solution('q1-save-I','TSOLJZ')]],
    [q2,[solution('q2-save-T','ISOLJZ')]],
    [q3,[]],
  ]);
  const r=calculatePerSaveMinimalsFromBoard({board:0n,queues:[q1,q2,q3],solver:fakeSolver(table)});
  assert.equal(r.pcSuccess,2);
  assert.equal(r.pcRate,2/3);
  assert.equal(r.results.T.success,2);
  assert.equal(r.results.T.saveRate,1);
  assert.equal(r.results.T.guaranteed,true);
  assert.equal(r.results.T.label,'☆ Save T');
  assert.equal(r.results.I.success,1);
  assert.equal(r.results.I.saveRate,0.5);
  assert.equal(r.results.I.guaranteed,false);
  assert.equal(r.results.I.label,'Save I (50.00%)');
});

test('PC 0% is a normal empty result and never divides by zero',()=>{
  const queues=['TSIOLJZ','TISOLJZ'];
  const r=calculatePerSaveMinimalsFromBoard({board:0n,queues,solver:fakeSolver(new Map())});
  assert.equal(r.pcSuccess,0);
  assert.equal(r.pcRate,0);
  for(const piece of 'TILJSZO'){
    const x=r.results[piece];
    assert.equal(x.success,0);
    assert.equal(x.saveRate,null);
    assert.equal(x.guaranteed,false);
    assert.equal(x.minimalCount,0);
    assert.deepEqual(x.keys,[]);
    assert.deepEqual(x.solutions,[]);
    assert.equal(x.label,`Save ${piece} (N/A)`);
  }
});


test('single queue uses exact direct per-save best API without JS full enumeration',()=>{
  const masks=Array(7).fill(0n);masks[0]=0xfn;
  let enumerated=false,receivedLimit=null;
  const solver={
    perSaveBest(_board,_queue,_useHold,options){receivedLimit=options.candidateLimit;return[{saved:5,key:'best-T',masks,orderCount:23}]},
    enumeratePc(){enumerated=true;throw new Error('should not enumerate')},
  };
  const r=calculatePerSaveMinimalsFromBoard({board:0n,queues:['T'],solver,candidateLimit:24});
  assert.equal(enumerated,false);
  assert.equal(receivedLimit,24);
  assert.equal(r.pcSuccess,1);
  assert.equal(r.results.T.minimalCount,1);
  assert.deepEqual(r.results.T.humanQualityVector,[23]);
  assert.equal(r.results.T.solutions[0].key,'best-T');
});


test('single-queue direct per-save rejects missing or zero playableOrderCount',()=>{
  const masks=Array(7).fill(0n);masks[0]=0xfn;
  for(const orderCount of [undefined,0,'2']){
    const solver={
      perSaveBest(){return[{saved:5,key:'bad-T',masks,...(orderCount===undefined?{}:{orderCount})}]},
    };
    assert.throws(
      ()=>calculatePerSaveMinimalsFromBoard({board:0n,queues:['T'],solver}),
      /playableOrderCount must be an integer number in 1/,
    );
  }
});
