// Research adapter, not a product policy. Reuses product enumeration/save rules
// and the exact primary path, then intercepts deferred secondary before search.
import assert from 'node:assert/strict';
import { decodeAndValidate } from '../../src/pc-input.mjs';
import { popcount } from '../../src/board.mjs';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';
import { canUsePatternEnumeration, visitCaseSolutions } from '../../src/pc-enumeration-engine.mjs';
import { compactGeometry } from '../../src/compact-geometry.mjs';
import { collectCompactMinimals } from '../../src/minimals-compact.mjs';
import { createNumericCoverage } from '../../src/numeric-cover-data.mjs';
import { makeOrderCountQuality, recordOrderCount } from '../../src/human-ranking.mjs';
import { PER_SAVE_DISPLAY_ORDER } from '../../src/save-piece.mjs';
import { prepareQueuePieceCounts, unusedPiecePrepared, prepareSolutionPieceCounts,
  prepareSaveCase, compileExactSaveExpression, savedMultiplicityCodePrepared } from '../../src/saves.mjs';
import { minimumCoverAsync } from '../../src/min-cover-adaptive.mjs';
import { inspectTrivialSecondary } from '../../src/min-cover-components.mjs';
import { assertExact, validateFixture, fixtureIdentity, selectedVector } from './contracts.mjs';

export function collectCommand(command, solver) {
  assertExact(command.exactHumanQuality);
  assert(['per-save', 'minimals'].includes(command.kind), 'unknown command kind');
  assert(typeof command.useHold === 'boolean', 'explicit hold option required');
  const { board } = decodeAndValidate(command.sourceFumen, command.clear);
  const piecesNeeded = (command.clear * 10 - popcount(board)) / 4;
  assert(Number.isInteger(piecesNeeded) && piecesNeeded > 0, 'incompatible geometry');
  const cases = expandPatternCasesInternal(command.pattern);
  assert(cases.length && cases.every(entry => entry.queue.length === piecesNeeded + 1), 'queue must contain needed pieces + one save');
  if (command.kind === 'minimals') assert(typeof command.wantedSave === 'string', 'explicit save expression required');
  const queueCounts = cases.map(entry => prepareQueuePieceCounts(entry.queue));
  const displayOrder = [...PER_SAVE_DISPLAY_ORDER];
  let compact = null;
  if (canUsePatternEnumeration({ cases, solver }) && typeof solver.enumeratePcPatternCompact === 'function') {
    compact = solver.enumeratePcPatternCompact(board, cases.map(e => e.queue), command.useHold);
  }
  if (compact && command.kind === 'minimals') {
    const collected = collectCompactMinimals(compact, cases, command.wantedSave);
    return { board, cases, mode: 'compact', groups: new Map([[command.wantedSave, collected]]) };
  }
  const groupRows = new Map(displayOrder.map(piece => [piece, new Map()]));
  if (compact) {
    const geometry = compactGeometry(compact);
    for (let id = 0; id < compact.count; id++) {
      const usage = geometry.usage(id);
      for (let edge = compact.offsets[id]; edge < compact.offsets[id + 1]; edge++) {
        const ci = compact.caseIds[edge]; assert(cases[ci], 'invalid compact case');
        const piece = unusedPiecePrepared(queueCounts[ci], usage), rows = groupRows.get(piece);
        assert(rows, 'invalid saved piece');
        if (!rows.has(ci)) rows.set(ci, []);
        rows.get(ci).push([id, compact.qualities[edge]]);
      }
    }
    const groups = new Map();
    for (const [piece, rows] of groupRows) {
      // Product per-save builds active rows in original case order.
      const ordered = new Map([...rows].sort((a, b) => a[0] - b[0]));
      groups.set(piece, createNumericCoverage(geometry.keys, ordered, cases));
    }
    return { board, cases, mode: 'compact', groups };
  }
  const coverageByFilter = new Map((command.kind === 'per-save' ? displayOrder : [command.wantedSave]).map(filter => [filter, new Map()]));
  const qualityIndex = new Map(), saveCases = cases.map(e => prepareSaveCase(e.queue, e.lastBag));
  const matches = command.kind === 'minimals' ? compileExactSaveExpression(command.wantedSave) : null;
  const path = visitCaseSolutions({ board, cases, solver, useHold: command.useHold,
    visit(entry, ci, solution, orderCount) {
      const usage = prepareSolutionPieceCounts(solution);
      const filter = command.kind === 'per-save' ? unusedPiecePrepared(queueCounts[ci], usage) : command.wantedSave;
      if (matches && !matches(savedMultiplicityCodePrepared(saveCases[ci], usage))) return;
      const coverage = coverageByFilter.get(filter);
      assert(coverage, 'invalid save filter');
      if (!coverage.has(entry.caseId)) coverage.set(entry.caseId, new Set());
      coverage.get(entry.caseId).add(solution.key);
      recordOrderCount(qualityIndex, entry.caseId, { key: solution.key, orderCount });
    } });
  return { board, cases, mode: path.mode,
    groups: new Map([...coverageByFilter].map(([filter, coverage]) => [filter, { coverage, qualityIndex }])) };
}

