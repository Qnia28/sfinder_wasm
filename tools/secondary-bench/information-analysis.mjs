// Descriptive, offline comparisons. No learned gates or product policy claims.
import { ENGINES } from './contracts.mjs';
const median = a => {
  if (!a.length) return null;
  const b = [...a].sort((x, y) => x - y), m = Math.floor(b.length / 2);
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
const p95 = a => a.length ? [...a].sort((x, y) => x - y)[Math.ceil(a.length * .95) - 1] : null;
export function analyzeInformation(plan, rows, fixtures) {
  const initial = rows.filter(r => r.action === 'secondary' && r.execution && r.repeat <= plan.policy.initialRepeats);
  const data = fixtures.map(f => {
    const engines = Object.fromEntries(ENGINES.map(engine => {
      const attempts = initial.filter(r => r.inputId === f.id && r.engine === engine), times = attempts.filter(r => r.status === 'EXACT').map(r => r.ms);
      return [engine, { attempts: attempts.length, exact: times.length, statuses: attempts.map(r => r.status),
        completeExactInitial: attempts.length === plan.policy.initialRepeats && times.length === attempts.length,
        medianMs: median(times), maxMinRatio: times.length >= 2 ? Math.max(...times) / Math.min(...times) : null }];
    }));
    return { id: f.id, commandId: f.commandId, family: f.family,
      structure: f.structure, aliases: f.aliases, engines };
  });
  const pairs = [];
  for (let a = 0; a < ENGINES.length; a++) for (let b = a + 1; b < ENGINES.length; b++) {
    const left = ENGINES[a], right = ENGINES[b];
    const matched = data.filter(d => d.engines[left].completeExactInitial && d.engines[right].completeExactInitial);
    const ratios = matched.map(d => d.engines[right].medianMs / d.engines[left].medianMs);
    pairs.push({ left, right, matchedCompleteInitial: matched.length, ratioDefinition: 'right_ms/left_ms (>1 means left faster)',
      medianRatio: median(ratios), leftFasterAtLeast10Percent: ratios.filter(r => r >= 1.1).length,
      rightFasterAtLeast10Percent: ratios.filter(r => r <= 1 / 1.1).length,
      leftFasterAtLeast2x: ratios.filter(r => r >= 2).length, rightFasterAtLeast2x: ratios.filter(r => r <= .5).length,
      inside10Percent: ratios.filter(r => r > 1 / 1.1 && r < 1.1).length });
  }
  const complete = data.filter(d => ENGINES.every(e => d.engines[e].completeExactInitial));
  const winners = Object.fromEntries(ENGINES.map(e => [e, 0])), familySummaries = [];
  for (const d of complete) {
    const winner = ENGINES.reduce((a, b) => d.engines[a].medianMs <= d.engines[b].medianMs ? a : b); winners[winner]++;
  }
  for (const family of [...new Set(data.map(d => d.family))]) {
    const group = data.filter(d => d.family === family), allExact = complete.filter(d => d.family === family);
    familySummaries.push({ family, fixtures: group.length, allEnginesCompleteInitial: allExact.length,
      engineCompleteInitial: Object.fromEntries(ENGINES.map(e => [e, group.filter(d => d.engines[e].completeExactInitial).length])),
      matchedMedianMs: Object.fromEntries(ENGINES.map(e => [e, median(allExact.map(d => d.engines[e].medianMs))])) });
  }
  return { phase: 'INITIAL_ONLY_FIXED_REPEAT_COUNTS', initialRepeats: plan.policy.initialRepeats,
    totalFixtures: data.length, pairs, allThreeCompleteInitial: complete.length, fastestCounts: winners,
    matchedAllThreeEngineSummary: ENGINES.map(engine => ({ engine,
      medianMs: median(complete.map(d => d.engines[engine].medianMs)), p95Ms: p95(complete.map(d => d.engines[engine].medianMs)) })),
    familySummaries,
    withinEngineVariability: ENGINES.map(engine => ({ engine,
      eligibleCompleteInitial: data.filter(d => d.engines[engine].completeExactInitial).length,
      ratioAtLeast110: data.filter(d => d.engines[engine].completeExactInitial && d.engines[engine].maxMinRatio >= 1.1).length })),
    slowestCompletedInitial: ENGINES.map(engine => ({ engine, fixtures: data.filter(d => d.engines[engine].completeExactInitial)
      .sort((a, b) => b.engines[engine].medianMs - a.engines[engine].medianMs).slice(0, 10).map(d =>
        ({ id: d.id, medianMs: d.engines[engine].medianMs, structure: d.structure, otherEngineInitial: d.engines })) })),
    fixtureData: data,
    caution: 'Completion-conditioned matched subset; cannot rank unresolved/OOM/missing engines or predict end-to-end/concurrent gains' };
}
