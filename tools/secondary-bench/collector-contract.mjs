// Diagnostic only. Uses the production compact ALL collector; no secondary solve.
import assert from 'node:assert/strict';
import { collectCommand } from './extract.mjs';
import { collectCompactMinimals } from '../../src/minimals-compact.mjs';
import { prepareCoverageMatrix } from '../../src/highs-cardinality.mjs';
import { makeOrderCountQuality } from '../../src/human-ranking.mjs';
import { identity } from './contracts.mjs';

export function canonicalCoverage(group) {
  const matrix = prepareCoverageMatrix(group.coverage, makeOrderCountQuality(group.qualityIndex));
  const caseIds = [...group.coverage].map(([id]) => id);
  return matrix.cases.map((row, i) => ({ caseId: caseIds[i], edges: row.map(([id, quality]) => [matrix.keys[id], quality])
    .sort((a, b) => a[0].localeCompare(b[0])) })).sort((a, b) => String(a.caseId).localeCompare(String(b.caseId)));
}
export function auditAllCollector(command, solver) {
  assert.equal(command.kind, 'minimals'); assert.equal(command.wantedSave, 'ALL');
  const captured = collectCommand(command, solver);
  const compact = solver.enumeratePcPatternCompact(captured.board, captured.cases.map(c => c.queue), command.useHold);
  assert(compact, 'BOX preflight requires production compact enumeration path');
  const ordinary = collectCompactMinimals(compact, captured.cases, 'ALL');
  const adapter = canonicalCoverage(captured.groups.get('ALL')), production = canonicalCoverage(ordinary);
  assert.deepEqual(adapter, production, 'adapter differs from production ALL collector');
  return { status: 'COLLECTOR_MATCH', rows: adapter.length, originalWeightedRowsHash: identity(adapter),
    boundary: 'DIAGNOSTIC_TWO_ENUMERATIONS_NOT_RUNTIME_SAMPLE', production: 'collectCompactMinimals' };
}
