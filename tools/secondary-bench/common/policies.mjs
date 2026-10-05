import assert from 'node:assert/strict';
import { sha256, ENGINES } from './contracts.mjs';

const ORDERS = [
  ['integrated', 'threshold', 'cpsat'], ['threshold', 'cpsat', 'integrated'], ['cpsat', 'integrated', 'threshold'],
  ['integrated', 'cpsat', 'threshold'], ['cpsat', 'threshold', 'integrated'], ['threshold', 'integrated', 'cpsat'],
];
export function engineSchedule(fixtures, repeats, seed) {
  const sorted = [...fixtures].sort((a, b) => sha256(seed + a.id).localeCompare(sha256(seed + b.id)) || a.id.localeCompare(b.id));
  return sorted.flatMap((f, index) => {
    const initial = parseInt(sha256(seed + '\n' + f.id).slice(0, 8), 16) % 6;
    return Array.from({ length: repeats }, (_, repeat) => {
      const direction = (Math.floor(initial / 3) + Math.floor(repeat / 3)) % 2;
      return ORDERS[direction * 3 + (initial % 3 + repeat) % 3].map((engine, position) => ({
        inputId: f.id, engine, repeat: repeat + 1, position, blockId: `${f.id}/r${repeat + 1}`, index,
      }));
    }).flat();
  });
}
export function selection(m, captured, imported) {
  const selected = [], ledger = [];
  for (const c of m.inputs.commands) {
    const candidates = captured.filter(f => f.commandId === c.id), nontrivial = candidates.filter(f => !f.trivial);
    nontrivial.sort((a, b) => sha256(m.repeats.seed + a.id).localeCompare(sha256(m.repeats.seed + b.id)) || a.id.localeCompare(b.id));
    const take = m.selection.id === 'all-nontrivial-v1' ? nontrivial : nontrivial.slice(0, 1);
    selected.push(...take); ledger.push({ commandId: c.id, captured: candidates.length, nontrivial: nontrivial.length, selected: take.map(f => f.id) });
  }
  // Fixture-only campaigns select the declared input index without inventing capture commands.
  if (!m.inputs.commands.length) selected.push(...imported.filter(f => !f.trivial && !m.selection.supplementIds.includes(f.id)));
  for (const id of m.selection.supplementIds) {
    const f = imported.find(x => x.id === id); assert(f && !f.trivial, 'missing nontrivial supplement'); selected.push(f);
  }
  assert.equal(new Set(selected.map(f => f.id)).size, selected.length); return { selected, ledger };
}
export function additionalDecision(rows, inputId, variant, repeats) {
  const rs = rows.filter(r => r.phase === 'INITIAL' && r.inputId === inputId && r.variant === variant && !r.status.startsWith('NOT_RUN_'));
  if (rs.length !== repeats.initial || rs.some(r => r.status !== 'EXACT' || !Number.isFinite(r.ms) || r.ms <= 0))
    return { eligible: false, reason: rs.some(r => r.status === 'OOM') ? 'OOM_QUARANTINE' : 'INSUFFICIENT_EXACT_REPEATS' };
  const ratio = Math.max(...rs.map(r => r.ms)) / Math.min(...rs.map(r => r.ms));
  return { eligible: repeats.additional > 0 && ratio >= repeats.threshold, reason: ratio >= repeats.threshold ? 'VARIABLE' : 'NOT_VARIABLE', ratio };
}
export function eligibleVariants(stage, m, rows, id, decisions) {
  return m.measurement.variants.filter(variant => {
    const decision = stage === 'initial' ? { eligible: true, reason: 'ALL_ENGINES' } : additionalDecision(rows, id, variant, m.repeats);
    decisions.push({ inputId: id, variant, stage, ...decision }); return decision.eligible;
  });
}
