import assert from 'node:assert/strict';
import {minimumCoverAdaptiveAsync} from '../../src/min-cover-adaptive.mjs';
import {solveExactSecondary} from '../../src/min-cover-exact-secondary.mjs';
import {createNumericCoverage} from '../../src/numeric-cover-data.mjs';
import {HERE,ROOT,read,write,jsonSha} from './common.mjs';
const phase=process.argv[2];assert(['development','reserved'].includes(phase));
if(phase==='reserved')assert.equal(read(`${ROOT}/.a0/freeze/FREEZE.json`).status,'FROZEN_INTEGRATED_SCOPE_NOT_DEV_APPROVAL');
const pop=read(`${HERE}/POPULATION.json`),selected=pop.entries.filter(e=>(e.partition==='reserved-validation')===(phase==='reserved')),ledger=[];
for(const e of selected.filter(e=>e.route==='TINY_LEGACY_EXACT')){
  let legacy=0;const keys=Array.from({length:e.n},(_,i)=>String(i).padStart(4,'0'));
  const solver={minimumCover(){legacy++;return {count:1,keys:[keys[0]],qualityVector:[1],searchedStates:0};},minimumCoverAtCount(){throw Error('A0 on tiny metadata dispatch');}};
  const result=await minimumCoverAdaptiveAsync(new Map([[0,new Set(keys)]]),{solver,qualityFor:()=>1,exactQuality:'true',secondary:'rust'});
  assert.equal(legacy,1);assert.equal(result.qualityDecision,'tiny-legacy-exact');ledger.push({matrixId:e.id,n:e.n,route:e.route,legacySpyCalls:1,integratedCalls:0,nativeCalls:0,decoded:false});
}
const nativeSpy={minimumCoverAtCount(c,k,o){assert(!o.integrated&&!o.partitioned);throw new Error('PRIMARY_HARD_CONTRACT_ONLY');}};
if(phase==='development'){
  const {coverage}=createNumericCoverage(['000','001','002'],new Map([[0,[[0,1],[1,1]]],[1,[[1,1],[2,1]]],[2,[[0,1],[2,1]]]]),[0,1,2].map(caseId=>({caseId})));
  const hard=selected.filter(e=>e.route==='THRESHOLD_FIRST_PRIMARY_HARD');assert.equal(hard.length,18);
  for(const e of hard){assert.throws(()=>solveExactSecondary(coverage,{primary:{count:2,backend:'rust'},primaryKeys:['000','002'],primaryHard:true,qualityFor:()=>1,solver:nativeSpy,kernelStats:{cases:3,solutions:3,entries:6}}),/PRIMARY_HARD_CONTRACT_ONLY/);ledger.push({matrixId:e.id,route:e.route,fixtureDerivedContext:true,integratedCalls:0,nativeCalls:0});}
  const tiny=createNumericCoverage(['000'],new Map([[0,[[0,2]]]]),[{caseId:0}]);
  const trivial=selected.filter(e=>e.route==='TRIVIAL_EXACT');assert.equal(trivial.length,3);
  for(const e of trivial){const result=solveExactSecondary(tiny.coverage,{primary:{count:1,backend:'kernel'},primaryKeys:['000'],primaryHard:false,qualityFor:()=>2,solver:{minimumCoverAtCount(){throw Error('trivial dispatch');}},kernelStats:{cases:1,solutions:1,entries:1}});assert.equal(result.qualityDecision,'trivial-exact');ledger.push({matrixId:e.id,route:e.route,fixtureDerivedContext:true,integratedCalls:0,nativeCalls:0});}
}
assert.equal(ledger.filter(r=>r.route==='TINY_LEGACY_EXACT').length,phase==='reserved'?115:806);
write(`${ROOT}/.a0/dispatch-${phase}/DISPATCH.json`,{status:'PASS',phase,populationMatrices:pop.entries.length,populationSha256:jsonSha(pop),routeCounts:pop.entries.reduce((a,e)=>(a[e.partition+':'+e.route]=(a[e.partition+':'+e.route]??0)+1,a),{}),ledger,
  originalMatricesDecoded:0,actualInputPrimaryCalls:0,actualInputPcCalls:0,nativeCalls:0,limitation:'Metadata/fixture dispatch spies only, not real tiny native quality/timing'});
console.log(JSON.stringify({phase,status:'PASS',tinyDispatches:phase==='reserved'?115:806}));
