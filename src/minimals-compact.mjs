import { prepareSaveCase, compileExactSaveExpression, savedMultiplicityCodePrepared } from './saves.mjs';
import { createNumericCoverage } from './numeric-cover-data.mjs';
import { compactGeometry } from './compact-geometry.mjs';
import { requirePositiveQuality } from './quality-contract.mjs';

export function collectCompactMinimals(compact, cases, wantedSave) {
  const { count, offsets, caseIds, qualities } = compact;
  const geometry = compactGeometry(compact);
  const saveCases = cases.map(entry => prepareSaveCase(entry.queue, entry.lastBag));
  const matches = compileExactSaveExpression(wantedSave), rows = new Map();
  for (let si = 0; si < count; si++) {
    const usage = geometry.usage(si);
    for (let ei = offsets[si]; ei < offsets[si + 1]; ei++) {
      const ci = caseIds[ei];
      if (!cases[ci]) throw new Error(`invalid compact case ${ci}`);
      if (!matches(savedMultiplicityCodePrepared(saveCases[ci], usage))) continue;
      const q = requirePositiveQuality(qualities[ei], { key: geometry.keys[si], caseId: cases[ci].caseId });
      if (!rows.has(ci)) rows.set(ci, []); // Preserve historical first-hit case order.
      rows.get(ci).push([si, q]);
    }
  }
  const { coverage, qualityIndex } = createNumericCoverage(geometry.keys, rows, cases);
  return { coverage, qualityIndex, byKey: geometry.byKey };
}
