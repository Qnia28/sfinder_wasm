import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { decoder } from 'tetris-fumen';
import { boardFromFumenPage } from '../../src/board.mjs';
import { expandPatternCases } from '../../src/pattern.mjs';
import { WasmPcSolver } from '../../src/wasm-backend.mjs';
import { collectCompactMinimals } from '../../src/minimals-compact.mjs';
import { makeOrderCountQuality } from '../../src/human-ranking.mjs';
import { prepareCoverageMatrix, kernelizeCardinality, solvePreparedCardinalityKernel } from '../../src/highs-cardinality.mjs';
import { BASELINE_SHA, sha256, validateMatrix } from './engine.mjs';

const [phase, id, out, filter, seconds] = process.argv.slice(2);
const dbBytes = readFileSync(new URL('./cycle1-setups.json', import.meta.url));
const db = JSON.parse(dbBytes), setup = db.setups.find(s => s.id === id);
assert(setup, 'unknown setup');
if (phase === 'enumerate') {
  const wasm = readFileSync(new URL('./build/original.wasm', import.meta.url));
  const legal = readFileSync(new URL('../../wasm/legal_boards_4.lgb', import.meta.url));
  const { instance } = await WebAssembly.instantiate(wasm, {});
  const solver = new WasmPcSolver(instance.exports, 4, legal);
  try {
    const cases = expandPatternCases(setup.pattern), board = boardFromFumenPage(decoder.decode(setup.fumen)[0], 4);
    const started = performance.now();
    const compact = solver.enumeratePcPatternCompact(board, cases.map(c => c.queue), true);
    assert(compact, 'compact enumeration is required; do not silently change enumeration engine');
    const enumerationMs = performance.now() - started;
    const records = [];
    for (const piece of setup.filters) {
      const collected = collectCompactMinimals(compact, cases, piece);
      if (!collected.coverage.size) { records.push({ filter: piece, status: 'NO_MINIMAL' }); continue; }
      const prepared = prepareCoverageMatrix(collected.coverage, makeOrderCountQuality(collected.qualityIndex));
      const raw = { id: `${id}-${piece}`, setupId: id, sourceFumen: setup.fumen, pattern: setup.pattern,
        filter: piece, mirrorGroup: setup.mirrorGroup, keys: prepared.keys, rows: prepared.cases,
        baseline: BASELINE_SHA, enumerationWasmHash: sha256(wasm), legalHash: sha256(legal),
        databaseHash: db.sourceSha256, snapshotHash: sha256(dbBytes),
        successCases: prepared.cases.length, totalCases: cases.length };
      writeFileSync(resolve(out, `${piece}.raw.json.gz`), gzipSync(JSON.stringify(raw)), { flag: 'wx' });
      records.push({ filter: piece, status: 'ENUMERATED', n: raw.keys.length, rows: raw.rows.length,
        entries: prepared.entryCount, qualityLevels: new Set(raw.rows.flatMap(r => r.map(x => x[1]))).size });
    }
    writeFileSync(resolve(out, 'enumeration.json'), JSON.stringify({ setup, enumerationMs,
      candidateCount: compact.count, records, stats: solver.stats() }, null, 2));
  } finally { solver.close(); }
} else {
  assert.equal(phase, 'primary');
  const raw = JSON.parse(gunzipSync(readFileSync(resolve(out, `${filter}.raw.json.gz`))));
  const started = performance.now();
  const kernel = kernelizeCardinality(raw.rows.map(row => row.map(x => x[0])), raw.keys.length);
  const result = await solvePreparedCardinalityKernel(kernel, { time_limit: Number(seconds), threads: 1 });
  const primaryMs = performance.now() - started;
  const matrix = { ...raw, K: result.count, seed: result.selected, primaryBackend: result.backend,
    primaryStatus: result.result?.Status ?? 'EXACT_KERNEL', primaryMs,
    kernel: { rows: kernel.cases.length, n: kernel.solutionIds.length, F: kernel.forced.length } };
  validateMatrix(matrix);
  assert.equal(matrix.seed.length, matrix.K);
  const bytes = Buffer.from(JSON.stringify(matrix)), compressed = gzipSync(bytes);
  const file = `${filter}.json.gz`;
  writeFileSync(resolve(out, file), compressed, { flag: 'wx' });
  writeFileSync(resolve(out, `${filter}.proof.json`), JSON.stringify({ filter, status: 'PROVED', file,
    sha256: sha256(bytes), compressedSha256: sha256(compressed), K: matrix.K, seed: matrix.seed,
    primaryMs, primaryBackend: matrix.primaryBackend, primaryStatus: matrix.primaryStatus,
    kernel: matrix.kernel, objective: result.result?.ObjectiveValue ?? matrix.K }, null, 2));
}
