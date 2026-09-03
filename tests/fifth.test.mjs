import test from'node:test';
import assert from'node:assert/strict';
import{decoder}from'tetris-fumen';
import{createWasmSolver}from'../src/wasm-backend.mjs';
import{calculateFifthFeature}from'../src/features.mjs';
import{fifthMinimalsPerSaves}from'../src/fifth.mjs';

const B='v115@9gglIeglHewwhlzhBexwzhEewwJeAgH',P='T,[^TIL]!,*p2';
const COUNTS={S:1,Z:1,O:1,L:2,J:1,I:1,T:1};

test('5th per-save minimals keep exact minimal counts and comments',async()=>{
  const s=await createWasmSolver(4);
  try{
    const calc=fifthMinimalsPerSaves({sourceFumen:B,analysisPattern:P,solver:s});
    assert.equal(calc.queues.length,1008);
    assert.equal(calc.bestsave,true);
    const counts={};
    for(const p of'SZOLJIT'){
      assert.equal(calc.usages[p].seen,288);
      assert.equal(calc.usages[p].success,288);
      assert.equal(calc.usages[p].availability,1);
      assert.equal(calc.usages[p].isSee,true);
      counts[p]=calc.results[p].solutions.length;
    }
    assert.deepEqual(counts,COUNTS);
    const r=await calculateFifthFeature({sourceFumen:B,pattern:P,title:'Regression 5th',solver:s});
    const pages=decoder.decode(r.fumen);
    assert.equal(pages.length,9);
    assert.deepEqual(pages.map(p=>p.comment),['Regression 5th','☆ See S','☆ See Z','☆ See O','☆ See L','☆ See L','☆ See J','☆ See I','☆ See T']);
  }finally{s.close()}
});

test('5th comments star only guaranteed See groups and never include percentages',async()=>{
  const f='v115@DhzhGeQ4hlEeBtR4glFeBtQ4glJeAgH',p='T,[^TIL]!,*p2',s=await createWasmSolver(4);
  try{
    const r=await calculateFifthFeature({sourceFumen:f,pattern:p,title:'ALT JAWS',solver:s});
    const comments=decoder.decode(r.fumen).map(x=>x.comment);
    assert.equal(comments[0],'ALT JAWS');
    assert.ok(comments.includes('☆ See O'));
    assert.ok(comments.includes('☆ See I'));
    assert.ok(comments.includes('☆ See T'));
    assert.ok(comments.includes('Use L'));
    assert.ok(comments.includes('Use J'));
    assert.ok(!comments.includes('☆ Use L'));
    assert.ok(!comments.includes('☆ Use J'));
    assert.ok(comments.every(x=>!x.includes('%')));
  }finally{s.close()}
});

test('5th supports duplicate semicolon branches without collapsing case multiplicity',async()=>{
  const s=await createWasmSolver(4);
  try{
    const calc=fifthMinimalsPerSaves({sourceFumen:B,analysisPattern:`${P};${P}`,solver:s});
    assert.equal(calc.cases.length,2016);
    assert.equal(calc.queues.length,2016);
    assert.equal(calc.bestsave,true);
    for(const p of'SZOLJIT'){
      assert.equal(calc.usages[p].seen,576);
      assert.equal(calc.usages[p].success,576);
      assert.equal(calc.usages[p].availability,1);
      assert.equal(calc.usages[p].isSee,true);
      assert.equal(calc.results[p].solutions.length,COUNTS[p]);
    }
  }finally{s.close()}
});

test('5th semicolon union uses each branch last bag and exact per-piece See denominator',async()=>{
  const Q='T,[^TIL]!,[TI]p2',U=`${P};${Q}`,s=await createWasmSolver(4);
  try{
    const a=fifthMinimalsPerSaves({sourceFumen:B,analysisPattern:P,solver:s});
    const b=fifthMinimalsPerSaves({sourceFumen:B,analysisPattern:Q,solver:s});
    const u=fifthMinimalsPerSaves({sourceFumen:B,analysisPattern:U,solver:s});
    assert.equal(a.cases.length,1008);
    assert.equal(b.cases.length,48);
    assert.equal(u.cases.length,1056);
    for(const p of'SZOLJIT'){
      const expectedSeen=p==='T'||p==='I'?48:0;
      assert.equal(b.usages[p].seen,expectedSeen,`branch B seen ${p}`);
      assert.equal(u.usages[p].seen,a.usages[p].seen+b.usages[p].seen,`union seen ${p}`);
      assert.equal(u.usages[p].success,a.usages[p].success+b.usages[p].success,`union success ${p}`);
      assert.ok(u.usages[p].success<=u.usages[p].seen,`success must not exceed seen for ${p}`);
      assert.equal(u.usages[p].availability,u.usages[p].seen?u.usages[p].success/u.usages[p].seen:0);
    }
    const r=await calculateFifthFeature({sourceFumen:B,pattern:U,title:'Union 5th',solver:s});
    const comments=decoder.decode(r.fumen).map(x=>x.comment);
    assert.equal(comments[0],'Union 5th');
    assert.ok(comments.every(x=>!x.includes('%')));
    assert.ok(comments.slice(1).every(x=>x.startsWith('☆ See ')||x.startsWith('Use ')));
  }finally{s.close()}
});
