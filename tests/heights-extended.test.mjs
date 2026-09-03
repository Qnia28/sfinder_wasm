import test from 'node:test';
import assert from 'node:assert/strict';
import {decoder,encoder,Field} from 'tetris-fumen';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {calculateChance,calculateSaves,calculateMinimalsFeature} from '../src/features.mjs';
import {runWorkerRequest} from '../src/worker-runtime.mjs';

const EMPTY_2L='v115@vhAAgH';
const PRE_CLEAR='v115@IhBtGeRpBtFeRp3hJeAgH';

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

for(const [clear,rows] of [[5,3],[6,4]]){
  test(`${clear}-line compatibility: chance/saves/minimals smoke test on lifted 2-line board`,async()=>{
    const solver=await createWasmSolver(clear);
    try{
      const sourceFumen=liftWithFullRows(EMPTY_2L,rows);
      const chance=calculateChance({sourceFumen,pattern:'OOOOO',clear,solver});
      assert.equal(chance.total,1);
      assert.equal(chance.success,1);

      const saves=calculateSaves({sourceFumen,pattern:'OOOO,[O]!',wantedSave:'',clear,solver});
      assert.equal(saves.total,1);
      assert.equal(saves.success,1);
      assert.equal(saves.failed,0);

      const minimals=await calculateMinimalsFeature({sourceFumen,pattern:'OOOO,[O]!',wantedSave:'',clear,solver});
      assert.equal(minimals.total,1);
      assert.equal(minimals.saveSuccess,1);
      assert.equal(minimals.minimalCount,1);
      assert.deepEqual(minimals.coverageCounts,[1]);
    }finally{solver.close()}
  });
}

test('6-line compatibility: per-save minimals lifted from 4-line fixture',async()=>{
  const r=await runWorkerRequest({kind:'per-save-minimals',input:{sourceFumen:liftWithFullRows(PRE_CLEAR,2),pattern:'TOILJSZ',targetLines:6,title:'6L'}});
  assert.equal(r.targetLines,6);
  assert.equal(r.occupiedCells,36);
  assert.equal(r.remainingCells,24);
  assert.equal(r.piecesNeeded,6);
  assert.equal(r.expectedQueueLength,7);
  assert.equal(r.pcSuccess,1);
});
