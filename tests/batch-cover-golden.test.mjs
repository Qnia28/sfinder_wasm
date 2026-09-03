import test from'node:test';import assert from'node:assert/strict';import crypto from'node:crypto';
import{calculateCover}from'../src/batch-features.mjs';
const F='v115@ThR4BeBtCeR4zhBtKeAgH';
const sha=a=>crypto.createHash('sha256').update([...a].sort().join('\n')).digest('hex');
test('ezcover golden: 432/5040 and exact failed set',async()=>{const r=await calculateCover({sourceFumen:F,pattern:'*p7',clear:4,mode:'normal',mirror:'no'});assert.equal(r.covered,432);assert.equal(r.total,5040);assert.equal(r.failed,4608);assert.equal(sha(r.failedQueues),'abc29f28362dfb40b7923f0207dc81a63b6c47b38b8a0ad90c44ce09354d02c2');assert.deepEqual(new Set(r.targets[0].orders),new Set(['SIZ','ISZ','IZS','ZIS']));});


test('cover normalization assembles a single-page operation Fumen',async()=>{
 const r=await calculateCover({sourceFumen:'v115@vhATJJ',pattern:'O',clear:4,mode:'normal',mirror:'no'});
 assert.equal(r.covered,1);assert.equal(r.total,1);assert.equal(r.failed,0);
});
