// Validation-harness contracts only. This module never calls a solver.
export const VARIANTS = ['DEV-SNAPSHOT-HIST', 'DEV-SNAPSHOT-A0'];
export const runIdFor = job => `${job.caseId}/rep${job.repetition}/${job.variant}`;
export const compareVectors = (left, right) => {
  if (left.length !== right.length) throw new Error('quality vector lengths differ');
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
};

export function validateSchedule(plan) {
  if (JSON.stringify(plan.variants) !== JSON.stringify(VARIANTS)) throw new Error('unexpected A0 variants');
  if (!Number.isInteger(plan.repetitionsPerVariant) || plan.repetitionsPerVariant < 1
      || plan.repetitionsPerVariant > 20) throw new Error('invalid repetitions');
  const caseIds = new Set(plan.cases.map(row => row.caseId));
  const identities = new Set(plan.cases.map(row => row.identitySha256));
  if (caseIds.size !== plan.cases.length || identities.size !== plan.cases.length
      || plan.uniqueMatrixCount !== plan.cases.length) throw new Error('duplicate/missing catalog identity');
  const selected = new Set(plan.selectedCaseIds);
  if (!selected.size || selected.size !== plan.selectedCaseIds.length
      || selected.size !== plan.selectedUniqueMatrixCount
      || [...selected].some(id => !caseIds.has(id))) throw new Error('invalid selected matrices');
  const expected = selected.size * 2 * plan.repetitionsPerVariant;
  if (plan.plannedRuns !== expected || plan.runSchedule.length !== expected) throw new Error('schedule count mismatch');
  const ids = new Set();
  const catalogIndex = new Map(plan.cases.map((row, index) => [row.caseId, index]));
  for (let i = 0; i < plan.runSchedule.length; i++) {
    const job = plan.runSchedule[i];
    const id = runIdFor(job);
    if (job.sequence !== i + 1 || !selected.has(job.caseId) || !VARIANTS.includes(job.variant)
        || !Number.isInteger(job.repetition) || job.repetition < 1 || job.repetition > plan.repetitionsPerVariant
        || job.maxWallMs !== 60_000 || ids.has(id)) throw new Error(`invalid/duplicate scheduled job: ${id}`);
    const orderIndex = (catalogIndex.get(job.caseId) + job.repetition - 1) % 2;
    const pairPosition = i % 2;
    if (job.orderIndex !== orderIndex || job.variant !== VARIANTS[(orderIndex + pairPosition) % 2]) {
      throw new Error(`AB/BA order mismatch: ${id}`);
    }
    if (pairPosition && (plan.runSchedule[i - 1].caseId !== job.caseId
        || plan.runSchedule[i - 1].repetition !== job.repetition)) throw new Error('A/B pair is not adjacent');
    ids.add(id);
  }
  return new Map(plan.runSchedule.map(job => [runIdFor(job), job]));
}

export function qualityForKeys(matrix, keys) {
  if (!Array.isArray(keys) || keys.length !== matrix.K || new Set(keys).size !== matrix.K) {
    throw new Error('selected keys must be exactly K distinct candidates');
  }
  const keyIndex = new Map(matrix.keys.map((key, id) => [key, id]));
  if (keys.some(key => !keyIndex.has(key))) throw new Error('selected key is not an original candidate');
  const selected = new Set(keys.map(key => keyIndex.get(key)));
  return matrix.rows.map(row => {
    let best = 0;
    for (const [id, quality] of row) if (selected.has(id) && quality > best) best = quality;
    if (!best) throw new Error('incumbent misses an original row');
    return best;
  }).sort((a, b) => a - b);
}

export function validateIncumbent(matrix, result, budget) {
  if (!result || result.error || typeof result.completed !== 'boolean' || result.count !== matrix.K) {
    throw new Error('invalid fixed-K result status/count');
  }
  if (!Number.isSafeInteger(result.searchedStates) || result.searchedStates < 0 || result.searchedStates > budget) {
    throw new Error('invalid searched-state count');
  }
  if (!Array.isArray(result.qualityVector) || result.qualityVector.some(q => !Number.isInteger(q) || q <= 0 || q > 0xffffffff)) {
    throw new Error('invalid quality vector');
  }
  const qualityVector = qualityForKeys(matrix, result.keys);
  if (compareVectors(qualityVector, result.qualityVector) !== 0) throw new Error('original-row quality mismatch');
  const seedQualityVector = qualityForKeys(matrix, matrix.seedKeys);
  if (compareVectors(qualityVector, seedQualityVector) < 0) throw new Error('returned incumbent is worse than primary seed');
  const ids = result.keys.map(key => matrix.keys.indexOf(key));
  if (ids.some((id, i) => i && id <= ids[i - 1])) throw new Error('selected stable IDs are not strictly increasing');
  return { count: result.count, keys: [...result.keys], qualityVector };
}

// Reject duplicate/foreign results; an interrupted start is not a completed run.
export function validateLedger(records, plan, campaign) {
  const jobs = validateSchedule(plan);
  const terminals = new Map();
  const pending = new Set();
  for (const record of records) {
    const job = jobs.get(record.runId);
    if (!job) throw new Error(`ledger contains an unscheduled run: ${record.runId}`);
    if (!['start', 'probe-attempt', 'result', 'aborted'].includes(record.event)) throw new Error('unknown ledger event');
    if (record.caseId !== job.caseId || record.repetition !== job.repetition || record.variant !== job.variant) {
      throw new Error(`ledger job identity mismatch: ${record.runId}`);
    }
    if (terminals.has(record.runId)) throw new Error(`ledger event after terminal result: ${record.runId}`);
    if (record.event === 'start') {
      if (pending.size) throw new Error('ledger contains overlapping/dangling run starts');
      pending.add(record.runId);
      continue;
    }
    if (!pending.has(record.runId)) throw new Error('ledger event without matching start');
    if (record.event === 'aborted') { pending.delete(record.runId); continue; }
    if (record.event !== 'result') continue;
    if (!['EXACT', 'BUDGET_CAPPED', 'TIMEOUT', 'ERROR'].includes(record.status)) throw new Error('unknown terminal status');
    if (record.binarySha256 !== campaign.binarySha256 || record.stateBudget !== campaign.stateBudget
        || record.input?.identitySha256 !== plan.cases.find(row => row.caseId === job.caseId).identitySha256) {
      throw new Error(`ledger provenance mismatch: ${record.runId}`);
    }
    terminals.set(record.runId, record);
    pending.delete(record.runId);
  }
  if (pending.size) throw new Error('ledger has a dangling start; preserve it and reconcile the interrupted attempt before resume');
  return terminals;
}
