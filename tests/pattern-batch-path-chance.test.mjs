import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {decoder,encoder,Field} from 'tetris-fumen';
import {boardFromFumenPage} from '../src/board.mjs';
import {expandPattern} from '../src/pattern.mjs';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {calculateChance,calculateSaves} from '../src/features.mjs';

const PATTERN='*p7';
const FIXTURES=[
 ['v115@9gD8FeD8BeA8BeD8CeH8AeE8JeAgH',4968,'0ba9d8299ee31802d7690be80e86486036c068264320cd0c13cd9c326af1c3b1'],
 ['v115@FhF8BeG8CeH8AeE8JeAgH',4884,'62b85638e8fd1ea9e2c157a484a61d79de7a093d1e30648a7aae864132bb78e0'],
 ['v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH',5004,'56af7ad7bf67111fc9b7773b85c7194ce20b710b7b2f0a1f8426fec344c94d69'],
 ['v115@zgA8IeE8EeE8EeD8DeG8AeD8JeAgH',4784,'4cf0b80ed0ad24fc3fe6cac30558197a40fff0e6ffcdaf92039d2d9842eaf572'],
];
const sha=a=>crypto.createHash('sha256').update([...a].sort().join('\n')).digest('hex');

function liftWithFullRows(source,rows){
 const page=decoder.decode(source)[0],field=Field.create('');
 for(let y=0;y<rows;y++)for(let x=0;x<10;x++)field.set(x,y,'X');
 for(let y=0;y<23-rows;y++)for(let x=0;x<10;x++){const cell=page.field.at(x,y);if(cell!=='_')field.set(x,y+rows,cell)}
 return encoder.encode([{field}]);
}

for(const [index,[fumen,success,failedHash]] of FIXTURES.entries()){
 test(`5-line pattern chance exact failed-set oracle setup ${index+1}`,async()=>{
  const solver=await createWasmSolver(5);
  try{
   const r=calculateChance({sourceFumen:fumen,pattern:PATTERN,clear:5,solver,useHold:true});
   assert.deepEqual([r.success,r.total,r.failed],[success,5040,5040-success]);
   assert.equal(sha(r.failedQueues),failedHash);
  }finally{solver.close()}
 });
}

test('5-line full path batch materialization matches scalar path on representative queues',async()=>{
 const queues=expandPattern(PATTERN),picked=queues.slice(0,32);
 const board=boardFromFumenPage(decoder.decode(FIXTURES[2][0])[0],5),solver=await createWasmSolver(5);
 try{
  const batch=solver.enumeratePcMany(board,picked,true);
  assert.equal(batch.length,picked.length);
  for(let i=0;i<picked.length;i++){
   const expected=solver.enumeratePc(board,picked[i],true).map(x=>[x.key,x.orderCount]).sort();
   const actual=batch[i].map(x=>[x.key,x.orderCount]).sort();
   assert.deepEqual(actual,expected,picked[i]);
  }
 }finally{solver.close()}
});

test('5-line saves uses pattern path and preserves save oracle',async()=>{
 const solver=await createWasmSolver(5);
 try{
  const r=calculateSaves({sourceFumen:FIXTURES[2][0],pattern:PATTERN,wantedSave:'T',clear:5,solver,useHold:true});
  assert.deepEqual([r.success,r.total,r.failed],[2800,5040,2240]);
 }finally{solver.close()}
});


test('6-line pattern chance preserves lifted 5-line exact failed set',async()=>{
 const solver=await createWasmSolver(6);
 try{
  const r=calculateChance({sourceFumen:liftWithFullRows(FIXTURES[2][0],1),pattern:PATTERN,clear:6,solver,useHold:true});
  assert.deepEqual([r.success,r.total,r.failed],[5004,5040,36]);
  assert.equal(sha(r.failedQueues),FIXTURES[2][2]);
 }finally{solver.close()}
});


test('5-line pattern chance preserves duplicate semicolon multiplicity',async()=>{
 const solver=await createWasmSolver(5);
 try{
  const r=calculateChance({sourceFumen:FIXTURES[2][0],pattern:`${PATTERN};${PATTERN}`,clear:5,solver,useHold:true});
  assert.deepEqual([r.success,r.total,r.failed],[10008,10080,72]);
 }finally{solver.close()}
});


test('4-line broad pattern enumeration matches scalar queues on representative cases',async()=>{
 const fumen='v115@Ehi0GeR4g0FeR4RpDezhRpJeAgH',queues=expandPattern('*!');
 const board=boardFromFumenPage(decoder.decode(fumen)[0],4),solver=await createWasmSolver(4);
 try{
  const rows=solver.enumeratePcPattern(board,queues,true);
  assert.ok(Array.isArray(rows));
  const byCase=new Map();
  for(const row of rows)for(const hit of row.coverage){let map=byCase.get(hit.caseIndex);if(!map){map=new Map();byCase.set(hit.caseIndex,map)}map.set(row.key,hit.orderCount)}
  for(const index of [0,1,2,17,111,503,999,2026,4000,5039]){
   const expected=new Map(solver.enumeratePc(board,queues[index],true).map(x=>[x.key,x.orderCount]));
   assert.deepEqual([...byCase.get(index)?.entries()??[]].sort(),[...expected.entries()].sort(),`${index}:${queues[index]}`);
  }
 }finally{solver.close()}
});
