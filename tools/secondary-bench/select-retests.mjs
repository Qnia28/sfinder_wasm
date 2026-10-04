import assert from 'node:assert/strict';
import { identity } from './contracts.mjs';

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
export function conditionKey(record) {
  // Caller supplies a locked condition object, not just a display engine label.
  assert(record.condition && record.inputId && record.engine);
  return identity({ inputId: record.inputId, engine: record.engine, condition: record.condition });
}
export function selectInformationRetests(records, { expectedRepeats }) {
  assert(Number.isInteger(expectedRepeats) && expectedRepeats >= 2);
  const groups = new Map();
  for (const record of records) {
    const key = conditionKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const selected = [], blocked = [], stable = [];
  for (const [key, rows] of groups) {
    const description = { inputId: rows[0].inputId, engine: rows[0].engine, condition: rows[0].condition, key };
    if (rows.length !== expectedRepeats || new Set(rows.map(r => r.repeat)).size !== expectedRepeats
        || rows.some(r => r.status !== 'EXACT' || !(Number.isFinite(r.ms) && r.ms > 0))) {
      blocked.push({ ...description, reasons: ['INCOMPLETE_OR_INVALID_REPEATS'], statuses: rows.map(r => r.status) }); continue;
    }
    const times = rows.map(r => r.ms), ratio = Math.max(...times) / Math.min(...times);
    const byRunner = new Map();
    for (const row of rows) {
      if (!byRunner.has(row.runnerId)) byRunner.set(row.runnerId, []);
      byRunner.get(row.runnerId).push(row.ms);
    }
    const runnerRatios = [...byRunner].map(([runnerId, values]) => ({ runnerId, ratio: values.length >= 2 ? Math.max(...values) / Math.min(...values) : null }));
    const result = { ...description, ratio, runnerRatios, medianMs: median(times) };
    if (ratio >= 1.10 || runnerRatios.some(r => r.ratio >= 1.10)) selected.push({ ...result, reasons: ['MAX_MIN_GE_1_10'] });
    else stable.push(result);
  }
  return { purpose: 'information', selected, blocked, stable };
}

export function selectABRetests(inputs, { gateImpactIds, gateContract }) {
  // Gate impact must be computed using a separately frozen campaign algorithm.
  assert(Array.isArray(gateImpactIds) && typeof gateContract === 'string', 'explicit gate-impact contract required, even NO_GATE');
  if (gateContract === 'NO_GATE') assert.equal(gateImpactIds.length, 0);
  const byId = new Map(), blocked = [];
  for (const input of inputs) {
    assert(!byId.has(input.inputId), 'duplicate A/B input');
    assert(input.pairs?.length >= 2, 'A/B variability needs >=2 pairs');
    if (input.pairs.some(p => p.a.status !== 'EXACT' || p.b.status !== 'EXACT')) {
      blocked.push({ inputId: input.inputId, reason: 'PROOF_OR_COMPLETION_PENDING' }); continue;
    }
    const pairIds = new Set();
    for (const pair of input.pairs) {
      assert(pair.pairId && !pairIds.has(pair.pairId), 'unique explicit pair ID required'); pairIds.add(pair.pairId);
      assert(pair.a.runnerId === pair.b.runnerId && identity(pair.a.condition) === identity(pair.b.condition), 'pair runner/lifecycle mismatch');
      assert([pair.a.ms, pair.b.ms].every(t => Number.isFinite(t) && t > 0));
    }
    const a = input.pairs.map(p => p.a.ms), b = input.pairs.map(p => p.b.ms);
    byId.set(input.inputId, { inputId: input.inputId, ratio: median(input.pairs.map(p => p.b.ms / p.a.ms)),
      aVariability: Math.max(...a) / Math.min(...a), bVariability: Math.max(...b) / Math.min(...b), reasons: [] });
  }
  const values = [...byId.values()];
  for (const [predicate, descending, reason] of [[r => r.ratio < 1, false, 'IMPROVEMENT_TOP_10_PERCENT'], [r => r.ratio > 1, true, 'REGRESSION_TOP_10_PERCENT']]) {
    const tail = values.filter(predicate).sort((a, b) => descending ? b.ratio - a.ratio : a.ratio - b.ratio);
    if (!tail.length) continue;
    const boundary = tail[Math.ceil(tail.length * 0.10) - 1].ratio;
    for (const entry of tail) if (descending ? entry.ratio >= boundary : entry.ratio <= boundary) entry.reasons.push(reason);
  }
  for (const entry of values) if (entry.aVariability >= 1.10 || entry.bVariability >= 1.10) entry.reasons.push('MAX_MIN_GE_1_10');
  for (const id of gateImpactIds) {
    assert(byId.has(id) || blocked.some(r => r.inputId === id), 'gate impact names unknown input');
    byId.get(id)?.reasons.push('GATE_IMPACT');
  }
  return { purpose: 'ab', gateContract, selected: values.filter(r => r.reasons.length), blocked,
    unselected: values.filter(r => !r.reasons.length) };
}
