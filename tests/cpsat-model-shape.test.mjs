// Actual JS model builder + vendor model classes, with solver replaced by a spy.
// Normalization/OR sharing is retained by the R17 linMax candidate.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CpModel, LinearExpr } from '../src/vendor/ortools/node/cp-sat.js';
import { solveCpSecondaryModel } from '../src/cpsat-secondary-model.mjs';

test('quality OR restores linMax with the same shared auxiliaries', async () => {
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
  const maxima=observed.constraints.filter(c=>c.linMax);
  assert.equal(maxima.length,3);
  const ors=observed.constraints.filter(c=>c.boolOr&&c.enforcementLiteral);
  const ands=observed.constraints.filter(c=>c.boolAnd);
  assert.equal(ors.length,0);assert.equal(ands.length,0);
  assert.equal(maxima.reduce((sum,c)=>sum+c.linMax.exprs.length,0),7);
});
