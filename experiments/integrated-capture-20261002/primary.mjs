import path from 'node:path';
import { createWasmSolver } from '../../src/wasm-backend.mjs';
import { primaryKernelStats, isHardPrimaryKernel, solvePreparedCardinalityKernel, solvePreparedRustCardinalityKernel } from '../../src/highs-cardinality.mjs';
import { selectPrimaryBackend } from '../../src/primary-backend.mjs';
import { isORToolsSupported } from '../../src/ortools-min-cover.mjs';
import { HERE, read, write, compressedRead, compressedWrite, primaryOnly, validateRows, validateSeed, matrixIdentity, jsonSha } from './common.mjs';

const [rawFile, output] = process.argv.slice(2);
const manifest = read(path.join(HERE, 'selection.json'));
const matrix = compressedRead(path.join(output, rawFile));
validateRows(matrix);
if (isORToolsSupported()) throw new Error('Unexpected JSPI availability: primary auto provenance would change');
let solver;
try {
  solver = await createWasmSolver(4, { legal: false });
  const audit = primaryOnly(solver);
  const primaryCases = matrix.rows.map(row => row.map(([id]) => id));
  const prepared = { keys: matrix.keys, primaryCases };
  console.log(JSON.stringify({ phase: 'kernelization', id: matrix.id }));
  const kernel = solver.primaryKernelize(primaryCases, matrix.keys.length);
  if (!kernel) throw new Error('Exact primary WASM kernel unavailable');
  const stats = primaryKernelStats(kernel);
  const primaryHard = isHardPrimaryKernel(kernel);
  const resolved = selectPrimaryBackend(kernel, 'auto', { ortoolsAvailable: false });
  console.log(JSON.stringify({ phase: 'primary', id: matrix.id, resolved, stats }));
  const primary = resolved === 'highs'
    ? await solvePreparedCardinalityKernel(kernel, { primaryProof: 'standard', time_limit: manifest.primary.highsTimeLimitSeconds, threads: manifest.primary.highsThreads })
    : solvePreparedRustCardinalityKernel(prepared, kernel, solver);
  const selected = [...primary.selected].sort((a, b) => a - b);
  if (selected.length !== primary.count || new Set(selected).size !== selected.length) throw new Error('Invalid primary selection');
  matrix.K = primary.count;
  matrix.seedKeys = selected.map(id => { if (!matrix.keys[id]) throw new Error('Invalid primary ID'); return matrix.keys[id]; });
  matrix.primary = { requested: 'auto', backend: primary.backend, cardinalityProven: true,
    proof: primary.backend === 'highs' ? 'HIGHS_OPTIMAL_ZERO_MIP_REL_GAP' : primary.backend === 'kernel' ? 'EXACT_KERNEL_FORCED' : 'RUST_EXACT_CARDINALITY_ONLY',
    kernelStats: stats, primaryHard, searchedStates: primary.searchedStates ?? null, ortoolsAvailable: false };
  validateSeed(matrix);
  const forced = new Set(matrix.rows.filter(row => row.length === 1).map(row => row[0][0]));
  const trivial = matrix.K === matrix.keys.length ? 'all-candidates'
    : forced.size === matrix.K && matrix.rows.every(row => row.some(([id]) => forced.has(id))) ? 'original-singletons' : null;
  const tiny = matrix.keys.length <= 48;
  matrix.classification = { tinyLegacy: tiny, trivialReason: trivial, primaryHard,
    productRoute: tiny ? 'TINY_LEGACY_EXACT' : trivial ? 'TRIVIAL_EXACT' : primaryHard ? 'THRESHOLD_FIRST_PRIMARY_HARD' : 'INTEGRATED_100K_PROBE_ELIGIBLE' };
  matrix.seedSha256 = jsonSha(matrix.seedKeys);
  matrix.identitySha256 = matrixIdentity(matrix);
  matrix.primaryOnlyAudit = audit;
  const file = `matrices/${matrix.partition}/${matrix.id}.json.gz`;
  const seal = compressedWrite(path.join(output, file), matrix);
  solver.close(); solver = null;
  write(path.join(output, 'primary', `${matrix.id}.json`), { id: matrix.id, status: 'PRIMARY_EXACT', file,
    sha256: seal.sha256, jsonSha256: seal.jsonSha256, bytes: seal.bytes, identitySha256: matrix.identitySha256,
    K: matrix.K, rows: matrix.rows.length, candidates: matrix.keys.length, entries: matrix.rows.reduce((n, row) => n + row.length, 0),
    partition: matrix.partition, family: matrix.family, filter: matrix.filter,
    classification: matrix.classification, primary: matrix.primary, audit, secondaryExecuted: false });
  console.log(JSON.stringify({ phase: 'complete', id: matrix.id, K: matrix.K, backend: primary.backend, secondaryCalls: 0 }));
} finally { solver?.close(); }
