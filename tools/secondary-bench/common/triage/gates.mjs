import assert from 'node:assert/strict';

// Adjudication only: does not change solver inputs, measurement or scheduling.
// Missing contract deliberately retains the historical fail-closed r1 rules.
export const GATE_CONTRACT = Object.freeze({ id: 'evidence-first-v2',
  execution: 'BLOCK_INVALID_EVIDENCE_OR_UNSAFE_RUNTIME',
  calibration: 'REPORT_UNCERTAINTY_WITHOUT_BLOCKING_COLLECTION',
  outcomes: 'RETAIN_CENSORED_AND_REGRESSING_CANDIDATES',
  promotion: 'SEPARATE_REVIEW_NO_AUTOMATIC_PASS', automaticExtraCalls: 0 });

export function evidenceFirst(contract) {
  if (contract === undefined) return false;
  assert.deepEqual(contract, GATE_CONTRACT, 'unsupported gate contract');
  return true;
}
