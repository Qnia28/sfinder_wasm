import test from 'node:test';
import assert from 'node:assert/strict';
import fumen from 'tetris-fumen';
import { createWasmSolver } from '../src/wasm-backend.mjs';
import { calculatePerSaveMinimalsFromBoardAsync } from '../src/per-save-minimals-core.mjs';
import { calculatePerSaveMinimalsAsync } from '../src/per-save-minimals.mjs';
import { calculateSaveMinimals } from '../src/minimals-feature.mjs';
import { minimumCoverAsync } from '../src/min-cover-adaptive.mjs';

test('small synthetic product APIs and compact/numeric/Map routes carry independent budgets', async () => {
  const solver = await createWasmSolver(4);
  const board = [0n, 10n, 20n, 30n].reduce((v, shift) => v | (255n << shift), 0n);
  const queues = Array.from({ length: 64 }, (_, i) => ['OOI', 'OOO', 'OOT', 'IIO', 'IIT'][i % 5]);
  const compact = solver.enumeratePcPatternCompact, pattern = solver.enumeratePcPattern;
  const opts = { solver, primary: 'rust', exactHumanQuality: 'fast', tinyExactMaxCandidates: 0,
    fastPolicy: 'I10_FIXED_AUX', fastPreviewBudget: 0, fastGraceBudget: 0, fastDiagnostics: 'trace', secondaryWorkers: 0 };
  function check(r) {
    assert.equal(r.fastTelemetry.policy, 'I10_FIXED_AUX');
    assert.equal(r.fastTelemetry.appliedBudgets.integrated, 10000);
    assert.equal(r.fastTelemetry.appliedBudgets.preview, 0);
    assert.equal(r.fastTelemetry.appliedBudgets.grace, 0);
    assert.equal(r.fastProbeBudget, 10000);
    assert(r.humanQualityVector.every(q => q > 0));
  }
  try {
    let baseline;
    for (const route of ['compact', 'numeric', 'general']) {
      if (route !== 'compact') solver.enumeratePcPatternCompact = () => null;
      if (route === 'general') solver.enumeratePcPattern = undefined;
      const result = await calculatePerSaveMinimalsFromBoardAsync({ ...opts, board, queues });
      for (const r of Object.values(result.results).filter(r => r.keys.length)) check(r);
      const witness = Object.values(result.results).map(r => [r.keys, r.humanQualityVector, r.minimalCount]);
      if (baseline) assert.deepEqual(witness, baseline); else baseline = witness;
    }
    solver.enumeratePcPatternCompact = compact; solver.enumeratePcPattern = pattern;
    const sourceFumen = fumen.encoder.encode([{ field: fumen.Field.create('XXXXXXXX__'.repeat(4)) }]);
    const apiOpts = { ...opts, exactHumanQuality: undefined, secondary: 'auto' };
    const all = await calculateSaveMinimals({ ...apiOpts, sourceFumen, analysisPattern: '*p3', wantedSave: 'T', height: 4 });
    check(all);
    const perSave = await calculatePerSaveMinimalsAsync({ ...apiOpts, sourceFumen, pattern: '*p3', targetLines: 4 });
    for (const r of Object.values(perSave.results).filter(r => r.keys.length)) check(r);
  } finally { solver.close(); }
});

test('primary hard and explicit 2x2 bypass every budget policy and feature scan', async () => {
  const keys = Array.from({ length: 200 }, (_, i) => String(i).padStart(3, '0'));
  const coverage = new Map([[0, new Set(keys)]]);
  const solver = {
    primaryKernelize: () => ({ cases: Array.from({ length: 200 }, () => [0]),
      forced: [], solutionIds: keys.map((_, i) => i), entryCount: 2200 }),
    minimumCoverCardinalityIds: () => ({ count: 1, selectedIds: [0] }),
    minimumCoverAtCount: () => assert.fail('hard/2x2 must not call bounded solver'),
  };
  for (const exactQuality of ['fast', '2x2']) {
    const r = await minimumCoverAsync(coverage, { solver, primary: 'rust', qualityFor: () => 1,
      exactQuality, fastPolicy: 'U228_OR_D16', fastDiagnostics: 'trace' });
    assert.equal(r.count, 1);
    assert.equal(r.fastTelemetry.selection, undefined);
    assert.deepEqual(r.fastTelemetry.appliedBudgets, { preview: 0, integrated: 0, grace: 0 });
    assert.equal(r.fastDecision, exactQuality === 'fast' ? 'primary-hard' : 'explicit-2x2');
  }
});
