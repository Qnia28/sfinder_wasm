import test from'node:test';
import assert from'node:assert/strict';
import{PatternSyntaxError,queuesForFinder,parsePattern,expandPattern,expandPatternCases,lastBagInfo}from'../src/pattern.mjs';

test('negative bag changes only finder expression',()=>{
  assert.equal(queuesForFinder('T,[^TIL]!,*p2'),'T,[JSZO]!,*p2');
  assert.equal(queuesForFinder('T,[^TIL]!,*p2;O,[^OJS]!,*p2'),'T,[JSZO]!,*p2;O,[TILZ]!,*p2');
});

test('golden queue expansion counts',()=>{
  assert.equal(expandPattern('*p7').length,5040);
  assert.equal(expandPattern('T,[JSZO]!,*p2').length,1008);
  assert.equal(expandPattern('[IO]!,*p2').length,84);
  assert.equal(expandPattern('T,T,O,[LJISZ]p4').length,120);
});


test('wildcard bang is an exact seven-piece bag alias',()=>{
  assert.deepEqual(expandPattern('*!'),expandPattern('*p7'));
  assert.equal(expandPattern('*!').length,5040);
  assert.equal(queuesForFinder('*!'),'*p7');
  const info=lastBagInfo('*!');
  assert.equal(info.drawCount,7);
  assert.deepEqual([...info.pieces],[...'TILJSZO']);
});

test('ordering constraint subset',()=>{assert.equal(expandPattern('[SZ]p2{S<Z}').join(','),'SZ')});

test('semicolon is a union of independent SFinder pattern branches',()=>{
  assert.equal(expandPattern('TI,[JOS]!,*p2;TO,[IJS]!,*p2').length,504);
  assert.equal(expandPattern('S,[JLTZ]!,*p2;Z,[JLST]!,*p2').length,2016);
  const parsed=parsePattern('TI,[JOS]!,*p2;TO,[IJS]!,*p2');
  assert.equal(parsed.branches.length,2);
  assert.equal(parsed.depth,7);
});

test('duplicate concrete queues from different union branches preserve multiplicity',()=>{
  const queues=expandPattern('TI,*p5;TI,*p5');
  assert.equal(queues.length,5040);
  assert.equal(new Set(queues).size,2520);
});

test('concatenated and comma-separated SFinder syntax are equivalent',()=>{
  const joined=expandPattern('I[JS]![TO]!,*p2');
  const comma=expandPattern('I,[JS]!,[TO]!,*p2');
  assert.equal(joined.length,168);
  assert.deepEqual(joined,comma);
});

test('invalid wildcard and bag syntax is rejected instead of silently changing meaning',()=>{
  for(const pattern of ['*BAD','*7','*p0','*p8','[TT]!','[^TT]!','[TI]p3','[TI]p0','[TI','[]!']){
    assert.throws(()=>expandPattern(pattern),PatternSyntaxError,pattern);
    assert.throws(()=>queuesForFinder(pattern),PatternSyntaxError,pattern);
  }
});

test('union branches must have equal queue depth',()=>{
  assert.throws(()=>expandPattern('T,*p2;T,*p3'),/equal queue length/);
});

test('branch metadata preserves each last bag independently',()=>{
  const cases=expandPatternCases('TI,*p1;TI,[J]');
  const first=cases.find(x=>x.branchIndex===0&&x.queue==='TIJ');
  const second=cases.find(x=>x.branchIndex===1&&x.queue==='TIJ');
  assert.ok(first&&second);
  assert.deepEqual([...first.lastBag.pieces],[...'TILJSZO']);
  assert.equal(first.lastBag.drawCount,1);
  assert.deepEqual([...second.lastBag.pieces],['J']);
  assert.equal(second.lastBag.drawCount,1);
  assert.notEqual(first.caseId,second.caseId);
});

test('lastBagInfo remains available for one branch and rejects ambiguous unions',()=>{
  const info=lastBagInfo('T,[^TIL]!,*p2');
  assert.deepEqual([...info.pieces],[...'TILJSZO']);
  assert.equal(info.drawCount,2);
  assert.throws(()=>lastBagInfo('T,*p2;T,[IJ]p2'),/branch-specific last bags/);
});


test('observedBag spans a complete final bag across compatible fragments',()=>{
  const entry=expandPatternCases('T,[ILJSZO]!')[0];
  assert.equal(entry.lastBag.drawCount,6);
  assert.equal(entry.observedBag.drawCount,7);
  assert.deepEqual(new Set(entry.observedBag.pieces),new Set('TILJSZO'));
});
