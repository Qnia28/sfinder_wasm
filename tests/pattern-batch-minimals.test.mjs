import test from 'node:test';
import assert from 'node:assert/strict';
import {decoder,encoder,Field} from 'tetris-fumen';
import {boardFromFumenPage} from '../src/board.mjs';
import {expandPattern} from '../src/pattern.mjs';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {calculateMinimalsFeature,calculatePerSaveMinimalsFeature} from '../src/features.mjs';

const F5='v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH';
const PATTERN='*p7';
const EXPECTED_PER_SAVE={T:13,I:10,L:5,J:1,S:8,Z:16,O:11};

function liftWithFullRows(source,rows){
  const page=decoder.decode(source)[0];
  const field=Field.create('');
  for(let y=0;y<rows;y++)for(let x=0;x<10;x++)field.set(x,y,'X');
  for(let y=0;y<23-rows;y++)for(let x=0;x<10;x++){
    const cell=page.field.at(x,y);
    if(cell!=='_')field.set(x,y+rows,cell);
  }
  return encoder.encode([{field}]);
}

function coverageByCase(rows){
  const out=new Map();
  for(const row of rows)for(const hit of row.coverage){
    let map=out.get(hit.caseIndex);if(!map){map=new Map();out.set(hit.caseIndex,map)}
    map.set(row.key,hit.orderCount);
  }
  return out;
}

test('5-line pattern batch reproduces the Java SFinder minimals oracle',async()=>{
  const solver=await createWasmSolver(5);
  try{
    const normal=await calculateMinimalsFeature({sourceFumen:F5,pattern:PATTERN,wantedSave:'',clear:5,solver,useHold:true});
    assert.equal(normal.total,5040);
    assert.equal(normal.saveSuccess,5004);
    assert.equal(normal.minimalCount,21);

    const saveT=await calculateMinimalsFeature({sourceFumen:F5,pattern:PATTERN,wantedSave:'T',clear:5,solver,useHold:true});
    assert.equal(saveT.saveSuccess,2800);
    assert.equal(saveT.minimalCount,13);

    const perSave=await calculatePerSaveMinimalsFeature({sourceFumen:F5,pattern:PATTERN,targetLines:5,solver,useHold:true});
    assert.equal(perSave.total,5040);
    assert.equal(perSave.pcSuccess,5004);
    for(const[piece,count]of Object.entries(EXPECTED_PER_SAVE)){
      assert.equal(perSave.results[piece].minimalCount,count,piece);
      assert.equal(perSave.pageCounts[piece],count,piece);
    }
    assert.equal(Object.values(perSave.pageCounts).reduce((a,b)=>a+b,0),64);
  }finally{solver.close()}
});


test('5-line pattern batch preserves duplicate semicolon case multiplicity',async()=>{
  const solver=await createWasmSolver(5);
  try{
    const result=await calculateMinimalsFeature({sourceFumen:F5,pattern:`${PATTERN};${PATTERN}`,wantedSave:'',clear:5,solver,useHold:true});
    assert.equal(result.total,10080);
    assert.equal(result.saveSuccess,10008);
    assert.equal(result.minimalCount,21);
  }finally{solver.close()}
});

test('5-line pattern batch matches legacy concrete-queue enumeration on representative queues',async()=>{
  const queues=expandPattern(PATTERN),board=boardFromFumenPage(decoder.decode(F5)[0],5),solver=await createWasmSolver(5);
  try{
    const rows=solver.enumeratePcPattern(board,queues,true),byCase=coverageByCase(rows);
    assert.equal(byCase.size,5004);
    for(const index of [0,1,2,17,111,503,999,2026,4000,5039]){
      const legacy=new Map(solver.enumeratePc(board,queues[index],true).map(s=>[s.key,s.orderCount]));
      assert.deepEqual([...byCase.get(index)?.entries()??[]].sort(),[...legacy.entries()].sort(),`${index}:${queues[index]}`);
    }
  }finally{solver.close()}
});

test('6-line pattern batch preserves the lifted 5-line oracle',async()=>{
  const fumen=liftWithFullRows(F5,1),solver=await createWasmSolver(6);
  try{
    const normal=await calculateMinimalsFeature({sourceFumen:fumen,pattern:PATTERN,wantedSave:'',clear:6,solver,useHold:true});
    assert.equal(normal.saveSuccess,5004);
    assert.equal(normal.minimalCount,21);
    const perSave=await calculatePerSaveMinimalsFeature({sourceFumen:fumen,pattern:PATTERN,targetLines:6,solver,useHold:true});
    assert.equal(perSave.pcSuccess,5004);
    for(const[piece,count]of Object.entries(EXPECTED_PER_SAVE))assert.equal(perSave.results[piece].minimalCount,count,piece);
  }finally{solver.close()}
});

test('pattern batch supports duplicate piece counts',async()=>{
  const empty='v115@vhAAgH',fumen=liftWithFullRows(empty,3),queues=expandPattern('OOOOO,[OI]!');
  const board=boardFromFumenPage(decoder.decode(fumen)[0],5),solver=await createWasmSolver(5);
  try{
    const rows=solver.enumeratePcPattern(board,queues,true),byCase=coverageByCase(rows);
    for(let index=0;index<queues.length;index++){
      const legacy=new Map(solver.enumeratePc(board,queues[index],true).map(s=>[s.key,s.orderCount]));
      assert.deepEqual([...byCase.get(index)?.entries()??[]].sort(),[...legacy.entries()].sort(),queues[index]);
    }
  }finally{solver.close()}
});
