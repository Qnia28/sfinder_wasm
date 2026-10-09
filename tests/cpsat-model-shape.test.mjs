// Actual JS model builder + vendor model classes, with solver replaced by a spy.
// Normalization/OR sharing is retained, but the compact model has no linMax.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CpModel, LinearExpr } from '../src/vendor/ortools/node/cp-sat.js';
import { solveCpSecondaryModel } from '../src/cpsat-secondary-model.mjs';

test('quality OR uses paired Boolean lists with the same shared auxiliaries', async () => {
  let observed;
  class NoSolver {
    async solve(model) { observed = model.proto(); return 'UNKNOWN'; }
    statusName(value) { return value; }
  }
  const result = await solveCpSecondaryModel({ keys: ['a','b','c','d'],count:1,seed:[0],
    rows:[[[0,1],[1,2],[2,3]],[[0,1],[1,2],[2,3]],[[0,2],[1,3],[3,4]]] },
    {CpModel,LinearExpr,CpSolver:NoSolver});
  assert.equal(result.completed,false);
  assert.equal(observed.variables.length,7);
  assert.equal(observed.constraints.filter(c=>c.boolOr&&!c.enforcementLiteral).length,2);
  assert.equal(observed.constraints.filter(c=>c.linMax).length,0);
  const ors=observed.constraints.filter(c=>c.boolOr&&c.enforcementLiteral);
  const ands=observed.constraints.filter(c=>c.boolAnd);
  assert.equal(ors.length,3);assert.equal(ands.length,3);
  assert.equal(ors.reduce((sum,c)=>sum+c.boolOr.literals.length,0),7);
  assert.equal(ands.reduce((sum,c)=>sum+c.boolAnd.literals.length,0),7);
});
