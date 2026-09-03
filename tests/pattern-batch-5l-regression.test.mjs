import test from 'node:test';
import assert from 'node:assert/strict';
import {createWasmSolver} from '../src/wasm-backend.mjs';
import {calculateMinimalsFeature,calculatePerSaveMinimalsFeature} from '../src/features.mjs';

const PATTERN='*p7';
const CASES=[
  {
    fumen:'v115@9gD8FeD8BeA8BeD8CeH8AeE8JeAgH',
    pc:4968,minimal:14,saves:{T:1,I:0,L:2,J:2,S:4,Z:7,O:3},
  },
  {
    fumen:'v115@FhF8BeG8CeH8AeE8JeAgH',
    pc:4884,minimal:8,saves:{T:2,I:2,L:0,J:0,S:4,Z:4,O:0},
  },
  {
    fumen:'v115@zgB8GeC8GeE8EeD8DeG8AeE8JeAgH',
    pc:5004,minimal:21,saves:{T:13,I:10,L:5,J:1,S:8,Z:16,O:11},
  },
  {
    fumen:'v115@zgA8IeE8EeE8EeD8DeG8AeD8JeAgH',
    pc:4784,minimal:16,saves:{T:3,I:0,L:2,J:3,S:4,Z:5,O:3},
  },
];

for(const [index,fixture] of CASES.entries()){
  test(`5-line *p7 minimals regression setup ${index+1}`,async()=>{
    const solver=await createWasmSolver(5);
    try{
      const normal=await calculateMinimalsFeature({
        sourceFumen:fixture.fumen,pattern:PATTERN,wantedSave:'',clear:5,solver,useHold:true,
      });
      assert.equal(normal.total,5040);
      assert.equal(normal.saveSuccess,fixture.pc);
      assert.equal(normal.minimalCount,fixture.minimal);

      const perSave=await calculatePerSaveMinimalsFeature({
        sourceFumen:fixture.fumen,pattern:PATTERN,targetLines:5,solver,useHold:true,
      });
      assert.equal(perSave.total,5040);
      assert.equal(perSave.pcSuccess,fixture.pc);
      for(const [piece,count] of Object.entries(fixture.saves)){
        assert.equal(perSave.results[piece].minimalCount,count,piece);
        assert.equal(perSave.pageCounts[piece],count,piece);
      }
    }finally{solver.close()}
  });
}
