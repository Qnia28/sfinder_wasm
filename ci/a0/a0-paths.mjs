import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const validationRoot = path.dirname(fileURLToPath(import.meta.url));
// Attempt 03 and its original root schedule remain historical artifacts.
export const attemptRoot = path.resolve(process.env.A0_ATTEMPT_DIR ?? path.join(validationRoot, 'attempt-04'));
export const prepRoot = path.join(attemptRoot, 'prep');
export const planPath = path.join(prepRoot, 'a0-test-cases.json');
export const buildManifestPath = path.join(prepRoot, 'dev-a0-build-manifest.json');
export const resultsRoot = path.join(attemptRoot, 'results');
export const correctnessRoot = path.join(attemptRoot, 'correctness');
export const harnessFiles = ['run-a0-campaign.mjs', 'a0-secondary-worker.mjs', 'a0-worker-lifecycle.mjs',
  'a0-contracts.mjs', 'a0-analysis.mjs', 'a0-paths.mjs', 'a0-numeric-input.mjs',
  'verify-a0-inputs.mjs', 'analyze-a0-campaign.mjs', 'run-a0-correctness.mjs',
  'a0-correctness-worker.mjs', 'a0-oracle.mjs', 'build-a0-correctness-fixtures.mjs',
  'a0-harness.test.mjs', 'a0-preparation.test.mjs', 'finalize-a0-preparation.mjs'];
