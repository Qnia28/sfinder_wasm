// Synthetic secondary-only checks, independent exhaustive JS oracle.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, ROOT, VARIANTS, tune, dominanceAudit, verify, vector, compare, write, jsonSha } from './common.mjs';
const out=path.resolve(process.argv[2]);
let state=20261002;
const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/2**32};
function oracle(m){
  let best=null,worst=null,k=Infinity;
  for(let mask=1;mask<2**m.keys.length;mask++){
    const ids=[];for(let i=0;i<m.keys.length;i++)if(mask&(1<<i))ids.push(i);
    if(ids.length>k)continue;
    let q;try{q=vector(m,ids)}catch{continue}
    if(ids.length<k){k=ids.length;best=null;worst=null}
    if(!best||compare(q,best.q)>0||(compare(q,best.q)===0&&compare(ids,best.ids)<0))best={ids,q};
    if(!worst||compare(q,worst.q)<0||(compare(q,worst.q)===0&&compare(ids,worst.ids)>0))worst={ids,q};
  }
  assert(best&&worst);return{K:k,best,worst};
}
const fixtures=[];
for(let t=0;t<256;t++){
  const n=8+Math.floor(random()*7),rows=[];
  for(let r=0;r<18+Math.floor(random()*18);r++){
    const ids=new Set(),w=2+Math.floor(random()*3);while(ids.size<w)ids.add(Math.floor(random()*n));
    rows.push([...ids].map(i=>[i,1+Math.floor(random()*7)]));
    if(r%7===0)rows.push(structuredClone(rows.at(-1))); // Actual weighted duplicate rows.
  }
  fixtures.push({id:`random-${t}`,keys:Array.from({length:n},(_,i)=>`k${String(i).padStart(3,'0')}`),rows});
}
for(let t=0;t<32;t++){
  if(t<6){
    const n=63+t%3,m={id:`forced-boundary-${t}`,keys:Array.from({length:n},(_,i)=>`k${String(i).padStart(3,'0')}`),rows:Array.from({length:n},(_,i)=>[[i,1+i%4]])};
    const ids=Array.from({length:n},(_,i)=>i),q=vector(m,ids);fixtures.push({...m,known:{K:n,best:{ids,q},worst:{ids,q}}});
  }else if(t<14){
    const n=16,rows=Array.from({length:8},(_,i)=>[[i*2,1],[i*2+1,1]]);
    fixtures.push({id:`histogram-256covers-${t}`,keys:Array.from({length:n},(_,i)=>`k${String(i).padStart(3,'0')}`),rows});
  }else if(t<22){
    const n=14,pairs=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)pairs.push([[i,1+i%3],[j,1+j%4]]);
    fixtures.push({id:`case-bit-boundary-${t}`,keys:Array.from({length:n},(_,i)=>`k${String(i).padStart(3,'0')}`),rows:pairs.slice(0,63+t%3)});
  }else{
    const rows=[[[0,9],[1,3],[2,1]],[[0,8],[1,2],[2,1]],[[0,8],[1,2],[2,1]]];
    fixtures.push({id:`dominance-duplicate-tie-${t}`,keys:['k000','k001','k002'],rows});
  }
}
assert.equal(fixtures.length,288);
const solvers=new Map(),packers=new Map();
for(const variant of VARIANTS){
  const source=['H0','P0'].includes(variant)?path.join(ROOT,'.bench/baseline'):ROOT;
  const {createWasmSolver}=await import(pathToFileURL(path.join(source,'src/wasm-backend.mjs')));
  const {createNumericCoverage}=await import(pathToFileURL(path.join(source,'src/numeric-cover-data.mjs')));
  const s=await createWasmSolver(4,{legal:false});tune(s,variant);solvers.set(variant,s);packers.set(variant,createNumericCoverage);
}
const ledger=[];let nonoptimalSeeds=0,calls=0;
try{
 for(const fixture of fixtures){
  const o=fixture.known??oracle(fixture),m={...fixture,K:o.K,seedKeys:o.worst.ids.map(i=>fixture.keys[i])};
  if(compare(o.worst.q,o.best.q)<0)nonoptimalSeeds++;
  for(const budget of [1,16,100000,null]){
   const bridge=new Map();
   for(const variant of VARIANTS){
    const solver=solvers.get(variant),{coverage}=packers.get(variant)(m.keys,new Map(m.rows.map((r,i)=>[i,r])),m.rows.map((_,caseId)=>({caseId})));
    const r=solver.minimumCoverAtCount(coverage,m.K,{qualityFor:()=>{throw Error('Numeric data only')},seedKeys:m.seedKeys,integrated:true,partitioned:variant!=='H0',stateBudget:budget});
    const proof=verify(m,r);
    if(r.completed){assert.deepEqual(proof.ids,o.best.ids);assert.deepEqual(r.qualityVector,o.best.q)}
    const fingerprint=jsonSha({completed:r.completed,states:r.searchedStates,ids:proof.ids,q:r.qualityVector});
    bridge.set(variant,fingerprint);
    const audit=dominanceAudit(solver,variant);
    assert(audit.allocatedBytes<=64*2**20);
    assert(audit.pairVisits+audit.wordComparisons+audit.qualityComparisons<=50000000);
    ledger.push({fixture:m.id,variant,budget,completed:r.completed,states:r.searchedStates,fingerprint,dominance:audit.status});calls++;
   }
   assert.equal(bridge.get('P0'),bridge.get('P'),'Baseline/tuned bridge mismatch');
  }
 }
 assert(nonoptimalSeeds>100,'Optimal-only seed test regression');
 write(path.join(out,'CORRECTNESS.json'),{status:'PASS',fixtures:fixtures.length,calls,nonoptimalSeeds,minimumKSource:'independent-synthetic-brute-force-or-explicit-forced-oracle',ledger});
 console.log(JSON.stringify({status:'PASS',fixtures:fixtures.length,calls,nonoptimalSeeds}));
}finally{for(const s of solvers.values())s.close()}
