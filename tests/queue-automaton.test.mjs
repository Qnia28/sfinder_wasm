import test from'node:test';
import assert from'node:assert/strict';
import{canQueueBuildOrder,createQueueOrderProjector}from'../src/batch-orders.mjs';

function legacy(queue,order,useHold=true){let states=new Set(['0|-']);for(const wanted of order){const next=new Set();for(const state of states){const[is,hs]=state.split('|'),idx=Number(is),hold=hs==='-'?null:hs;if(idx<queue.length&&queue[idx]===wanted)next.add(`${idx+1}|${hold??'-'}`);if(useHold){if(hold===null){if(idx+1<queue.length&&queue[idx+1]===wanted)next.add(`${idx+2}|${queue[idx]}`)}else if(hold===wanted){if(idx<queue.length)next.add(`${idx+1}|${queue[idx]}`);else if(idx===queue.length)next.add(`${idx}|-`)}}}states=next;if(!states.size)return false}return true}

let seed=0x12345678;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}const P='IJLOSTZ';

test('integer queue/hold automaton matches legacy Set<string> implementation',()=>{
 const fixed=[['IL','LI',true],['IL','LI',false],['TILJSZO','TILJSZ',true],['TILJSZO','ZST',true],['','',true],['T','T',false]];
 for(const[x,y,h]of fixed)assert.equal(canQueueBuildOrder(x,y,h),legacy(x,y,h),`${x}/${y}/${h}`);
 for(let t=0;t<10000;t++){const qn=1+rnd()%9,on=rnd()%9;let queue='',order='';for(let i=0;i<qn;i++)queue+=P[rnd()%7];for(let i=0;i<on;i++)order+=P[rnd()%7];for(const hold of[false,true])assert.equal(canQueueBuildOrder(queue,order,hold),legacy(queue,order,hold),`case=${t} q=${queue} o=${order} hold=${hold}`)}
});


test('prefix-sharing queue projector matches scalar Hold automaton',()=>{
 const queues=[];for(let i=0;i<240;i++){const n=4+rnd()%5;let q='';for(let j=0;j<n;j++)q+=P[rnd()%7];queues.push(q)}
 const projector=createQueueOrderProjector(queues);
 for(let t=0;t<300;t++){const n=rnd()%8;let order='';for(let j=0;j<n;j++)order+=P[rnd()%7];for(const hold of[false,true]){const expected=[];for(let i=0;i<queues.length;i++)if(canQueueBuildOrder(queues[i],order,hold))expected.push(i);assert.deepEqual(projector.coverageForOrder(order,hold),expected,`${order}/${hold}`)}}
});
