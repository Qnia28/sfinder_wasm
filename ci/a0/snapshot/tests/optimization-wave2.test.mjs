import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {createWasmSolver} from '../src/wasm-backend.mjs';
const lex=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length};
function brute(rows,n){let best;for(let bits=0;bits<2**n;bits++){const ids=Array.from({length:n},(_,i)=>i).filter(i=>bits&(1<<i));if(best&&ids.length>best.ids.length)continue;const q=rows.map(row=>Math.max(0,...row.filter(([id])=>bits&(1<<id)).map(([,q])=>q))).sort((a,b)=>a-b);if(q.some(x=>!x))continue;if(!best||ids.length<best.ids.length||lex(q,best.q)>0||(lex(q,best.q)===0&&lex(ids,best.ids)<0))best={ids,q};}return best;}
function view(rows,n){const keys=Array.from({length:n},(_,i)=>'k'+String(i).padStart(3,'0'));return {keys,coverage:new Map(rows.map((row,i)=>[i,new Set(row.map(([id])=>keys[id]))])),qualityFor:(key,ci)=>rows[ci].find(([id])=>keys[id]===key)?.[1]};}
test('kernel and exact searches preserve exhaustive optima, weighted duplicate rows and bounded recovery',async()=>{
 const s=await createWasmSolver(4);const old=process.env.BASELINE_ROOT?await(await import(pathToFileURL(process.env.BASELINE_ROOT+'/src/wasm-backend.mjs'))).createWasmSolver(4):null;
 let random=381;const next=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return random>>>0};
 try{for(let sample=0;sample<100;sample++){const n=3+next()%6,rows=Array.from({length:3+next()%12},()=>{const r=[];for(let id=0;id<n;id++)if(next()%3)r.push([id,1+next()%7]);return r.length?r:[[next()%n,1]];});rows.push(rows[0].slice());const expected=brute(rows,n),ids=rows.map(row=>row.map(([id])=>id));
 const actual=s.minimumCoverIds(rows,n);assert.deepEqual(actual.selectedIds,expected.ids);assert.deepEqual(actual.qualityVector,expected.q);assert.equal(s.minimumCoverCardinalityIds(ids,n).count,expected.ids.length);
 const kernel=s.primaryKernelize(ids,n);assert.equal(kernel.forced.length+s.minimumCoverCardinalityIds(kernel.cases,kernel.solutionIds.length).count,expected.ids.length);
 if(old){assert.deepEqual(actual,old.minimumCoverIds(rows,n));assert.deepEqual(kernel,old.primaryKernelize(ids,n));}
 const v=view(rows,n),options={qualityFor:v.qualityFor,seedKeys:expected.ids.map(id=>v.keys[id])};
 for(const integrated of [false,true]){for(const stateBudget of [1,3,100000]){const opts={...options,integrated,stateBudget};const r=s.minimumCoverAtCount(v.coverage,expected.ids.length,opts);if(old)assert.deepEqual(r,old.minimumCoverAtCount(v.coverage,expected.ids.length,opts));if(r.completed){assert.deepEqual(r.keys,options.seedKeys);assert.deepEqual(r.qualityVector,expected.q);}}
 const r=s.minimumCoverAtCount(v.coverage,expected.ids.length,{...options,integrated});assert.deepEqual(r.keys,options.seedKeys);assert.deepEqual(r.qualityVector,expected.q);}
 }}finally{s.close();old?.close();}
});
test('dynamic covered buffers handle K above 16 and word boundaries after budget abort',async()=>{
 const s=await createWasmSolver(4);try{for(const n of [17,63,64,65]){const rows=Array.from({length:n},(_,id)=>[[id,1+id%3]]),v=view(rows,n);for(const integrated of [true,false]){
 const opts={qualityFor:v.qualityFor,seedKeys:v.keys,integrated};s.minimumCoverAtCount(v.coverage,n,{...opts,stateBudget:1});const r=s.minimumCoverAtCount(v.coverage,n,opts);assert.deepEqual(r.keys,v.keys);assert.equal(r.count,n);assert.equal(r.completed,true);if(integrated)assert.ok(r.searchedStates>n);assert.deepEqual(r.qualityVector,rows.flatMap(r=>r.map(x=>x[1])).sort((a,b)=>a-b));
 }}}finally{s.close()}
});
