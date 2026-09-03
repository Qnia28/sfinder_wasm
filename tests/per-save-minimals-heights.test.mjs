import test from 'node:test';
import assert from 'node:assert/strict';
import {decoder} from 'tetris-fumen';
import {runWorkerRequest} from '../src/worker-runtime.mjs';
import {PerSaveMinimalsInputError} from '../src/per-save-minimals.mjs';

const POST_CLEAR='v115@ShB8GeD8PeAgH';   // 6 occupied cells: 3L target, see7
const PRE_CLEAR='v115@IhBtGeRpBtFeRp3hJeAgH'; // 16 occupied cells incl. one full row: 4L target, see7

function request(sourceFumen,pattern,targetLines,extra={}){
  return runWorkerRequest({kind:'per-save-minimals',input:{sourceFumen,pattern,targetLines,...extra}});
}

function assertNoCellsAtOrAbove(fumen,pageIndex,height){
  const page=decoder.decode(fumen)[pageIndex];
  assert.ok(page);
  for(let y=height;y<23;y++)for(let x=0;x<10;x++){
    assert.equal(page.field.at(x,y),'_',`unexpected cell at (${x},${y})`);
  }
}

test('2-line per-save uses remaining cells to require see6',async()=>{
  const r=await request('v115@vhAAgH','OOOOOI',2,{title:'2L'});
  assert.deepEqual({
    targetLines:r.targetLines,
    occupiedCells:r.occupiedCells,
    remainingCells:r.remainingCells,
    piecesNeeded:r.piecesNeeded,
    expectedQueueLength:r.expectedQueueLength,
    pcSuccess:r.pcSuccess,
    total:r.total,
  },{targetLines:2,occupiedCells:0,remainingCells:20,piecesNeeded:5,expectedQueueLength:6,pcSuccess:1,total:1});
  assert.equal(r.results.I.guaranteed,true);
  assert.equal(r.results.I.label,'☆ Save I');
  assertNoCellsAtOrAbove(r.fumen,1,2);
});

test('3-line per-save supports see8 when 28 cells remain',async()=>{
  const r=await request('v115@HhB8leAgH','OOOOOIIT',3,{title:'3L'});
  assert.equal(r.occupiedCells,2);
  assert.equal(r.remainingCells,28);
  assert.equal(r.piecesNeeded,7);
  assert.equal(r.expectedQueueLength,8);
  assert.equal(r.pcSuccess,1);
  assert.equal(r.results.T.guaranteed,true);
  assert.equal(r.results.T.label,'☆ Save T');
  assertNoCellsAtOrAbove(r.fumen,1,3);
});

test('post-clear screenshot state is a valid 3-line see7 input',async()=>{
  const r=await request(POST_CLEAR,'TOILJSZ',3,{title:'post-clear'});
  assert.equal(r.occupiedCells,6);
  assert.equal(r.remainingCells,24);
  assert.equal(r.piecesNeeded,6);
  assert.equal(r.expectedQueueLength,7);
  assert.equal(r.pcSuccess,1);
  assertNoCellsAtOrAbove(r.fumen,1,3);
});

test('pre-clear screenshot state is a valid 4-line see7 input',async()=>{
  const r=await request(PRE_CLEAR,'TOILJSZ',4,{title:'pre-clear'});
  assert.equal(r.occupiedCells,16);
  assert.equal(r.remainingCells,24);
  assert.equal(r.piecesNeeded,6);
  assert.equal(r.expectedQueueLength,7);
  assert.equal(r.pcSuccess,1);
});

test('occupied-cell geometry mismatch is rejected',async()=>{
  await assert.rejects(()=>request(POST_CLEAR,'TOILJSZ',4),e=>{
    assert.equal(e.name,'PerSaveMinimalsInputError');
    assert.match(e.message,/remainingCells=34 is not divisible by 4/);
    return true;
  });
  await assert.rejects(()=>request(PRE_CLEAR,'TOILJSZ',3),e=>{
    assert.equal(e.name,'PerSaveMinimalsInputError');
    assert.match(e.message,/remainingCells=14 is not divisible by 4/);
    return true;
  });
});

test('queue length must be exactly piecesNeeded + 1',async()=>{
  await assert.rejects(()=>request('v115@HhB8leAgH','OOOOOII',3),e=>{
    assert.equal(e.name,'PerSaveMinimalsInputError');
    assert.match(e.message,/expected see8/);
    assert.match(e.message,/got 7/);
    return true;
  });
});

test('targetLines supports 2..6 and clear remains a compatible alias',async()=>{
  const legacy=await runWorkerRequest({kind:'per-save-minimals',input:{sourceFumen:'v115@vhAAgH',pattern:'OOOOOI',clear:2}});
  assert.equal(legacy.targetLines,2);
  await assert.rejects(()=>runWorkerRequest({kind:'per-save-minimals',input:{sourceFumen:'v115@vhAAgH',pattern:'OOOOOI',targetLines:2,clear:3}}),PerSaveMinimalsInputError);
  await assert.rejects(()=>request('v115@vhAAgH','OOOOOI',1),PerSaveMinimalsInputError);
  await assert.rejects(()=>request('v115@vhAAgH','OOOOOI',7),PerSaveMinimalsInputError);
});
