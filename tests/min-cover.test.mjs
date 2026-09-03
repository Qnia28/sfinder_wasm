import test from'node:test';import assert from'node:assert/strict';
import{exactMinimumCover}from'../src/min-cover.mjs';

const coverage=rows=>new Map(rows.map(([id,keys])=>[id,new Set(keys)]));

test('independent exact cover preserves minimum cardinality',()=>{
  const c=coverage([['A',['X','Y']],['B',['Y','Z']],['C',['X','Z']]]);
  const r=exactMinimumCover(c);
  assert.equal(r.count,2);
  const selected=new Set(r.keys);
  for(const keys of c.values())assert.ok([...keys].some(k=>selected.has(k)));
});

test('human-quality tie-break improves the worst case after cardinality',()=>{
  const c=coverage([['A',['X','Y']],['B',['Z','W']]]);
  const q={X:100,Y:30,Z:1,W:30};
  const r=exactMinimumCover(c,{qualityFor:key=>q[key]});
  assert.equal(r.count,2);
  assert.deepEqual(r.qualityVector,[30,100]);
  assert.deepEqual(new Set(r.keys),new Set(['X','W']));
});

test('new min-cover cardinality matches brute force on deterministic random matrices',()=>{
  function brute(c){
    const keys=[...new Set([...c.values()].flatMap(s=>[...s]))];
    const full=[...c.values()];
    for(let k=0;k<=keys.length;k++){
      const chosen=[];
      function rec(i,left){
        if(left===0){const set=new Set(chosen);return full.every(row=>[...row].some(x=>set.has(x)))}
        if(keys.length-i<left)return false;
        chosen.push(keys[i]);if(rec(i+1,left-1))return true;chosen.pop();
        return rec(i+1,left);
      }
      if(rec(0,k))return k;
    }
    return Infinity;
  }
  let seed=0x12345678;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};
  for(let t=0;t<200;t++){
    const caseCount=1+Math.floor(rnd()*7),solutionCount=1+Math.floor(rnd()*7),c=new Map();
    for(let ci=0;ci<caseCount;ci++){
      const keys=new Set();for(let si=0;si<solutionCount;si++)if(rnd()<0.45)keys.add(`S${si}`);
      if(!keys.size)keys.add(`S${Math.floor(rnd()*solutionCount)}`);
      c.set(`C${ci}`,keys);
    }
    assert.equal(exactMinimumCover(c).count,brute(c));
  }
});

import{createWasmSolver}from'../src/wasm-backend.mjs';

test('Rust/WASM exact minimum-cover matches JavaScript fallback including human-quality tie-break',async()=>{
  const solver=await createWasmSolver(4);
  try{
    let seed=0x08912345;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
    for(let t=0;t<100;t++){
      const caseCount=1+Math.floor(rnd()*8),solutionCount=1+Math.floor(rnd()*8),coverage=new Map(),quality=new Map();
      for(let ci=0;ci<caseCount;ci++){
        const keys=new Set();
        for(let si=0;si<solutionCount;si++)if(rnd()<0.45){const key=`S${si}`;keys.add(key);quality.set(`${ci}|${key}`,1+Math.floor(rnd()*20))}
        if(!keys.size){const key=`S${Math.floor(rnd()*solutionCount)}`;keys.add(key);quality.set(`${ci}|${key}`,1+Math.floor(rnd()*20))}
        coverage.set(`C${ci}`,keys);
      }
      const qualityFor=(key,caseId)=>quality.get(`${Number(caseId.slice(1))}|${key}`)??0;
      const js=exactMinimumCover(coverage,{qualityFor}),wasm=solver.minimumCover(coverage,{qualityFor});
      assert.equal(wasm.count,js.count);
      assert.deepEqual(wasm.keys,js.keys);
      assert.deepEqual(wasm.qualityVector,js.qualityVector);
    }
  }finally{solver.close()}
});

test('Rust/WASM fixed-count locked-prefix search matches full exact result',async()=>{
  const solver=await createWasmSolver(4);
  try{
    const c=coverage([
      ['A',['X','Y','Q']],
      ['B',['X','Z']],
      ['C',['Y','W']],
      ['D',['Z','W','Q']],
    ]);
    const q=new Map([
      ['A|X',5],['A|Y',3],['A|Q',4],
      ['B|X',2],['B|Z',6],
      ['C|Y',6],['C|W',2],
      ['D|Z',3],['D|W',5],['D|Q',4],
    ]);
    const qualityFor=(key,caseId)=>q.get(`${caseId}|${key}`)??0;
    const full=solver.minimumCover(c,{qualityFor});
    const fixed=solver.minimumCoverAtCount(c,full.count,{qualityFor,seedKeys:full.keys});
    assert.deepEqual(fixed.keys,full.keys);
    assert.deepEqual(fixed.qualityVector,full.qualityVector);
    const levels=[...new Set([...q.values()])].sort((a,b)=>a-b).slice(1);
    const first=levels[0];
    const lockedCount=[...c.keys()].filter(caseId=>full.keys.some(key=>(q.get(`${caseId}|${key}`)??0)>=first)).length;
    const locked=solver.minimumCoverAtCount(c,full.count,{qualityFor,seedKeys:full.keys,lockedPrefix:[lockedCount]});
    assert.deepEqual(locked.keys,full.keys);
    assert.deepEqual(locked.qualityVector,full.qualityVector);
  }finally{solver.close()}
});

