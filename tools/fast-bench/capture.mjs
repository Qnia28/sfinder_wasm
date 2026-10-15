// Capture original quality rows and proven primary K; never run secondary search.
import assert from 'node:assert/strict';
import { decodeAndValidate } from '../../src/pc-input.mjs';
import { expandPatternCasesInternal } from '../../src/pattern.mjs';
import { canUsePatternEnumeration, visitCaseSolutions } from '../../src/pc-enumeration-engine.mjs';
import { compactGeometry } from '../../src/compact-geometry.mjs';
import { collectCompactMinimals } from '../../src/minimals-compact.mjs';
import { createNumericCoverage, numericPrepared } from '../../src/numeric-cover-data.mjs';
import { makeOrderCountQuality, recordOrderCount } from '../../src/human-ranking.mjs';
import { PER_SAVE_DISPLAY_ORDER } from '../../src/save-piece.mjs';
import { prepareQueuePieceCounts, unusedPiecePrepared, prepareSolutionPieceCounts,
  prepareSaveCase, compileExactSaveExpression, savedMultiplicityCodePrepared } from '../../src/saves.mjs';
import { minimumCoverAsync } from '../../src/min-cover-adaptive.mjs';
import { validateFixture, selectedVector, fixtureIdentity } from '../secondary-bench/contracts.mjs';

export function collect(command, solver) {
  const { board } = decodeAndValidate(command.sourceFumen, command.clear);
  const cases = expandPatternCasesInternal(command.pattern);
  assert(cases.length);
  const filters = command.kind === 'per-save' ? [...PER_SAVE_DISPLAY_ORDER] : [command.wantedSave];
  if (canUsePatternEnumeration({ cases, solver })) {
    const compact = solver.enumeratePcPatternCompact(board, cases.map(c => c.queue), command.useHold);
    if (compact) {
      if (command.kind === 'minimals') return { cases, mode: 'compact',
        groups: new Map([[command.wantedSave, collectCompactMinimals(compact, cases, command.wantedSave)]]) };
      const geometry = compactGeometry(compact), counts = cases.map(c => prepareQueuePieceCounts(c.queue));
      const rows = new Map(filters.map(f => [f, new Map()]));
      for (let id = 0; id < compact.count; id++) {
        const usage = geometry.usage(id);
        for (let e = compact.offsets[id]; e < compact.offsets[id + 1]; e++) {
          const ci = compact.caseIds[e], target = rows.get(unusedPiecePrepared(counts[ci], usage));
          if (!target.has(ci)) target.set(ci, []);
          target.get(ci).push([id, compact.qualities[e]]);
        }
      }
      return { cases, mode: 'compact', groups: new Map([...rows].map(([f, r]) =>
        [f, createNumericCoverage(geometry.keys, new Map([...r].sort((a, b) => a[0] - b[0])), cases)])) };
    }
  }
  const coverages = new Map(filters.map(f => [f, new Map()])), qualityIndex = new Map();
  const saveCases = command.kind === 'minimals' ? cases.map(c => prepareSaveCase(c.queue, c.lastBag)) : null;
  const counts = cases.map(c => prepareQueuePieceCounts(c.queue));
  const matches = command.kind === 'minimals' ? compileExactSaveExpression(command.wantedSave) : null;
  const result = visitCaseSolutions({ board, cases, solver, useHold: command.useHold,
    visit(entry, ci, solution, orderCount) {
      const usage = prepareSolutionPieceCounts(solution);
      if (matches && !matches(savedMultiplicityCodePrepared(saveCases[ci], usage))) return;
      const f = matches ? command.wantedSave : unusedPiecePrepared(counts[ci], usage);
      const coverage = coverages.get(f);
      if (!coverage.has(entry.caseId)) coverage.set(entry.caseId, new Set());
      coverage.get(entry.caseId).add(solution.key);
      recordOrderCount(qualityIndex, entry.caseId, { key: solution.key, orderCount });
    } });
  return { cases, mode: result.mode, groups: new Map([...coverages].map(([f, coverage]) => [f, { coverage, qualityIndex }])) };
}

export async function capture(command, solver, phase, save) {
  phase('enumeration');
  const start = performance.now(), collected = collect(command, solver);
  const enumerationMs = performance.now() - start, filters = [];
  phase('primary'); // total call watchdog is never reset per save
  for (const [filter, group] of collected.groups) {
    if (!group.coverage.size) { filters.push({ filter, status: 'EMPTY' }); continue; }
    const begin = performance.now();
    let fixture;
    await minimumCoverAsync(group.coverage, { solver, qualityFor: makeOrderCountQuality(group.qualityIndex),
      primary: 'auto', exactQuality: 'true', secondary: 'rust',
      // Exact mode is solely an interception hook; no secondary engine is called.
      deferExactSecondary(prepared, context) {
        const forced = new Set(prepared.cases.filter(r => r.length === 1).map(r => r[0][0]));
        fixture = { schema: 1, id: command.id + '/' + filter, keys: [...prepared.keys], rows: prepared.cases,
          K: context.primary.count, seed: context.primaryKeys.map(k => prepared.keys.indexOf(k)),
          caseIds: [...group.coverage].map(([id]) => id), representation: numericPrepared(group.coverage) ? 'numeric' : 'Map',
          cardinalityProof: { status: 'PROVEN', backend: context.primary.backend,
            kernelStats: context.kernelStats, primarySearchedStates: context.primary.searchedStates ?? null },
          primaryHard: context.primaryHard,
          origin: { command, filter, enumerationMode: collected.mode, captureOnly: true },
          features: { S: prepared.keys.length, N: prepared.cases.length,
            E: prepared.cases.reduce((n, r) => n + r.length, 0), F: forced.size,
            d: context.primary.count - forced.size, u: prepared.keys.length - forced.size,
            nontrivial: forced.size !== context.primary.count && context.primary.count !== prepared.keys.length,
            previewEligible: context.kernelStats.entries <= 512 && prepared.keys.length <= 256
              && prepared.keys.length * prepared.cases.length <= 1500000 } };
        validateFixture(fixture); fixture.contentIdentity = fixtureIdentity(fixture);
        return { count: fixture.K, keys: context.primaryKeys, qualityVector: selectedVector(fixture, fixture.seed),
          qualityExact: false, captureOnly: true };
      } });
    assert(fixture, 'primary capture interception not reached');
    fixture.primaryCaptureMs = performance.now() - begin;
    const ref = await save(fixture);
    filters.push({ filter, status: 'CAPTURED', ...ref, id: fixture.id,
      features: fixture.features, primaryHard: fixture.primaryHard, K: fixture.K,
      representation: fixture.representation, cardinalityProof: fixture.cardinalityProof });
  }
  return { status: 'CAPTURED', filters, enumerationMs, total: collected.cases.length,
    mode: collected.mode, secondarySolverCalls: 0 };
}