export async function extractCommand(command, solver, { onPhase = () => {}, onFixture = () => {} } = {}) {
  assertExact(command.exactHumanQuality);
  onPhase('enumeration');
  const enumerationStart = performance.now(), collected = collectCommand(command, solver);
  const collectMs = performance.now() - enumerationStart, fixtures = [], filters = [];
  for (const [filter, group] of collected.groups) {
    if (!group.coverage.size) { filters.push({ filter, status: 'EMPTY' }); continue; }
    const qualityFor = makeOrderCountQuality(group.qualityIndex);
    onPhase('primary', { filter });
    const primaryStart = performance.now();
    let captured;
    await minimumCoverAsync(group.coverage, {
      solver, qualityFor, exactQuality: 'true', primary: command.primary ?? 'auto', secondary: 'rust',
      // No tiny solve: collect original matrix + minimum K without secondary.
      deferExactSecondary(prepared, context) {
        const fixture = { schema: 1, id: command.id + '/' + filter,
          keys: [...prepared.keys], rows: prepared.cases, K: context.primary.count,
          seed: context.primaryKeys.map(key => prepared.keys.indexOf(key)),
          caseIds: [...group.coverage].map(([caseId]) => caseId),
          cardinalityProof: { status: 'PROVEN', backend: context.primary.backend,
            primarySearchedStates: context.primary.searchedStates ?? null, kernelStats: context.kernelStats },
          origin: { command, filter, enumerationMode: collected.mode, captureOnly: true },
          primaryHard: context.primaryHard };
        validateFixture(fixture);
        const inspected = inspectTrivialSecondary(group.coverage, fixture.K, qualityFor);
        captured = { ...fixture, structure: inspected.structure, trivial: inspected.result?.secondaryTrivial ?? null,
          tinyCandidateEligible: prepared.keys.length <= 48, contentIdentity: fixtureIdentity(fixture) };
        return { count: fixture.K, keys: context.primaryKeys, qualityVector: selectedVector(fixture, fixture.seed),
          qualityExact: false, captureOnly: true };
      },
    });
    assert(captured, 'exact primary-to-secondary interception was not reached');
    const primaryMs = performance.now() - primaryStart;
    const completedFixture = { ...captured, captureTiming: { collectMs, primaryAndSerializationMs: primaryMs } };
    await onFixture(completedFixture, fixtures.length);
    fixtures.push(completedFixture);
    filters.push({ filter, status: captured.trivial ? 'TRIVIAL' : 'CAPTURED', fixtureId: captured.id,
      n: captured.keys.length, K: captured.K, R: captured.rows.length, primaryMs });
  }
  return { fixtures, filters, total: collected.cases.length, collectMs, enumerationMode: collected.mode,
    captureOnly: true, qualityRequested: command.exactHumanQuality, qualityResolved: 'true' };
}