test('Rust/WASM fully locked quality prefix still resolves stable key tie',async()=>{
  const solver=await createWasmSolver(4);
  try{
    const c=coverage([
      ['C1',['A','B']],
      ['C2',['B','C']],
      ['C3',['C','D']],
    ]);
    const q=new Map([
      ['C1|A',1],['C1|B',1],
      ['C2|B',1],['C2|C',1],
      ['C3|C',2],['C3|D',2],
    ]);
    const qualityFor=(key,caseId)=>q.get(`${caseId}|${key}`)??0;
    const full=solver.minimumCover(c,{qualityFor});
    assert.deepEqual(full.keys,['A','C']);
    const locked=solver.minimumCoverAtCount(c,2,{qualityFor,seedKeys:['B','C'],lockedPrefix:[1]});
    assert.deepEqual(locked.keys,['A','C']);
    assert.deepEqual(locked.qualityVector,full.qualityVector);
  }finally{solver.close()}
});

test('Rust/WASM cardinality-only minimum cover matches full exact K',async()=>{
  const solver=await createWasmSolver(4);
  try{
    const coverage=new Map([
      ['A',new Set(['X','Y'])],
      ['B',new Set(['X','Z'])],
      ['C',new Set(['Y','Z'])],
      ['D',new Set(['W','Z'])],
    ]);
    const full=solver.minimumCover(coverage,{qualityFor:()=>1});
    const cardinality=solver.minimumCoverCardinality(coverage);
    assert.equal(cardinality.count,full.count);
    assert.equal(cardinality.keys.length,full.count);
    for(const solutions of coverage.values()) assert.ok(cardinality.keys.some((key)=>solutions.has(key)));
    assert.deepEqual(cardinality.qualityVector,[]);
  }finally{solver.close()}
});


test('Rust/WASM integrated fixed-K matches legacy exact and reports budget exhaustion',async()=>{
  const solver=await createWasmSolver(4);
  try{
    const c=coverage([
      ['A',['X','Y','Q']],
      ['B',['X','Z']],
      ['C',['Y','W']],
      ['D',['Z','W','Q']],
    ]);
    const q=new Map([
      ['A|X',5],['A|Y',3],['A|Q',4],
      ['B|X',2],['B|Z',6],
      ['C|Y',6],['C|W',2],
      ['D|Z',3],['D|W',5],['D|Q',4],
    ]);
    const qualityFor=(key,caseId)=>q.get(`${caseId}|${key}`)??0;
    const legacy=solver.minimumCover(c,{qualityFor});
    const integrated=solver.minimumCoverAtCount(c,legacy.count,{qualityFor,seedKeys:legacy.keys,integrated:true});
    assert.equal(integrated.completed,true);
    assert.deepEqual(integrated.keys,legacy.keys);
    assert.deepEqual(integrated.qualityVector,legacy.qualityVector);
    const bounded=solver.minimumCoverAtCount(c,legacy.count,{qualityFor,seedKeys:legacy.keys,integrated:true,stateBudget:1});
    assert.equal(bounded.completed,false);
    assert.equal(bounded.count,legacy.count);
    assert.equal(bounded.keys.length,legacy.count);
  }finally{solver.close();}
});


test('qualityFor null is explicitly cardinality-only in JS and WASM paths',async()=>{
  const c=coverage([['A',['X','Y']],['B',['X','Z']],['C',['Y','Z']]]);
  const js=exactMinimumCover(c);
  assert.equal(js.count,2);
  assert.deepEqual(js.qualityVector,[]);
  const solver=await createWasmSolver(4);
  try{
    const wasm=solver.minimumCover(c);
    assert.equal(wasm.count,2);
    assert.deepEqual(wasm.qualityVector,[]);
    assert.throws(()=>solver.minimumCoverAtCount(c,2,{seedKeys:wasm.keys}),/requires a positive human-quality provider/);
  }finally{solver.close()}
});

test('zero quality is rejected for covered edges by JS and WASM quality APIs',async()=>{
  const c=coverage([['A',['X']],['B',['X','Y']]]);
  assert.throws(()=>exactMinimumCover(c,{qualityFor:()=>0}),/human quality must be an integer number in 1/);
  const solver=await createWasmSolver(4);
  try{
    assert.throws(()=>solver.minimumCover(c,{qualityFor:()=>0}),/human quality must be an integer number in 1/);
    assert.throws(()=>solver.minimumCoverAtCount(c,1,{qualityFor:()=>0,seedKeys:['X']}),/human quality must be an integer number in 1/);
  }finally{solver.close()}
});
