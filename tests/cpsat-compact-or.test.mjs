// Tiny independent exhaustive evaluator of the emitted protobuf constraints.
// No ORTools/WASM execution or population fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as nodeApi from '../src/vendor/ortools/node/cp-sat.js';
import * as browserApi from '../src/vendor/ortools/browser/cp-sat.js';
import { solveCpSecondaryModel, secondaryQualityVector } from '../src/cpsat-secondary-model.mjs';

const lit=(xs,id)=>id>=0?xs[id]:1-xs[-id-1];
const linear=(xs,e)=>(e.vars??[]).reduce((sum,id,i)=>sum+Number(e.coeffs[i])*xs[id],Number(e.offset??0));
function feasible(xs,p) {
  return p.constraints.every(c=>{
    if(!(c.enforcementLiteral??[]).every(id=>lit(xs,id)))return true;
    if(c.boolOr)return c.boolOr.literals.some(id=>lit(xs,id));
    if(c.boolAnd)return c.boolAnd.literals.every(id=>lit(xs,id));
    if(c.linMax)return linear(xs,c.linMax.target)===Math.max(...c.linMax.exprs.map(e=>linear(xs,e)));
    assert(c.linear,'unrecognized constraint');const value=linear(xs,c.linear),d=c.linear.domain;
    return d.some((lo,i)=>i%2===0&&value>=Number(lo)&&value<=Number(d[i+1]));
  });
}
class EnumeratingSolver {
  async solve(model,options) {
    assert.equal(options.numWorkers,1);assert.equal(Object.hasOwn(options,'maxTimeInSeconds'),false);
    const p=model.proto();assert(p.variables.length<=18,'synthetic evaluator bound');
    let best=Infinity;
    for(let bits=0;bits<2**p.variables.length;bits++) {
      const xs=p.variables.map((v,i)=>(bits>>i)&1);
      if(!feasible(xs,p))continue;
      const value=linear(xs,p.objective);
      if(value<best){best=value;this.chosen=xs;}
    }
    assert(Number.isFinite(best),'synthetic model infeasible');
    this.objective=best*(p.objective.scalingFactor??1);return 'OPTIMAL';
  }
  value(v){return this.chosen[v.index];}
  objectiveValue(){return this.objective;}
  bestObjectiveBound(){return this.objective;}
  statusName(s){return s;}
}
const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function oracle(f) {
  let selected,quality;
  for(let bits=0;bits<2**f.keys.length;bits++) {
    const ids=f.keys.flatMap((_,i)=>bits&(1<<i)?[i]:[]);if(ids.length!==f.count)continue;
    const q=secondaryQualityVector(f.rows,ids);if(q[0]===0)continue;
    if(!selected||compare(q,quality)>0||compare(q,quality)===0&&compare(ids,selected)<0){selected=ids;quality=q;}
  }
  return {keys:selected.map(i=>f.keys[i]),qualityVector:quality};
}

test('compact Boolean model matches original-row oracle and legacy linMax over all stages',async()=>{
  const cases=[
    {keys:['a','b','c','d'],count:1,seed:[0],rows:[[[0,1],[1,6],[2,6],[3,3]],[[0,1],[1,6],[2,6],[3,3]],[[0,6],[1,5],[2,5],[3,2]],[[0,4],[1,2],[2,2],[3,4]]]},
    {keys:['a','b','c'],count:2,seed:[0,1],rows:[[[0,1]],[[0,1],[1,1],[2,1]],[[1,1],[2,1]]]},
    {keys:['a','b','c'],count:1,seed:[0],rows:[[[0,1],[0,6],[1,6],[2,2]],[[0,3],[1,3],[2,7]]]},
  ];
  for(let sample=0;sample<12;sample++)cases.push({keys:['a','b','c'],count:sample%2+1,seed:sample%2?[0,1]:[0],
    rows:Array.from({length:4},(_,r)=>[0,1,2].filter(i=>i===0||(sample+r+i)%3!==0).map(i=>[i,(sample*7+r*3+i*5)%6+1]))});
  for(const api of [nodeApi,browserApi]) {
    // A model-class adapter restores the historical encoding only in this tiny test.
    class LegacyModel extends api.CpModel {
      addBoolOr(xs) {
        const c=super.addBoolOr(xs);
        c.onlyEnforceIf=y=>{this.proto().constraints.pop();super.addMaxEquality(y,xs);return c;};
        return c;
      }
      addBoolAnd(){return {onlyEnforceIf(){}};}
    }
    for(const f of cases) {
      const expected=oracle(f);
      for(const CpModel of [api.CpModel,LegacyModel]) {
        const r=await solveCpSecondaryModel(f,{...api,CpModel,CpSolver:EnumeratingSolver});
        assert.equal(r.completed,true);assert.equal(r.qualityComplete,true);assert.equal(r.tieComplete,true);
        assert.deepEqual({keys:r.keys,qualityVector:r.qualityVector},expected);
      }
    }
  }
});

test('new constraints fix each auxiliary in both directions independently of the objective',async()=>{
  let proto;
  class Capture {async solve(m){proto=m.proto();return 'UNKNOWN';}statusName(s){return s;}}
  await solveCpSecondaryModel({keys:['a','b','c'],count:1,seed:[0],rows:[[[0,1],[1,3],[2,3]]]},
    {...nodeApi,CpSolver:Capture});
  const pair={constraints:proto.constraints.filter(c=>c.enforcementLiteral)};
  assert.equal(pair.constraints.length,2);
  for(let x1=0;x1<2;x1++)for(let x2=0;x2<2;x2++)for(let y=0;y<2;y++)
    assert.equal(feasible([0,x1,x2,y],pair),y===(x1||x2));
});
