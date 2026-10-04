import test from 'node:test';
import assert from 'node:assert/strict';
import { fullRequest } from './request.mjs';
import { collectUnusedMatrix } from './unused-matrix.mjs';
import { prepareSaveCase, savedMultiplicityCodePrepared, compileExactSaveExpression } from '../../src/saves.mjs';
import { requestMatrixSha256 } from './common.mjs';
test('undrawn bag T never enters captured unused-T filter; duplicate weighted rows remain intact',()=>{
  const geometry=new Uint32Array(17);
  geometry[0]=0xff;geometry[2]=0xff00;geometry[4]=0xf0000;geometry[8]=0xf00000;
  const compact={count:1,stride:17,geometry,offsets:new Uint32Array([0,2]),caseIds:new Uint32Array([0,1]),qualities:new Uint32Array([3,5])};
  const cases=[{caseId:'0:0',queue:'IJLIJLS'},{caseId:'0:1',queue:'IJLIJLS'}];
  const ordinary=collectUnusedMatrix(compact,cases,'ordinary'),leftL=collectUnusedMatrix(compact,cases,'L'),leftT=collectUnusedMatrix(compact,cases,'T');
  assert.equal(leftT.coverage.size,0);assert.equal(leftL.coverage.size,2);
  assert.deepEqual(leftL.prepared.cases,[[[0,3]],[[0,5]]]);
  assert.equal(requestMatrixSha256(leftL.prepared.keys,leftL.prepared.rawCases,leftL.prepared.cases),
    requestMatrixSha256(ordinary.prepared.keys,ordinary.prepared.rawCases,ordinary.prepared.cases));
  const meta=prepareSaveCase(cases[0].queue,{pieces:new Set('TIJLSZO'),drawCount:4});
  assert(compileExactSaveExpression('T')(savedMultiplicityCodePrepared(meta,ordinary.geometry.usage(0))));
});
test('synthetic existing product fixture runs full enumeration/primary/probe/output with identical ON OFF results',async()=>{
  const entry={filter:'ordinary',request:{sourceFumen:'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH',analysisPattern:'T,*p3',height:4,
    exactHumanQuality:'true',primary:'rust',secondary:'rust',exactProbeTiming:true}};
  const off=await fullRequest(entry,'reference'),on=await fullRequest(entry,'a0-m1');
  for(const key of ['minimalCount','keys','humanQualityVector','humanQualityExact','outputSha256'])assert.deepEqual(on[key],off[key]);
  assert(on.requestApiMs>0&&off.requestApiMs>0);
  assert.equal(on.calls.filter(c=>c.integrated).length,1);assert.equal(off.calls.filter(c=>c.integrated).length,1);
  assert.equal(on.calls.find(c=>c.integrated).partitioned,true);assert.equal(off.calls.find(c=>c.integrated).partitioned,false);
  assert.equal(on.regeneratedMatrixSha256,off.regeneratedMatrixSha256);
  assert(on.exactProbeTrace.apiMs>=0&&on.exactProbeTrace.loadMs>=0);
});
