import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import { VARIANTS, validateIncumbent } from './a0-contracts.mjs';
import { prepareNumericInput } from './a0-numeric-input.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const roundMs = value => Number(value.toFixed(3));
let solver = null;
let rawResult = null;

try {
  if (!VARIANTS.includes(workerData.variant)) throw new Error('unknown variant');
  parentPort.postMessage({ event: 'started', runId: workerData.runId, variant: workerData.variant });
  const matrixReadStart = performance.now();
  const compressed = fs.readFileSync(workerData.matrixFile);
  if (sha256(compressed) !== workerData.compressedSha256) throw new Error('input gzip SHA-256 mismatch');
  const jsonBytes = gunzipSync(compressed);
  if (sha256(jsonBytes) !== workerData.jsonSha256) throw new Error('input JSON SHA-256 mismatch');
  const matrix = JSON.parse(jsonBytes);
  const identity = JSON.stringify({ keys: matrix.keys, K: matrix.K, seedKeys: matrix.seedKeys, rows: matrix.rows });
  if (sha256(Buffer.from(identity)) !== workerData.identitySha256) throw new Error('solver-visible matrix identity mismatch');

  const [{ createWasmSolver }, { registerNumericCoverage }, { packNumericQualityRows }] = await Promise.all([
    import(pathToFileURL(path.join(workerData.devSnapshotRoot, 'src/wasm-backend.mjs'))),
    import(pathToFileURL(path.join(workerData.devSnapshotRoot, 'src/numeric-cover-data.mjs'))),
    import(pathToFileURL(path.join(workerData.devSnapshotRoot, 'src/pc-wasm-cover-matrix.mjs'))),
  ]);
  const { coverage, qualityFor } = prepareNumericInput(matrix, { registerNumericCoverage, packNumericQualityRows });
  const matrixPrepareMs = roundMs(performance.now() - matrixReadStart);

  const wasmFile = path.join(workerData.devSnapshotRoot, 'wasm/pc_wasm.wasm');
  const wasmBytes = fs.readFileSync(wasmFile);
  const binarySha256 = sha256(wasmBytes);
  if (binarySha256 !== workerData.binarySha256) throw new Error('rebuilt WASM SHA-256 mismatch');
  const wasmExports = WebAssembly.Module.exports(new WebAssembly.Module(wasmBytes)).map(item => item.name);
  const required = workerData.variant === 'DEV-SNAPSHOT-A0'
    ? 'solver_min_cover_at_count_integrated_partitioned_bounded'
    : 'solver_min_cover_at_count_integrated_bounded';
  if (!wasmExports.includes(required)) throw new Error(`required solver export missing: ${required}`);

  const initStart = performance.now();
  solver = await createWasmSolver(matrix.geometry.targetLines ?? 4, { legal: false });
  const wasmInitMs = roundMs(performance.now() - initStart);
  parentPort.postMessage({ event: 'probe-started', runId: workerData.runId, variant: workerData.variant,
    startedUtc: new Date().toISOString() });
  const solverStart = performance.now();
  const result = solver.minimumCoverAtCount(coverage, matrix.K, {
    qualityFor,
    seedKeys: matrix.seedKeys,
    stateBudget: workerData.stateBudget,
    integrated: true,
    partitioned: workerData.variant === 'DEV-SNAPSHOT-A0',
  });
  const solverCallWallMs = performance.now() - solverStart;
  rawResult = result;
  const incumbent = validateIncumbent(matrix, result, workerData.stateBudget);

  parentPort.postMessage({
    event: 'result',
    runId: workerData.runId,
    caseId: workerData.caseId,
    repetition: workerData.repetition,
    variant: workerData.variant,
    status: result.completed ? 'EXACT' : 'BUDGET_CAPPED',
    completed: result.completed,
    input: {
      identitySha256: workerData.identitySha256,
      compressedSha256: workerData.compressedSha256,
      jsonSha256: workerData.jsonSha256,
      candidateCount: matrix.keys.length,
      rowCount: matrix.rows.length,
      entryCount: matrix.rows.reduce((sum, row) => sum + row.length, 0),
      K: matrix.K,
    },
    binarySha256,
    stateBudget: workerData.stateBudget,
    searchedStates: result.searchedStates,
    solverCallWallMs,
    matrixPrepareMs,
    wasmInitMs,
    integratedProbeAttempted: true,
    incumbent,
    incumbentValidation: 'PASS',
  });
} catch (error) {
  parentPort.postMessage({
    event: 'error',
    runId: workerData.runId,
    caseId: workerData.caseId,
    repetition: workerData.repetition,
    variant: workerData.variant,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    rawResult,
    incumbentValidation: rawResult ? 'FAIL' : 'NOT_AVAILABLE',
  });
} finally {
  solver?.close();
}
