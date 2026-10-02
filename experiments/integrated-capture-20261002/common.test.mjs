import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { HERE, read, mirror, patterns, primaryOnly, validateSeed, matrixIdentity } from './common.mjs';
test('geometry reflection is reversible and sampling families have correct lengths', () => {
  assert.equal(mirror(mirror(0x123456789an)), 0x123456789an);
  assert.deepEqual(patterns(7, true), [{ id: 'restricted-split', pattern: '[IJL]p3,*p4' }]);
  assert.equal(patterns(8)[1].pattern, '[IJL]p3,*p5');
  assert.equal(patterns(5)[1].pattern, '[IJL]p3,*p2');
});
test('primary-only guard permits cardinality and blocks quality entrypoints', () => {
  const solver = { e: { solver_min_cover_cardinality: () => 2, solver_min_cover: () => 0,
    solver_min_cover_at_count_integrated_bounded: () => 0, solver_primary_kernelize: () => 1 } };
  const audit = primaryOnly(solver);
  assert.equal(solver.e.solver_min_cover_cardinality(), 2);
  assert.equal(solver.e.solver_primary_kernelize(), 1);
  assert.throws(() => solver.minimumCoverAtCount(), /SECONDARY_FORBIDDEN/);
  assert.throws(() => solver.e.solver_min_cover(), /SECONDARY_FORBIDDEN/);
  assert.throws(() => solver.e.solver_min_cover_at_count_integrated_bounded(), /SECONDARY_FORBIDDEN/);
  assert.deepEqual(audit, { forbiddenCalls: 3, cardinalityCalls: 1, kernelCalls: 1 });
});
test('original duplicate rows remain weighted and seed coverage is checked', () => {
  const matrix = { keys: ['a', 'b'], rows: [[[0, 2]], [[0, 2]], [[1, 3]]],
    cases: [{ caseId: '0' }, { caseId: '1' }, { caseId: '2' }], K: 2, seedKeys: ['a', 'b'], primary: { cardinalityProven: true } };
  validateSeed(matrix);
  assert.throws(() => validateSeed({ ...matrix, K: 1, seedKeys: ['a'] }), /cover/);
  assert.notEqual(matrixIdentity(matrix), matrixIdentity({ ...matrix, rows: matrix.rows.slice(1) }));
});
test('frozen sample covers cycle1 and 64/16 distinct QB groups without partition leakage', () => {
  const selection = read(path.join(HERE, 'selection.json'));
  const qb = selection.selectedRecords.filter(row => row.db === 'qb.json');
  assert.equal(selection.selectedRecords.filter(row => row.db === 'cycle1.json').length, 45);
  assert.equal(qb.filter(row => row.partition === 'development').length, 64);
  assert.equal(qb.filter(row => row.partition === 'reserved-validation').length, 16);
  assert.equal(new Set(qb.map(row => row.mirrorGroup)).size, 80);
  assert.equal(qb.some(row => row.overlapsDevelopmentGeometry), false);
  assert.equal(selection.secondaryAllowed, false);
  assert.equal(selection.tasks.reduce((sum, task) => sum + task.families.length * 8, 0), selection.expectedClassifications);
});
