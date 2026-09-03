import test from'node:test';import assert from'node:assert/strict';import crypto from'node:crypto';import{decoder}from'tetris-fumen';import{calculateCongruent,calculateCongruentCover}from'../src/batch-features.mjs';
const F='v115@ThR4BeBtCeR4zhBtKeAgH';
function sig(page){let s='';for(let y=3;y>=0;y--){for(let x=0;x<10;x++)s+=page.field.at(x,y);s+='\n'}return s}
const sha=a=>crypto.createHash('sha256').update([...a].sort().join('\n')).digest('hex');
test('ezcongruent golden: one ZIS page with same coloured field',async()=>{const r=await calculateCongruent({sourceFumen:F,pattern:'*p7'});assert.equal(r.count,1);const a=decoder.decode(F)[0],pages=decoder.decode(r.fumen);assert.equal(pages.length,1);assert.equal(pages[0].comment,'ZIS');assert.equal(sig(pages[0]),sig(a));});
test('ezcongruentcover golden: 432/5040 and one ZIS congruent',async()=>{const r=await calculateCongruentCover({sourceFumen:F,pattern:'*p7',mode:'normal',mirror:'no'});assert.equal(r.covered,432);assert.equal(r.total,5040);assert.equal(r.failed,4608);const pages=decoder.decode(r.fumen);assert.equal(pages.length,1);assert.equal(pages[0].comment,'ZIS');assert.equal(sig(pages[0]),sig(decoder.decode(F)[0]));assert.equal(sha(r.failedQueues),'abc29f28362dfb40b7923f0207dc81a63b6c47b38b8a0ad90c44ce09354d02c2');});

test('blue-garbage matches wrapper converter semantics',async()=>{
 const f='v115@RhB8AeRpEeB8AeRpOeAgH';
 const normal=await calculateCongruent({sourceFumen:f,pattern:'OO',blueGarbage:false});
 const blue=await calculateCongruent({sourceFumen:f,pattern:'OO',blueGarbage:true});
 assert.equal(normal.count,1);assert.equal(normal.solutions[0].operations.length,1);assert.equal(normal.solutions[0].comment,'O');
 assert.equal(blue.count,1);assert.equal(blue.solutions[0].operations.length,2);assert.equal(blue.solutions[0].comment,'OO');
});

test('legacy congruent-cover TSM oracle with mirror: 3924/5040',async()=>{
 const f='v115@+gR4GeR4BtCeRpg0ilBtAewwRpg0glzhywh0JeAgH';
 const r=await calculateCongruentCover({sourceFumen:f,pattern:'*p7',mode:'tsm',mirror:'yes',blueGarbage:false});
 assert.equal(r.count,6);
 assert.equal(r.covered,3924);
 assert.equal(r.total,5040);
 assert.equal(r.failed,1116);
});
