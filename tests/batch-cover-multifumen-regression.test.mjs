import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCover} from '../src/batch-features.mjs';

const CASES=[
  ['LEGS 3P','v115@9gRpHeRpHeilGeglzhOeAgH','*p7',384,5040],
  ['ALT JAWS 4P','v115@DhzhGeQ4hlEeBtR4glFeBtQ4glJeAgH','*p6',336,5040],
  ['GRACE SYSTEM 6P','v115@9gili0DeglAtRpQ4g0DeBtRpR4DeAtzhQ4NeAgH','*p7',648,5040],
  ['ALT JAWS short queue','v115@DhzhGeQ4hlEeBtR4glFeBtQ4glJeAgH','*p4',22,840],
];

for(const[name,sourceFumen,pattern,covered,total]of CASES){
  test(`cover multi-fumen SFinder oracle: ${name}`,async()=>{
    const r=await calculateCover({sourceFumen,pattern,clear:4,mode:'normal',mirror:'no'});
    assert.equal(r.covered,covered);
    assert.equal(r.total,total);
    assert.equal(r.failed,total-covered);
  });
}
