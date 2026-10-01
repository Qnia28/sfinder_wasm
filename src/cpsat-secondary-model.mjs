// Fixed-K exact secondary model, promoted from the audited batched CP experiment.
// Original row multiplicities are weights; stable IDs are proved AFTER quality.
const check = (condition, message) => { if (!condition) throw new Error(message); };
export function secondaryQualityVector(rows, selected) {
  const chosen = new Set(selected);
  return rows.map(row => row.reduce((best, [id, q]) => chosen.has(id) ? Math.max(best, q) : best, 0)).sort((a, b) => a - b);
}

export async function solveCpSecondaryModel({ keys, rows, count, seed }, api, { limitMs = 120000 } = {}) {
  const { CpModel, CpSolver, LinearExpr } = api;
  const started = performance.now(), model = new CpModel(), cp = new CpSolver();
  const x = keys.map((_, i) => model.newBoolVar('x' + i));
  check(Number.isSafeInteger(count) && count >= 0 && count <= keys.length, 'invalid CP cardinality');
  check(Number.isFinite(limitMs) && limitMs > 0, 'invalid CP time limit');
  let selected = [...seed].sort((a, b) => a - b);
  const validate = () => {
    check(selected.length === count && new Set(selected).size === count && selected.every(i => Number.isInteger(i) && i >= 0 && i < keys.length), 'invalid CP witness cardinality');
    check(secondaryQualityVector(rows, selected).every(q => q > 0), 'CP witness misses an original row');
  };
  validate(); model.add(LinearExpr.sum(x).eq(count));
  const unique = new Map();
  for (const row of rows) {
    const normalized = new Map();
    for (const [id, q] of row) {
      check(Number.isInteger(id) && id >= 0 && id < keys.length && Number.isSafeInteger(q) && q > 0 && q <= 0xffffffff, 'invalid CP quality edge');
      normalized.set(id, Math.max(q, normalized.get(id) ?? 0));
    }
    const entries = [...normalized].sort((a, b) => a[0] - b[0]), key = JSON.stringify(entries);
    const previous = unique.get(key);
    if (previous) previous.weight++; else unique.set(key, { row: entries, weight: 1 });
  }
  const classes = [...unique.values()], ors = new Map(), coverageRows = new Set();
  const logicalOr = ids => {
    if (!ids.length) return 0;
    if (ids.length === 1) return x[ids[0]];
    const key = ids.join(','); let variable = ors.get(key);
    if (!variable) { variable = model.newBoolVar('y' + ors.size); model.addMaxEquality(variable, ids.map(id => x[id])); ors.set(key, variable); }
    return variable;
  };
  for (const { row } of classes) {
    const ids = row.map(([id]) => id), key = ids.join(',');
    if (!coverageRows.has(key)) { coverageRows.add(key); model.addBoolOr(ids.map(id => x[id])); }
  }
  const levels = [...new Set(rows.flatMap(row => row.map(([, q]) => q)))].sort((a, b) => a - b);
  if (levels.length > 1) levels.shift();
  const objectiveFor = level => {
    const groups = new Map();
    for (const { row, weight } of classes) {
      const ids = row.filter(([, q]) => q >= level).map(([id]) => id);
      if (!ids.length) continue;
      const key = ids.join(','), previous = groups.get(key);
      if (previous) previous.weight += weight; else groups.set(key, { ids, weight });
    }
    const entries = [...groups.values()];
    return LinearExpr.weightedSum(entries.map(g => logicalOr(g.ids)), entries.map(g => g.weight));
  };
  const radix = rows.length + 1;
  let batch = 3, status = 'UNKNOWN';
  while (radix ** batch > 2 ** 45 && batch > 1) batch--;
  const stages = [];
  async function optimize(expression, phase, detail) {
    const remaining = limitMs - (performance.now() - started);
    if (remaining <= 0) { status = 'TIMEOUT'; return false; }
    model.maximize(expression); model.proto().solutionHint = undefined;
    const chosen = new Set(selected);
    for (let i = 0; i < x.length; i++) model.addHint(x[i], chosen.has(i) ? 1 : 0);
    status = cp.statusName(await cp.solve(model, { numWorkers: 1, subsolvers: ['max_lp'], randomSeed: 1,
      addZeroHalfCuts: false, useSatInprocessing: false, relativeGapLimit: 0, absoluteGapLimit: 0,
      maxTimeInSeconds: remaining / 1000, executor: 'direct' }));
    if (status === 'OPTIMAL' || status === 'FEASIBLE') { selected = x.flatMap((v, i) => cp.value(v) ? [i] : []); validate(); }
    if (status !== 'OPTIMAL') return false;
    const exact = phase === 'quality'
      ? detail.levels.reduce((value, level) => value * radix + secondaryQualityVector(rows, selected).filter(q => q >= level).length, 0)
      : selected.filter(id => id >= detail.start && id < detail.start + detail.length).reduce((value, id) => value + 2 ** (detail.start + detail.length - 1 - id), 0);
    const tolerance = Math.max(1e-6, Math.abs(exact) * Number.EPSILON * 16);
    check(Number.isSafeInteger(exact) && tolerance < 0.25 && Math.abs(cp.objectiveValue() - exact) <= tolerance && Math.abs(cp.bestObjectiveBound() - exact) <= tolerance, 'CP objective/bound does not prove exact integer target');
    model.add(expression.eq(exact)); stages.push({ phase, ...detail, exactObjective: exact }); return true;
  }
  let qualityComplete = true;
  for (let start = 0; start < levels.length; start += batch) {
    const block = levels.slice(start, start + batch);
    const expression = LinearExpr.weightedSum(block.map(objectiveFor), block.map((_, i) => radix ** (block.length - 1 - i)));
    if (!await optimize(expression, 'quality', { levels: block })) { qualityComplete = false; break; }
  }
  let tieComplete = qualityComplete;
  if (qualityComplete) for (let start = 0; start < keys.length; start += 30) {
    const block = x.slice(start, start + 30);
    if (!await optimize(LinearExpr.weightedSum(block, block.map((_, i) => 2 ** (block.length - 1 - i))), 'tie', { start, length: block.length })) { tieComplete = false; break; }
  }
  return { count, keys: selected.map(i => keys[i]), qualityVector: secondaryQualityVector(rows, selected),
    completed: qualityComplete && tieComplete, qualityComplete, tieComplete, status, searchedStates: 0, stages };
}
