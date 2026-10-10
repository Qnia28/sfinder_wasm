// Fresh product command. Saved fixtures are audit-only, read after the timer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { digest,sha256,safePath } from '../contracts.mjs';
import { validateFixture,selectedVector } from '../../contracts.mjs';

export async function executeProduct(job) {
  assert.equal(job.exactHumanQuality,'true');assert(['DEV','RC'].includes(job.variant));
  const bytes=fs.readFileSync(job.commandPath);assert.equal(sha256(bytes),job.commandSha256);
  const input=JSON.parse(bytes),c=input.command;assert.equal(c.clear,4);assert.equal(c.useHold,true);
  assert(c.queueLength!==11,'excluded empty-board 11P');
  const load=name=>import(pathToFileURL(path.join(job.productRoot,'src',name)));
  let solver;const start=performance.now();let calculation,encoded;
  try {
    const {createWasmSolver}=await load('wasm-backend.mjs');solver=await createWasmSolver(4);
    if(c.kind==='minimals'){
      const api=await load('minimals-feature.mjs');
      calculation=await api.calculateSaveMinimals({sourceFumen:c.sourceFumen,analysisPattern:c.pattern,wantedSave:'ALL',solver,
        useHold:true,height:4,exactHumanQuality:'true',primary:'auto',secondary:'auto'});
      encoded=api.encodeSaveMinimalFumen(calculation);
    } else {
      assert.equal(c.kind,'per-save');const api=await load('per-save-minimals.mjs');
      calculation=await api.calculatePerSaveMinimalsAsync({sourceFumen:c.sourceFumen,pattern:c.pattern,solver,useHold:true,targetLines:4,
        exactHumanQuality:'true',primary:'auto',secondary:'auto',secondaryWorkers:1,filterWorkers:0,includeCoverage:false});
      encoded=api.encodePerSaveMinimals({sourceFumen:c.sourceFumen,title:'',calculation});
    }
    const policySettledMs=performance.now()-start;
    // Projection and original weighted witness validation are outside product time.
    const groups=c.kind==='minimals'?{ALL:calculation}:calculation.results;
    assert.deepEqual(Object.keys(groups).sort(),input.filters.toSorted());
    const verified={},outcomes={};
    for(const [filter,r] of Object.entries(groups)){
      const ref=input.fixtures.find(f=>f.filter===filter),keys=[...(r.keys??[])].sort();
      const quality=r.humanQualityVector??[];assert.equal(r.humanQualityExact,true,'product exact flag');
      if(ref){
        const raw=fs.readFileSync(safePath(job.bundleRoot,ref.member));assert.equal(sha256(raw),ref.sha256);
        const f=validateFixture(JSON.parse(raw));const index=new Map(f.keys.map((k,i)=>[k,i]));
        const vector=selectedVector(f,keys.map(k=>index.get(k)));
        assert.equal(r.minimalCount,f.K);assert.deepEqual(quality,vector);
        verified[filter]={keys,qualityVector:vector,count:f.K};
      } else {
        assert.equal(r.success,0);assert.equal(keys.length,0);assert.equal(quality.length,0);
        verified[filter]={keys:[],qualityVector:[],count:0};
      }
      outcomes[filter]={minimalCount:r.minimalCount,success:r.success??r.saveSuccess,primaryResolved:r.primaryResolved,
        cardinalityBackend:r.cardinalityBackend,qualityBackend:r.qualityBackend,humanQualityExact:r.humanQualityExact};
    }
    return {status:'EXACT',policySettledMs,responseMs:policySettledMs,verified,outcomes,commandSha256:job.commandSha256,
      encodedSha256:digest(encoded),variant:job.variant,qualityRequested:'true',qualityResolved:'true',
      proof:{witnessAudit:'PASS',engineExact:true,independentOptimality:false},
      total:calculation.total??calculation.cases.length,productRoot:job.productRoot,
      timingContract:'product-command-cold-settled-v1'};
  } finally {solver?.close();}
}
