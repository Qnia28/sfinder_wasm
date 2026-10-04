import test from 'node:test';
import assert from 'node:assert/strict';
import { fullRequest } from './request.mjs';
test('synthetic existing product fixture runs full enumeration/primary/probe/output with identical ON OFF results',async()=>{
  const entry={request:{sourceFumen:'v115@9gRpDezhRpEeQ4hlg0zhBtR4gli0CeBtQ4glJeAgH',analysisPattern:'T,*p3',wantedSave:'T',height:4,
    exactHumanQuality:'true',primary:'rust',secondary:'rust',exactProbeTiming:true}};
  const off=await fullRequest(entry,'reference'),on=await fullRequest(entry,'a0-m1');
  for(const key of ['minimalCount','keys','humanQualityVector','humanQualityExact','outputSha256'])assert.deepEqual(on[key],off[key]);
  assert(on.requestApiMs>0&&off.requestApiMs>0);
  assert.equal(on.calls.filter(c=>c.integrated).length,1);assert.equal(off.calls.filter(c=>c.integrated).length,1);
  assert.equal(on.calls.find(c=>c.integrated).partitioned,true);assert.equal(off.calls.find(c=>c.integrated).partitioned,false);
  assert.equal(on.regeneratedMatrixSha256,off.regeneratedMatrixSha256);
  assert(on.exactProbeTrace.apiMs>=0&&on.exactProbeTrace.loadMs>=0);
});
