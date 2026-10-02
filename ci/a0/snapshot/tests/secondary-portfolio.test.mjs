import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSecondaryPortfolio } from '../src/min-cover-secondary-portfolio.mjs';
import { createNumericCoverage } from '../src/numeric-cover-data.mjs';

function view(rows) {
  return createNumericCoverage(['a', 'b', 'c'], new Map(rows.map((r, i) => [i, r])), rows.map((_, caseId) => ({ caseId }))).coverage;
}
const triangle = () => view([[[0,1],[1,1]], [[1,1],[2,1]], [[0,1],[2,1]]]);
const result = (keys, completed = false) => ({ keys, count: keys.length, completed, searchedStates: 3 });
const base = () => ({ count:2, seedKeys:['b','c'], cardinalityProven:true,
  qualityFor:()=>{throw new Error('packed qualities required');}, integratedStates:10, thresholdStates:20,
  totalBudgetMs:10000, solveCpsat:()=>{throw new Error('unexpected CP');} });

test('integrated exact returns without threshold or CP loading', async () => {
  let calls=0;
  const r=await solveSecondaryPortfolio(triangle(), {...base(), solver:{minimumCoverAtCount(_,k,o){
    calls++; assert.equal(k,2); assert.equal(o.integrated,true); assert.equal(o.stateBudget,10);
    return result(['b','a'],true);
  }}});
  assert.equal(calls,1); assert.deepEqual(r.keys,['a','b']); assert.equal(r.portfolio.route,'integrated'); assert(r.qualityExact);
});

test('bounded stages pass the best seed and CP requires the final tie proof', async () => {
  const calls=[];
  const r=await solveSecondaryPortfolio(triangle(), {...base(), solver:{minimumCoverAtCount(_,k,o){
    calls.push(o); return result(o.integrated?['a','c']:['b','c']);
  }}, solveCpsat:async o=>{
    assert.deepEqual(o.seedKeys,['a','c']); assert(o.limitMs>0&&o.limitMs<=10000);
    return {...result(['a','b'],true),qualityComplete:true,tieComplete:true};
  }});
  assert.deepEqual(calls.map(o=>o.stateBudget),[10,20]); assert.deepEqual(calls[1].seedKeys,['a','c']);
  assert.equal(r.portfolio.route,'cpsat'); assert.equal(r.searchedStates,6); assert(r.qualityExact);
});

test('incomplete CP cannot discard a better Rust incumbent', async () => {
  const r=await solveSecondaryPortfolio(triangle(), {...base(),thresholdStates:0,
    solver:{minimumCoverAtCount:()=>result(['a','c'])},
    solveCpsat:async()=>({...result(['b','c']),qualityComplete:true,tieComplete:false})});
  assert.deepEqual(r.keys,['a','c']); assert.equal(r.completed,false); assert.equal(r.qualityExact,false);
});

test('proof of quality alone is not exact and false proof claims fail', async () => {
  const opts={...base(),integratedStates:0,thresholdStates:0};
  const r=await solveSecondaryPortfolio(triangle(),{...opts,
    solveCpsat:async()=>({...result(['a','b']),qualityComplete:true,tieComplete:false})});
  assert.equal(r.completed,false);
  await assert.rejects(solveSecondaryPortfolio(triangle(),{...opts,
    solveCpsat:async()=>({...result(['a','b'],true),qualityComplete:true,tieComplete:false})}),/stable-tie proof/);
});

test('zero time budget preserves the feasible seed without starting engines', async () => {
  const r=await solveSecondaryPortfolio(triangle(),{...base(),totalBudgetMs:0});
  assert.equal(r.completed,false); assert.deepEqual(r.keys,['b','c']); assert.equal(r.portfolio.stages.length,0);
});

test('original duplicate rows contribute to quality and override stable tie preference', async () => {
  const coverage=view([[[0,1],[1,3]],[[0,5],[1,1]],[[0,5],[1,1]]]);
  const r=await solveSecondaryPortfolio(coverage,{...base(),count:1,seedKeys:['b'],
    solver:{minimumCoverAtCount:()=>result(['a'],true)}});
  assert.deepEqual(r.qualityVector,[1,5,5]); assert.deepEqual(r.keys,['a']);
});

test('invalid or infeasible engine results are rejected', async () => {
  for (const bad of [result(['a','a']),result(['a','unknown']),result(['a']),
    {...result(['a','b']),completed:undefined},{...result(['a','b']),qualityVector:[2,2,2]}]) {
    await assert.rejects(solveSecondaryPortfolio(triangle(),{...base(),solver:{minimumCoverAtCount:()=>bad}}));
  }
  const coverage=view([[[0,1],[1,1]],[[1,1],[2,1]]]);
  await assert.rejects(solveSecondaryPortfolio(coverage,{...base(),count:1,seedKeys:['b'],
    solver:{minimumCoverAtCount:()=>result(['a'])}}),/cover every/);
});

test('exact engine cannot claim a solution worse than the feasible seed', async () => {
  await assert.rejects(solveSecondaryPortfolio(triangle(),{...base(),seedKeys:['a','b'],
    solver:{minimumCoverAtCount:()=>result(['b','c'],true)}}),/worse than/);
});

test('invalid budgets and missing cardinality proof fail before any engine', async () => {
  for (const change of [{cardinalityProven:false},{integratedStates:-1},{thresholdStates:1.2},
    {totalBudgetMs:Infinity},{totalBudgetMs:-1},{qualityFor:null},{solveCpsat:null}]) {
    await assert.rejects(solveSecondaryPortfolio(triangle(),{...base(),...change}));
  }
});

test('original singleton proof bypasses both Rust and CP', async () => {
  const r=await solveSecondaryPortfolio(view([[[0,2]],[[0,1],[1,3]]]),{...base(),count:1,seedKeys:['a']});
  assert.deepEqual(r.keys,['a']); assert.equal(r.portfolio.route,'trivial'); assert(r.completed);
});

test('proof reuse only forwards a prefix produced by this threshold invocation', async () => {
  const r=await solveSecondaryPortfolio(triangle(),{...base(),integratedStates:0,reuseThresholdProof:true,
    solver:{minimumCoverAtCount(_,k,o){assert.equal(o.proofProgress,true);return {...result(['a','c']),provenPrefix:[3]};}},
    solveCpsat:async o=>{assert.deepEqual(o.provenPrefix,[3]);return {...result(['a','b'],true),qualityComplete:true,tieComplete:true};}});
  assert(r.completed); assert.equal(r.portfolio.stages[0].provenThresholds,1);
});

test('missing, stale, or impossible threshold proof metadata is rejected', async () => {
  for(const provenPrefix of [undefined,[4],[2],[3,3],[-1],[1.5]]) {
    await assert.rejects(solveSecondaryPortfolio(triangle(),{...base(),integratedStates:0,reuseThresholdProof:true,
      solver:{minimumCoverAtCount:()=>({...result(['a','c']),provenPrefix})}}),/proof/);
  }
});
