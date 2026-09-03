import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {decoder,encoder,Field} from 'tetris-fumen';
import {calculateCover,calculateCoverPercent,calculateCongruent,calculateCongruentCover} from '../src/batch-features.mjs';

const F='v115@ThR4BeBtCeR4zhBtKeAgH';
function sha(a){return crypto.createHash('sha256').update([...a].sort().join('\n')).digest('hex')}
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
function sig(page,height){let s='';for(let y=height-1;y>=0;y--){for(let x=0;x<10;x++)s+=page.field.at(x,y);s+='\n'}return s}

for(const [clear,rows] of [[5,1],[6,2]]){
  test(`${clear}-line compatibility: cover lifted from 4-line golden`,async()=>{
    const sourceFumen=liftWithFullRows(F,rows);
    const r=await calculateCover({sourceFumen,pattern:'*p7',clear,mode:'normal',mirror:'no'});
    assert.equal(r.covered,432);
    assert.equal(r.total,5040);
    assert.equal(r.failed,4608);
    assert.equal(sha(r.failedQueues),'abc29f28362dfb40b7923f0207dc81a63b6c47b38b8a0ad90c44ce09354d02c2');
  });

  test(`${clear}-line compatibility: cover preserves duplicate union multiplicity`,async()=>{
    const sourceFumen=liftWithFullRows(F,rows);
    const r=await calculateCover({sourceFumen,pattern:'*p7;*p7',clear,mode:'normal',mirror:'no'});
    assert.equal(r.covered,864);
    assert.equal(r.total,10080);
    assert.equal(r.failed,9216);
  });


  test(`${clear}-line compatibility: coverpercent uses compatibility PC solver`,async()=>{
    const sourceFumen=liftWithFullRows(F,rows);
    const r=await calculateCoverPercent({sourceFumen,coverPattern:'ZIS',percentPattern:'TOILJSZ',clear,mode:'normal',mirror:'no'});
    assert.equal(r.total,1);
    assert.equal(r.covered,1);
    assert.equal(r.failed,0);
    assert.equal(r.count,1);
    assert.equal(r.solutions[0].solveTotal,1);
    assert.ok(r.solutions[0].solve===0||r.solutions[0].solve===1);
  });

  test(`${clear}-line compatibility: coverpercent batches broad *p7 solve pattern`,async()=>{
    const sourceFumen=liftWithFullRows(F,rows);
    const r=await calculateCoverPercent({sourceFumen,coverPattern:'ZIS',percentPattern:'*p7',clear,mode:'normal',mirror:'no'});
    assert.equal(r.count,1);
    assert.equal(r.solutions[0].solveTotal,5040);
    assert.equal(r.solutions[0].solve,3108);
  });

  test(`${clear}-line compatibility: congruent and congruentcover lifted from 4-line golden`,async()=>{
    const sourceFumen=liftWithFullRows(F,rows);
    const congruent=await calculateCongruent({sourceFumen,pattern:'*p7',clear});
    assert.equal(congruent.count,1);
    const pages=decoder.decode(congruent.fumen);
    assert.equal(pages.length,1);
    assert.equal(pages[0].comment,'ZIS');
    assert.equal(sig(pages[0],clear),sig(decoder.decode(sourceFumen)[0],clear));

    const cover=await calculateCongruentCover({sourceFumen,pattern:'*p7',clear,mode:'normal',mirror:'no'});
    assert.equal(cover.covered,432);
    assert.equal(cover.total,5040);
    assert.equal(cover.failed,4608);
    assert.equal(sha(cover.failedQueues),'abc29f28362dfb40b7923f0207dc81a63b6c47b38b8a0ad90c44ce09354d02c2');
  });
}
