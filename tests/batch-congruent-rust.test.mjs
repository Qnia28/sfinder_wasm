import test from'node:test';
import assert from'node:assert/strict';
import{decoder}from'tetris-fumen';
import{fieldMasks}from'../src/batch-geometry.mjs';
import{findCongruentSolutions}from'../src/batch-setup.mjs';
import{expandPattern}from'../src/pattern.mjs';
import{loadBatchWasm,BatchReachability}from'../src/batch-backend.mjs';

function shape(rows){return rows.map(x=>({key:x.key,orders:[...x.orders].sort()})).sort((a,b)=>a.key.localeCompare(b.key)||a.orders.join('').localeCompare(b.orders.join('')))}
test('integrated Rust congruent search matches legacy 3P traversal',async()=>{
 const page=decoder.decode('v115@9gRpHeRpHeilGeglzhOeAgH')[0],{base,fill}=fieldMasks(page,4),queues=expandPattern('*p7'),fast=new BatchReachability(await loadBatchWasm(),4,'tetrio');
 const legacy={placeExact:fast.placeExact.bind(fast),tSpinKind:fast.tSpinKind.bind(fast)};
 assert.deepEqual(shape(findCongruentSolutions({base,fill,queues,height:4,reachability:fast,useHold:true})),shape(findCongruentSolutions({base,fill,queues,height:4,reachability:legacy,useHold:true})));
});

test('integrated Rust congruent search matches legacy 4P traversal',async()=>{
 const page=decoder.decode('v115@DhzhGeQ4hlEeBtR4glFeBtQ4glJeAgH')[0],{base,fill}=fieldMasks(page,4),queues=expandPattern('*p7'),fast=new BatchReachability(await loadBatchWasm(),4,'tetrio');
 const legacy={placeExact:fast.placeExact.bind(fast),tSpinKind:fast.tSpinKind.bind(fast)};
 assert.deepEqual(shape(findCongruentSolutions({base,fill,queues,height:4,reachability:fast,useHold:true})),shape(findCongruentSolutions({base,fill,queues,height:4,reachability:legacy,useHold:true})));
});


test('integrated Rust congruent search matches legacy real 7P traversal',async()=>{
 const page=decoder.decode('v115@+gR4GeR4BtCeRpg0ilBtAewwRpg0glzhywh0JeAgH')[0],{base,fill}=fieldMasks(page,4),queues=expandPattern('*p7'),fast=new BatchReachability(await loadBatchWasm(),4,'tetrio');
 const legacy={placeExact:fast.placeExact.bind(fast),tSpinKind:fast.tSpinKind.bind(fast)};
 assert.deepEqual(shape(findCongruentSolutions({base,fill,queues,height:4,reachability:fast,useHold:true})),shape(findCongruentSolutions({base,fill,queues,height:4,reachability:legacy,useHold:true})));
});

test('integrated Rust congruent search supports 10-operation target',async()=>{
 const page=decoder.decode('v115@9g3pJeAgH')[0],{base,fill}=fieldMasks(page,4),queues=['OOOOOOOOOO'],fast=new BatchReachability(await loadBatchWasm(),4,'tetrio');
 const legacy={placeExact:fast.placeExact.bind(fast),tSpinKind:fast.tSpinKind.bind(fast)};
 assert.deepEqual(shape(findCongruentSolutions({base,fill,queues,height:4,reachability:fast,useHold:true})),shape(findCongruentSolutions({base,fill,queues,height:4,reachability:legacy,useHold:true})));
});
