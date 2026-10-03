import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,read,verify} from './common.mjs';
const build=read(`${ROOT}/.a0/four/BUILD.json`),solvers={},makers={};let calls=0;
for(const arm of ['R','A0','M1','M2','control']){
 const root=`${ROOT}/${build.outputs[arm].runtime}`;
 const {createWasmSolver}=await import(pathToFileURL(`${root}/src/wasm-backend.mjs`));
 solvers[arm]=await createWasmSolver(4,{legal:false});
 makers[arm]=(await import(pathToFileURL(`${root}/src/numeric-cover-data.mjs`))).createNumericCoverage;
}
let state=0x3800359;const next=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
function oracle(m){
 let best=null,seed=null;
 for(let mask=1;mask<(1<<m.keys.length);mask++){
  const ids=m.keys.map((_,i)=>i).filter(i=>mask&(1<<i));
  const quality=m.rows.map(r=>Math.max(0,...r.filter(([i])=>mask&(1<<i)).map(([,q])=>q))).sort((a,b)=>a-b);
  if(!quality[0])continue;
  if(!best||ids.length<best.ids.length){best={ids,quality};seed=ids;}
  else if(ids.length===best.ids.length){seed=ids;const sign=quality.findIndex((q,i)=>q!==best.quality[i]);
   if(sign>=0?quality[sign]>best.quality[sign]:ids.some((v,i)=>v!==best.ids[i])&&ids[ids.findIndex((v,i)=>v!==best.ids[i])]<best.ids[ids.findIndex((v,i)=>v!==best.ids[i])])best={ids,quality};}
 }
 return {...best,seed};
}
try{
 for(let sample=0;sample<122;sample++){
  const n=sample>=120?(sample===120?8:10):4+next()%5,keys=Array.from({length:n},(_,i)=>String(i).padStart(3,'0')),rows=[];
  if(sample>=120){
   // Antichains avoid primary dominance: 70/252 distinct active rows span
   // two/four coverage words and exercise the partial-word cutoff + padding.
   for(let mask=1;mask<(1<<n);mask++){
    const ids=keys.map((_,i)=>i).filter(i=>mask&(1<<i));
    if(ids.length===n/2)rows.push(ids.map(i=>[i,1+(i*7+mask)%23]));
   }
  }else for(let j=0;j<3+sample%9;j++){
    const row=[];for(let id=0;id<n;id++)if(next()%3)row.push([id,[1,7,23,0xffffffff][next()%4]]);
    if(!row.length)row.push([next()%n,1]);if(sample%3===0)row.push([...row[0]]);rows.push(row);
   }
  rows.push(rows[0].map(e=>[...e]));const m={keys,rows},o=oracle(m);m.K=o.ids.length;m.seedKeys=o.seed.map(i=>keys[i]);
  const coverages=Object.fromEntries(Object.entries(makers).map(([arm,make])=>[arm,make(keys,new Map(rows.map((r,i)=>[i,r])),rows.map((_,caseId)=>({caseId}))).coverage]));
  let completedStates;
  for(const budget of [1,2,5,31,100000]){
   const results={};
   for(const arm of ['R','A0','M1','M2','control']){
    results[arm]=solvers[arm].minimumCoverAtCount(coverages[arm],m.K,{seedKeys:m.seedKeys,stateBudget:budget,integrated:true,partitioned:arm!=='R',dominance:false,qualityFor:()=>{throw Error('numeric quality fallback forbidden');}});calls++;
    const w=verify(m,results[arm]);assert(results[arm].searchedStates<=budget);
    if(results[arm].completed){assert.deepEqual(w.selectedIDs,o.ids);assert.deepEqual(results[arm].qualityVector,o.quality);}
   }
   for(const arm of ['M1','M2','control'])assert.deepEqual(results[arm],results.A0,`${arm} must preserve A0 result/states/budget boundary sample${sample}`);
   if(budget===100000){assert(results.A0.completed&&results.R.completed);completedStates=results.A0.searchedStates;}
  }
  for(const budget of [...new Set([Math.max(1,completedStates-1),completedStates,completedStates+1])]){
   const results={};for(const arm of ['A0','M1','M2']){results[arm]=solvers[arm].minimumCoverAtCount(coverages[arm],m.K,{seedKeys:m.seedKeys,stateBudget:budget,integrated:true,partitioned:true,qualityFor:()=>{throw Error('numeric only');}});calls++;}
   assert.deepEqual(results.M1,results.A0);assert.deepEqual(results.M2,results.A0);
  }
 }
 console.log(JSON.stringify({status:'SYNTHETIC_FOUR_ARM_ORACLE_PASS',samples:122,syntheticNativeCalls:calls,actualInputCalls:0,multiwordAntichainFixtures:2,
  fullWeightedQualityStableIds:true,seedPreserved:true,boundedIncumbentsAndStatesPreserved:true,defaultSourceControlParity:true,mode:build.mode}));
}finally{for(const solver of Object.values(solvers))solver.close();}
