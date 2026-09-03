import test from'node:test';
import assert from'node:assert/strict';
import{expandPatternCases}from'../src/pattern.mjs';
import{savedString}from'../src/saves.mjs';

const MASK_ORDER='IJLOSTZ';
function solutionUsing(pieces){
  const masks=Array(7).fill(0n),counts=new Map();
  for(const piece of pieces){
    const i=MASK_ORDER.indexOf(piece),n=counts.get(piece)||0;
    masks[i]|=0xfn<<BigInt(i*4+n*32);
    counts.set(piece,n+1);
  }
  return{masks};
}

test('save analysis uses branch-specific last bag for the same concrete queue',()=>{
  const entries=expandPatternCases('TI,*p1;TI,[J]').filter(x=>x.queue==='TIJ');
  assert.equal(entries.length,2);
  const solution=solutionUsing('TIJ');
  assert.equal(savedString('TIJ',solution,entries[0].lastBag),'TILSZO');
  assert.equal(savedString('TIJ',solution,entries[1].lastBag),'');
});
