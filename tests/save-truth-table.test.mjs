import test from'node:test';
import assert from'node:assert/strict';
import{compileExactSaveExpression,compileSaveExpression,evaluateSaveExpression,saveMaskToString,saveMultiplicityCodeToString,savedMask,savedString,tetrisSort}from'../src/saves.mjs';

function containsSubsequence(save,want){let i=0;for(const p of save){if(p===want[i])i++;if(i===want.length)return true}return want.length===0}
function legacyEval(save,expr){expr=expr.trim();let depth=0;for(let i=0;i<expr.length-1;i++){if(expr[i]==='(')depth++;else if(expr[i]===')')depth--;else if(depth===0&&expr.slice(i,i+2)==='||')return legacyEval(save,expr.slice(0,i))||legacyEval(save,expr.slice(i+2));}depth=0;for(let i=0;i<expr.length-1;i++){if(expr[i]==='(')depth++;else if(expr[i]===')')depth--;else if(depth===0&&expr.slice(i,i+2)==='&&')return legacyEval(save,expr.slice(0,i))&&legacyEval(save,expr.slice(i+2));}if(expr.startsWith('!'))return!legacyEval(save,expr.slice(1));if(expr.startsWith('(')&&expr.endsWith(')'))return legacyEval(save,expr.slice(1,-1));if(expr.startsWith('/')&&expr.endsWith('/'))return new RegExp(expr.slice(1,-1)).test(save);const wanted=tetrisSort(expr.replace(/\^/g,''));const hit=containsSubsequence(save,wanted);return expr.startsWith('^')?!hit:hit}

const EXPRESSIONS=['T','TI','^T','T||I','T&&I','!(T&&I)','(T||I)&&!Z','/T.*S/','/^T/','^TIL','(T&&S)||(I&&Z)'];

test('save expression truth tables exactly match legacy semantics for all 128 save sets',()=>{
 for(const expr of EXPRESSIONS){const table=compileSaveExpression(expr);assert.equal(table.length,128);for(let mask=0;mask<128;mask++){const save=saveMaskToString(mask),expected=legacyEval(save,expr);assert.equal(!!table[mask],expected,`${expr} ${save} mask=${mask}`);assert.equal(evaluateSaveExpression(save,expr),expected)}}
});

function legacySavedString(queue,solution,{pieces,drawCount}){const ORDER='TILJSZO',drawn=new Set(queue.slice(-drawCount)),saved=new Set([...pieces].filter(p=>!drawn.has(p))),counts=s=>{const m=new Map();for(const c of s)m.set(c,(m.get(c)||0)+1);return m},q=counts(queue),maskPieces='IJLOSTZ';for(const[p,n]of q){const i=maskPieces.indexOf(p),used=i<0?0:popcount(solution.masks[i])/4;if(n>used)saved.add(p)}return[...saved].sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b)).join('')}
function popcount(x){let n=0n;for(;x;x>>=1n)n+=x&1n;return Number(n)}

test('savedMask/savedString preserve legacy save-set calculation',()=>{
 const analyses=[
  {pieces:new Set('TILJSZO'),drawCount:3},
  {pieces:new Set('JSZO'),drawCount:2},
  {pieces:new Set('TIL'),drawCount:0},
 ];
 const solutions=[
  {masks:[0xfn,0xf0n,0xf00n,0xf000n,0xf0000n,0xf00000n,0xf000000n]},
  {masks:[0xffn,0n,0xf00n,0n,0xf0000n,0n,0n]},
 ];
 for(const queue of ['TIJ','TILJSZO','JJSTO','OZTIL'])for(const analysis of analyses)for(const solution of solutions){const expected=legacySavedString(queue,solution,analysis);assert.equal(savedString(queue,solution,analysis),expected);assert.equal(saveMaskToString(savedMask(queue,solution,analysis)),expected)}
});

test('scalar save compiler ignores #alias for compatibility',()=>{
  for(let mask=0;mask<128;mask++){
    const save=saveMaskToString(mask);
    assert.equal(
      evaluateSaveExpression(save,'T#KEEP-T'),
      evaluateSaveExpression(save,'T'),
      save,
    );
  }
});


test('exact minimals predicate preserves repeated-piece multiplicity and ALL',()=>{
  const code=(counts)=>{const order='TILJSZO';let value=0;for(let i=0;i<order.length;i++)value|=(counts[order[i]]??0)<<(i*3);return value};
  const tripleT=code({T:3});
  assert.equal(saveMultiplicityCodeToString(tripleT),'TTT');
  assert.equal(compileExactSaveExpression('TT')(tripleT),true);
  assert.equal(compileExactSaveExpression('TTT')(tripleT),true);
  assert.equal(compileExactSaveExpression('/TTT/')(tripleT),true);
  assert.equal(compileExactSaveExpression('TTT')(code({T:2})),false);
  assert.equal(compileExactSaveExpression('ALL')(code({T:2})),true);
});
