import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCover} from '../src/batch-features.mjs';

// Synthetic fixtures were cross-checked against SFinder cover using equivalent
// operation Fumens. They exercise mode classification independently of the
// wrapper golden's normal-only target.
const TETRIS='v115@9gD8whI8whI8whI8whE8JeAgH';
const TSM='v115@KhA8wwEeC8ywD8CeA8AeA8NeAgH';
const TSS='v115@IhwwA8HexwGeA8wwH8JeAgH';

async function covered(fumen,mode,pattern){
  return (await calculateCover({sourceFumen:fumen,pattern,clear:4,mode,mirror:'no'})).covered;
}

test('cover mode aliases: one vertical I satisfies tetris, tetris-end and 1..4 line modes',async()=>{
  for(const mode of ['normal','b2b','tetris','tetris-end','1l','2lines','3line','4l','4line-or-pc']){
    assert.equal(await covered(TETRIS,mode,'I'),1,mode);
  }
  for(const mode of ['any','tss','tsd','tst']) assert.equal(await covered(TETRIS,mode,'I'),0,mode);
});

test('T-spin Mini fixture satisfies any/tsm and b2b, not regular TSS+',async()=>{
  for(const mode of ['normal','b2b','any','tsm']) assert.equal(await covered(TSM,mode,'T'),1,mode);
  for(const mode of ['tss','tsd','tst']) assert.equal(await covered(TSM,mode,'T'),0,mode);
});

test('regular TSS fixture satisfies any/tss/b2b but not tsd/tst',async()=>{
  for(const mode of ['normal','b2b','any','tss']) assert.equal(await covered(TSS,mode,'T'),1,mode);
  for(const mode of ['tsd','tst']) assert.equal(await covered(TSS,mode,'T'),0,mode);
});

test('mirror=yes keeps FUMEN_A union coverage at SFinder golden 432/5040',async()=>{
  const r=await calculateCover({sourceFumen:'v115@ThR4BeBtCeR4zhBtKeAgH',pattern:'*p7',clear:4,mode:'normal',mirror:'yes'});
  assert.equal(r.covered,432);assert.equal(r.total,5040);assert.equal(r.failed,4608);
});
