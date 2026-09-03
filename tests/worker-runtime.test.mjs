import test from'node:test';import assert from'node:assert/strict';import{runWorkerRequest}from'../src/worker-runtime.mjs';
test('worker runtime uses WASM backend',async()=>{const r=await runWorkerRequest({kind:'chance',input:{sourceFumen:'v115@vhAAgH',pattern:'OOOOO',clear:2}});assert.deepEqual([r.success,r.total],[1,1])});

test('worker path returns coverage-sorted Fumen output',async()=>{
  const r=await runWorkerRequest({kind:'path',input:{
    sourceFumen:'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH',
    pattern:'*p7',
    clear:4,
  }});
  assert.deepEqual([r.total,r.solutionCount],[5040,47]);
  assert.equal(r.coverageCounts[0],1656);
  assert.ok(r.fumen);
});

test('worker minimals forwards uppercase UseHiGHS to primary backend routing',async()=>{
  const sourceFumen='v115@9gglIeglHewwhlzhBexwzhEewwJeAgH';
  const pattern='T,[^TIL]!,*p2';
  const base={sourceFumen,pattern,wantedSave:'T',exactHumanQuality:'Fast',fastStateBudget:1};
  const rust=await runWorkerRequest({kind:'minimals',input:{...base,UseHiGHS:'False'}});
  assert.equal(rust.minimalCount,7);
  assert.equal(rust.useHiGHSRequested,false);
  assert.equal(rust.useHiGHSResolved,false);
  assert.equal(rust.cardinalityBackend,'kernel');
  assert.equal(rust.qualityBackend,'fast-2x2');
  assert.equal(rust.humanQualityExact,false);

  const auto=await runWorkerRequest({kind:'minimals',input:{...base,UseHiGHS:'Auto'}});
  assert.equal(auto.minimalCount,7);
  assert.equal(auto.useHiGHSRequested,'auto');
  assert.equal(auto.useHiGHSResolved,false);
  assert.equal(auto.cardinalityBackend,'kernel');
  assert.equal(auto.qualityBackend,'fast-2x2');
  assert.equal(auto.humanQualityExact,false);
});


test('worker minimals is production adaptive and legacy-minimals preserves sync exact path',async()=>{
  const input={sourceFumen:'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH',pattern:'T,[^TIL]!,*p2',wantedSave:'T'};
  const current=await runWorkerRequest({kind:'minimals',input});
  const legacy=await runWorkerRequest({kind:'legacy-minimals',input});
  assert.equal(current.minimalCount,legacy.minimalCount);
  assert.deepEqual(current.coverageCounts,legacy.coverageCounts);
  assert.equal(typeof current.qualityBackend,'string');
  assert.equal(legacy.qualityBackend,undefined);
});

test('worker saves preserves legacy all-outcomes mode when wantedSave is omitted',async()=>{
  const r=await runWorkerRequest({kind:'saves',input:{
    sourceFumen:'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH',
    pattern:'T,[^TIL]!,*p2',
  }});
  assert.equal(r.total,1008);
  assert.equal(r.success,1008);
  assert.equal(r.saveResults.length,46);
  assert.equal(r.saveResults.find(x=>x.save==='TTILSZ')?.success,20);
});

test('worker saves evaluates multiple requested save expressions in one call',async()=>{
  const r=await runWorkerRequest({kind:'saves',input:{
    sourceFumen:'v115@9gglIeglHewwhlzhBexwzhEewwJeAgH',
    pattern:'T,[^TIL]!,*p2',
    wantedSave:'^T,!T,S&&Z,TT#T>X',
  }});
  assert.deepEqual(r.wantedSaveResults.map(x=>[x.saveLabel,x.success]),[
    ['^T',288],['!T',0],['S&&Z',1008],['T>X',152],
  ]);
});
