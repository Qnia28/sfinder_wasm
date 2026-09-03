import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCover,calculateCoverPercent,calculateCongruentCover} from '../src/batch-features.mjs';
import {runWorkerRequest} from '../src/worker-runtime.mjs';

const FUMEN='v115@ThR4BeBtCeR4zhBtKeAgH';

test('cover preserves duplicate cases across union branches',async()=>{
  const r=await calculateCover({sourceFumen:FUMEN,pattern:'*p7;*p7',clear:4,mode:'normal',mirror:'no'});
  assert.equal(r.total,10080);
  assert.equal(r.covered,864);
  assert.equal(r.failed,9216);
  assert.equal(r.covered+r.failed,r.total);
  assert.equal(r.failedQueues.length,9216);
  assert.equal(r.targets[0].coverage,864);
});

test('coverpercent keeps total and per-solution union coverage consistent',async()=>{
  const r=await calculateCoverPercent({sourceFumen:FUMEN,pattern:'*p7;*p7',clear:4,mode:'normal',mirror:'no'});
  assert.equal(r.total,10080);
  assert.equal(r.covered,864);
  assert.equal(r.failed,9216);
  assert.ok(Math.abs(r.totalCoverPercent-864/10080*100)<1e-12);
  assert.equal(r.count,1);
  assert.equal(r.solutions[0].covered,864);
  assert.ok(Math.abs(r.solutions[0].coverPercent-r.totalCoverPercent)<1e-12);
  assert.equal(r.solutions[0].solve,6216);
  assert.equal(r.solutions[0].solveTotal,10080);
});

test('congruentcover preserves duplicate cases across union branches',async()=>{
  const r=await calculateCongruentCover({sourceFumen:FUMEN,pattern:'*p7;*p7',clear:4,mode:'normal',mirror:'no'});
  assert.equal(r.total,10080);
  assert.equal(r.covered,864);
  assert.equal(r.failed,9216);
  assert.equal(r.covered+r.failed,r.total);
  assert.equal(r.failedQueues.length,9216);
});

test('per-save-minimals preserves duplicate cases across union branches',async()=>{
  const r=await runWorkerRequest({kind:'per-save-minimals',input:{
    sourceFumen:'v115@vhAAgH',
    pattern:'OOOOOI;OOOOOI',
    targetLines:2,
  }});
  assert.equal(r.total,2);
  assert.equal(r.pcSuccess,2);
  assert.equal(r.results.I.success,2);
  assert.equal(r.results.I.saveRate,1);
  assert.equal(r.results.I.guaranteed,true);
  assert.equal(r.results.I.label,'☆ Save I');
  assert.equal(r.results.I.coverageCounts[0],2);
});
