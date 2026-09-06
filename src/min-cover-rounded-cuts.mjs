// For three covering rows, sum(d_j*x_j) >= 3 implies
// sum(ceil(d_j/2)*x_j) >= 2 for nonnegative integer x. A candidate covering
// all three rows MUST retain coefficient 2. No known optimum is used here.
export function generateTripleCuts(rows, n, x, { samples = 200000, limit = 64 } = {}) {
  const start = performance.now();
  if (!Number.isInteger(n) || n < 0 || x.length !== n || !x.every(Number.isFinite)) {
    throw new Error("Invalid cut LP point");
  }
  if (!Number.isInteger(samples) || samples < 0 || !Number.isInteger(limit) || limit < 0) {
    throw new Error("Invalid cut budget");
  }
  rows = rows.map((row) => [...new Set(row)]);
  if (rows.some((row) => row.some((id) => !Number.isInteger(id) || id < 0 || id >= n))) {
    throw new Error("Invalid cut candidate ID");
  }
  const tight = rows.flatMap((row, i) => row.reduce((sum, j) => sum + x[j], 0) < 1.0001 ? [i] : []);
  if (tight.length < 3) return { cuts: [], ms: performance.now() - start, tight: tight.length };
  let seed = 41357;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const degree = new Uint8Array(n);
  const seen = new Set();
  const cuts = [];
  for (let t = 0; t < samples; t += 1) {
    const a = tight[rng() % tight.length];
    const b = tight[rng() % tight.length];
    const c = tight[rng() % tight.length];
    if (a === b || a === c || b === c) continue;
    const touched = [];
    let value = 0;
    for (const i of [a, b, c]) for (const j of rows[i]) {
      if (degree[j] === 0) touched.push(j);
      degree[j] += 1;
      if (degree[j] !== 2) value += x[j];
    }
    if (value < 1.9999) {
      touched.sort((a, b) => a - b);
      const terms = touched.map((j) => [j, Math.ceil(degree[j] / 2)]);
      const key = terms.map(([j, coefficient]) => `${j}:${coefficient}`).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        cuts.push({ terms, rhs: 2, violation: 2 - value, sourceRows: [a, b, c] });
      }
    }
    for (const j of touched) degree[j] = 0;
  }
  cuts.sort((a, b) => b.violation - a.violation);
  cuts.length = Math.min(cuts.length, limit);
  // Validate retained cuts from their original rows before passing them to MIP.
  for (const cut of cuts) {
    const d = new Uint8Array(n);
    for (const i of cut.sourceRows) for (const j of rows[i]) d[j] += 1;
    const terms = Array.from(d).flatMap((v, j) => v ? [[j, Math.ceil(v / 2)]] : []);
    if (JSON.stringify(terms) !== JSON.stringify(cut.terms)) throw new Error("Invalid cut certificate");
  }
  return { cuts, ms: performance.now() - start, tight: tight.length };
}

export function appendCuts(lp, cuts) {
  const constraints = cuts.map((cut, i) =>
    ` cut${i}: ${cut.terms.map(([j, a]) => `${a} x${j}`).join(' + ')} >= ${cut.rhs}\n`).join('');
  return lp.replace('Binary', constraints + 'Binary');
}

export function relax(lp, n) {
  return lp.slice(0, lp.indexOf('Binary')) + 'Bounds\n'
    + Array.from({ length: n }, (_, j) => `0 <= x${j} <= 1`).join('\n') + '\nEnd\n';
}
