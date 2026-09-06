import { parsePattern } from './pattern.mjs';

// An implicit acyclic bag automaton. Its state records only the element,
// number drawn, and used-piece mask; queue permutations are never stored.
function compileBranch(branch) {
  const elements = branch.elements;
  const memo = new Map();
  function next(index, offset, used) {
    const element = elements[index];
    if (!element) return [];
    if (element.kind === 'fixed') {
      return [[element.value[offset], offset + 1 === element.depth
        ? [index + 1, 0, 0] : [index, offset + 1, 0]]];
    }
    const out = [];
    for (let bit = 0; bit < element.pieces.length; bit += 1) {
      if (used & (1 << bit)) continue;
      const piece = element.pieces[bit];
      // A<B rejects A after B, but permits either piece to be absent.
      if (element.constraint?.some(rule => {
        const [a, b] = rule.split('<');
        const bIndex = element.pieces.indexOf(b);
        return piece === a && (a === b || (bIndex >= 0 && (used & (1 << bIndex))));
      })) continue;
      out.push([piece, offset + 1 === element.depth
        ? [index + 1, 0, 0] : [index, offset + 1, used | (1 << bit)]]);
    }
    return out;
  }
  function count(state) {
    if (state[0] === elements.length) return 1n;
    const key = state.join(':');
    if (memo.has(key)) return memo.get(key);
    let total = 0n;
    for (const [, child] of next(...state)) total += count(child);
    memo.set(key, total);
    return total;
  }
  function* prefixes(take, state = [0, 0, 0], prefix = '') {
    if (prefix.length === take || state[0] === elements.length) {
      const weight = count(state);
      if (weight) yield {
        queue: prefix, weight,
        extend: () => next(...state).map(([piece, child]) => ({ queue: prefix + piece, weight: count(child) })).filter(entry => entry.weight > 0n),
      };
      return;
    }
    for (const [piece, child] of next(...state)) {
      if (count(child)) yield* prefixes(take, child, prefix + piece);
    }
  }
  return { count: count([0, 0, 0]), prefixes };
}

export function createPatternPrefixSource(pattern, take) {
  if (!Number.isInteger(take) || take < 0) throw new RangeError('prefix length must be a nonnegative integer');
  const parsed = parsePattern(pattern);
  const branches = parsed.branches.map(compileBranch);
  return {
    depth: parsed.depth,
    total: branches.reduce((sum, branch) => sum + branch.count, 0n),
    *prefixes(prefixLength = take) {
      if (!Number.isInteger(prefixLength) || prefixLength < 0) throw new RangeError('prefix length must be a nonnegative integer');
      for (const branch of branches) yield* branch.prefixes(Math.min(prefixLength, parsed.depth));
    },
  };
}
