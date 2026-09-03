import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {calculateCover,calculateCoverPercent,calculateCongruentCover} from '../src/batch-features.mjs';

const sha=xs=>crypto.createHash('sha256').update([...xs].sort().join('\n')).digest('hex');
const CASES=[
  {
    name:'LEGS 3P',fumen:'v115@9gRpHeRpHeilGeglzhOeAgH',pattern:'*p7',
    cover:384,solve:5040,congruentCount:1,congruentCover:384,
    coverFailedHash:'31e82d4db2f675053dc6da7e2b54388055603f161067987a89b4b9f3b7c5aad4',
    congruentFailedHash:'31e82d4db2f675053dc6da7e2b54388055603f161067987a89b4b9f3b7c5aad4',
  },
  {
    name:'ALT JAWS 4P',fumen:'v115@DhzhGeQ4hlEeBtR4glFeBtQ4glJeAgH',pattern:'*p6',
    cover:336,solve:3466,congruentCount:4,congruentCover:1144,
    coverFailedHash:'1d53ec345f323ba210db1467ab4c27ce850ca1933925bd07bb6d1b49809530ef',
    congruentFailedHash:'58d182e0951f08de36916bef354839c244cc4d802bfe1dc5b2cbab4240cf43eb',
  },
  {
    name:'GRACE SYSTEM 6P',fumen:'v115@9gili0DeglAtRpQ4g0DeBtRpR4DeAtzhQ4NeAgH',pattern:'*p7',
    cover:648,solve:3552,congruentCount:2,congruentCover:1160,
    coverFailedHash:'b86c3afb2965dde1677953c5ec83a2fa09554fbbdccc0a34216519742c9819d9',
    congruentFailedHash:'80bd49efd37612f0aefea93944bb25723ef1f94a37533c53658d3d952c18a509',
  },
];

for(const c of CASES){
  test(`cover exact failed-queue oracle: ${c.name}`,async()=>{
    const r=await calculateCover({sourceFumen:c.fumen,pattern:c.pattern,clear:4,mode:'normal',mirror:'no'});
    assert.equal(r.covered,c.cover);
    assert.equal(r.total,5040);
    assert.equal(sha(r.failedQueues),c.coverFailedHash);
  });
  test(`coverpercent oracle after cover fix: ${c.name}`,async()=>{
    const r=await calculateCoverPercent({sourceFumen:c.fumen,pattern:c.pattern,clear:4,mode:'normal',mirror:'no'});
    assert.equal(r.covered,c.cover);
    assert.equal(r.total,5040);
    assert.equal(r.count,1);
    assert.equal(r.solutions[0].solve,c.solve);
    assert.equal(r.solutions[0].solveTotal,5040);
  });
  test(`congruentcover exact failed-queue oracle: ${c.name}`,async()=>{
    const r=await calculateCongruentCover({sourceFumen:c.fumen,pattern:c.pattern,clear:4,mode:'normal',mirror:'no'});
    assert.equal(r.count,c.congruentCount);
    assert.equal(r.covered,c.congruentCover);
    assert.equal(r.total,5040);
    assert.equal(sha(r.failedQueues),c.congruentFailedHash);
  });
}
