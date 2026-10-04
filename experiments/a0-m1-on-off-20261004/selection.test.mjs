import test from 'node:test';
import assert from 'node:assert/strict';
import { HERE, read, matrix } from './common.mjs';
import { expandPatternCases } from '../../src/pattern.mjs';
import { decodeAndValidate } from '../../src/pc-input.mjs';
test('same122 original gzip bytes, weighted rows, stable IDs, K and proofs remain locked',()=>{
  const entries=read(`${HERE}/INPUTS.json`).entries;assert.equal(entries.length,122);
  assert.equal(new Set(entries.map(e=>e.id)).size,122);
  for(const e of entries){const m=matrix(e);assert(e.selectionReasons.length);assert(m.seedKeys.length===m.K);assert(m.rows.length===m.cases.length);
    const context=decodeAndValidate(e.request.sourceFumen,e.request.height);assert.equal(context.board.toString(16),m.board);
    const expanded=new Map(expandPatternCases(e.request.analysisPattern).map(c=>[c.caseId,c.queue]));
    for(const c of m.cases)assert.equal(expanded.get(c.sourceCaseId??c.caseId),c.queue,e.id);
  }
});
test('full ON/OFF100pairs on10runners,5forward5reverse,adjacent pairs and fixed controls',()=>{
  const s=read(`${HERE}/SCHEDULE.json`),groups=Map.groupBy(s.runs,r=>r.blockId);assert.equal(s.runs.length,24480);
  assert.equal(new Set(s.runs.map(r=>r.runId)).size,24480);
  assert.equal(s.runs.filter(r=>r.kind==='ENVIRONMENT_CONTROL').length,80);
  for(const pair of groups.values()){assert.deepEqual(pair.map(r=>r.position),[1,2]);assert.equal(pair[0].matrixId,pair[1].matrixId);}
  for(let h=0;h<10;h++){
    const own=s.runs.filter(r=>r.host===h);assert.equal(own.length,2448);
    for(const e of read(`${HERE}/INPUTS.json`).entries){const pairs=[...groups.values()].filter(p=>p[0].host===h&&p[0].matrixId===e.id&&p[0].kind==='FULL_REQUEST');
      assert.equal(pairs.length,10);assert.equal(pairs.filter(p=>p[0].policy==='reference').length,5);}
  }
});
