import assert from 'node:assert/strict';
import { compactGeometry } from '../../src/compact-geometry.mjs';
import { createNumericCoverage } from '../../src/numeric-cover-data.mjs';
import { prepareQueuePieceCounts, unusedPiecePrepared } from '../../src/saves.mjs';
import { TETRIS_DISPLAY_ORDER } from '../../src/piece-order.mjs';

// Same per-filter semantics as the original capture and product per-save path.
// This harness selects one frozen filter, not all seven per-save searches.
export function collectUnusedMatrix(compact, cases, filter) {
  assert(filter === 'ordinary' || [...TETRIS_DISPLAY_ORDER].includes(filter));
  const geometry = compactGeometry(compact), counts = cases.map(c => prepareQueuePieceCounts(c.queue));
  const rows = new Map();
  for (let si = 0; si < compact.count; si++) {
    const usage = geometry.usage(si);
    for (let ei = compact.offsets[si]; ei < compact.offsets[si + 1]; ei++) {
      const ci = compact.caseIds[ei]; assert(cases[ci]);
      const unused = unusedPiecePrepared(counts[ci], usage);
      if (filter !== 'ordinary' && unused !== filter) continue;
      if (!rows.has(ci)) rows.set(ci, []);
      rows.get(ci).push([si, compact.qualities[ei]]);
    }
  }
  return { ...createNumericCoverage(geometry.keys, rows, cases), geometry };
}
