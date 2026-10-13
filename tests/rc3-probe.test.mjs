import test from 'node:test';
import assert from 'node:assert/strict';
import {decideExperimentalProbe} from '../src/min-cover-triage-experiment.mjs';
import {solveExactSecondary} from '../src/min-cover-exact-secondary.mjs';
import {createNumericCoverage} from '../src/numeric-cover-data.mjs';
test('RC3 retains P15 budgets and unknown fallback across both hard boundaries',()=>{
  for(const hard of [false,true])for(let d=0;d<=60;d++){
    const s={candidateCount:100,count:d+2,forcedCount:2};
    const old=decideExperimentalProbe('P15',hard,s),next=decideExperimentalProbe('P15_SEED1K',hard,s);
    assert.equal(next.useProbe,true);assert.equal(next.probeBudget,old.useProbe?100000:1000);
  }
  for(const s of [null,{}, {candidateCount:1,count:2,forcedCount:0}])for(const hard of [false,true]){
    const next=decideExperimentalProbe('P15_SEED1K',hard,s);assert.equal(next.useProbe,!hard);assert.equal(next.probeBudget,hard?null:100000);
  }
});
test('actual secondary path enforces budget, forwards incomplete seed once, and accepts completed probe',()=>{
  const keys=Array.from({length:80},(_,i)=>String(i).padStart(3,'0'));
  const m=createNumericCoverage(keys,new Map([[0,keys.map((_,i)=>[i,1])]]),[{caseId:0}]);
  for(const hard of [false,true])for(const k of [9,10,14,15])for(const completed of [false,true]){
    const searches=[],seed=keys.slice(1,k+1),probe={completed,count:k,keys:seed,searchedStates:5};
    const options={solver:{minimumCoverAtCount(_c,_k,o){searches.push(o);return probe;}},qualityFor:()=>1,primary:{count:k,backend:'rust'},primaryKeys:keys.slice(0,k),primaryHard:hard,kernelStats:{},deferThreshold:c=>c};
    const r=solveExactSecondary(m.coverage,options);assert.equal(searches.length,1);
    assert.equal(searches[0].stateBudget,k<=(hard?9:14)?100000:1000);
    if(completed){assert.equal(r.qualityBackend,'rust-quality-integrated');assert.deepEqual(r.keys,seed);}
    else{assert.equal(r.integratedProbe,probe);assert.deepEqual(r.primaryKeys,options.primaryKeys);}
    searches.length=0;solveExactSecondary(m.coverage,{...options,integratedProbe:probe});assert.equal(searches.length,0);
  }
});
